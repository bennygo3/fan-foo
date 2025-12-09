import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { SlotType, Prisma } from "@prisma/client";
import { getCurrentSeasonWeek } from "./services/current-week";
import { tankGetProjections, extractPlayerProjections, extractDSTProjections } from "./services/tank-call";
import { scoreDST } from "../scoring/dst";

export const myTeamRouter = express.Router();

type RosterSlotWithPlayer = Prisma.RosterSlotGetPayload<{
    include: {
        player: {
            include: {
                team: {
                    select: {
                        id: true;
                        abbr: true;
                        name: true;
                        byeWeeks: true;
                        logoUrl: true;
                    };
                };
            };
        };
    };
}>;

myTeamRouter.get(
    "/:leagueId/teams/:teamId/roster",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const teamId = Number(req.params.teamId);

            if (!Number.isFinite(leagueId) || !Number.isFinite(teamId)) {
                return res.status(400).json({ error: "Invalid leagueId or teamId" });
            }

            const seasonParam = req.query.season as string | undefined;
            const weekParam = req.query.week as string | undefined;

            let season: number;
            let week: number;

            if (seasonParam && weekParam) {
                season = Number(seasonParam);
                week = Number(weekParam);
            } else {
                const current = await getCurrentSeasonWeek();
                season = current.season;
                week = current.week;
            }

            // Load team-manager
            const team = await prisma.fantasyTeam.findFirst({
                where: { id: teamId, leagueId },
                include: {
                    manager: { select: { id: true, username: true, email: true } },
                    league: { select: { id: true, name: true } },
                },
            });

            if (!team) {
                return res.status(404).json({ error: "Team no aqui" });
            }

            // Load all roster slots for this team
            const slots: RosterSlotWithPlayer[] = await prisma.rosterSlot.findMany({
                where: { leagueId, teamId },
                include: {
                    player: {
                        include: {
                            team: {
                                select: {
                                    id: true,
                                    abbr: true,
                                    name: true,
                                    byeWeeks: true,
                                    logoUrl: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { id: "asc" },
            });

            const games = await prisma.game.findMany({
                where: { season, week },
                include: { homeTeam: true, awayTeam: true },
            });

            const matchupByTeamAbbr = new Map<string, { oppAbv: string; kickoffIso: string | null }>();

            for (const g of games) {
                const kickoffIso = g.startTime ? g.startTime.toISOString() : null;

                matchupByTeamAbbr.set(g.awayTeam.abbr, {
                    oppAbv: g.homeTeam.abbr,
                    kickoffIso,
                });

                matchupByTeamAbbr.set(g.homeTeam.abbr, {
                    oppAbv: g.awayTeam.abbr,
                    kickoffIso,
                });
            }

            const projMap = new Map<string, number>(); // playerID -> projPts
            const dstProjMap = new Map<string, number>(); // teamAbv -> projPts

            try {
                const projResp = await tankGetProjections({
                    week,
                    season,
                });

                const rows = extractPlayerProjections(projResp);
                for (const r of rows) {
                    const id = String(r?.playerID ?? r?.espnID ?? "");
                    if (!id) continue;

                    const projPts = Number(r?.fantasyPoints ?? r?.points ?? 0);
                    projMap.set(id, Number.isFinite(projPts) ? projPts : 0);
                }

                const dstRows = extractDSTProjections(projResp);
                for (const d of dstRows) {
                    const teamAbv = String(d?.teamAbv ?? d?.team ?? "").toUpperCase();
                    if (!teamAbv) continue;

                    const scored = scoreDST({
                        teamAbv,
                        sacks: Number(d?.sacks ?? 0),
                        interceptions: Number(d?.interceptions ?? 0),
                        fumbleRecoveries: Number(d?.fumbleRecoveries ?? 0),
                        safeties: Number(d?.safeties ?? 0),
                        defTD: Number(d?.defTD ?? 0),
                        returnTD: Number(d?.returnTD ?? 0),
                        blockKick: Number(d?.blockKIck ?? 0),
                        ptsAgainst: Number(d?.ptsAgainst ?? 99),
                        yardsAgainst: Number(d?.yardsAgainst ?? 0),
                    });

                    dstProjMap.set(teamAbv, scored);
                }
            } catch (err) {
                console.error("[roster] projection error:", err);
            }

            const decorated = slots.map((slot, idx) => {
                const p = slot.player;
                const teamAbv = p?.team?.abbr ?? null;
                const byeWeeks = p?.team?.byeWeeks as any | undefined;

                const matchup = teamAbv ? matchupByTeamAbbr.get(teamAbv) : undefined;

                let oppAbv: string | null = null;

                if (matchup) {
                    oppAbv = matchup.oppAbv;
                } else if (teamAbv && byeWeeks) {
                    // byeWeeks should be json. treat it as a map
                    const byeForSeason = byeWeeks[String(season)];
                    if (Number(byeForSeason) === week) {
                        oppAbv = "BYE";
                    }
                }

                let projPts: number | null = null;

                if (p) {
                    if (p.position === "DST") {
                        projPts = teamAbv
                            ? dstProjMap.get(teamAbv.toUpperCase()) ?? null
                            : null;
                    } else {
                        const externalProj = p.externalId
                            ? projMap.get(p.externalId) ?? null
                            : null;
                        projPts = externalProj ?? p.projPts ?? null;
                    }

                    if (idx < 3) {
                        console.log("[roster debug]", {
                            slotId: slot.id,
                            name: p.name,
                            pos: p.position,
                            teamAbv,
                            externalId: p.externalId,
                            projPts,
                        });
                    }
                }

                return {
                    ...slot,
                    oppAbv,
                    kickoffIso: matchup?.kickoffIso ?? null,
                    projPts,
                    livePts: null, // TODO: wire up live scoring
                };
            });

            const starters: typeof decorated = [];
            const bench: typeof decorated = [];
            const ir: typeof decorated = [];

            for (const slot of decorated) {
                if (slot.slot === "IR") {
                    ir.push(slot);
                } else if (slot.slot === "BN") {
                    bench.push(slot);
                } else {
                    starters.push(slot);
                }
            }

            // order lineup by preferred order
            const slotPriority: Record<SlotType, number> = {
                QB: 1,
                RB: 2,
                WR: 3,
                TE: 4,
                FLEX: 5,
                DST: 6,
                K: 7,
                BN: 99,
                IR: 100,
            };

            starters.sort((a, b) => {
                const pa = slotPriority[a.slot] ?? 999;
                const pb = slotPriority[b.slot] ?? 999;
                if (pa !== pb) return pa - pb;
                return a.id - b.id;
            });

            // shape response for frontend
            res.json({
                leagueId,
                team: {
                    id: team.id,
                    name: team.name,
                    league: team.league,
                    manager: team.manager ?? null,
                },
                week,
                roster: {
                    starters,
                    bench,
                    ir,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);