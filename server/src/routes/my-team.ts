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
                        byeWeeksBySeason: true;
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
                                    logoUrl: true,
                                    byeWeeksBySeason: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { id: "asc" },
            });

            const games = await prisma.game.findMany({
                where: { season, week },
                include: {
                    homeTeam: { select: { abbr: true } },
                    awayTeam: { select: { abbr: true } },
                },
            });

            const matchupByTeamAbbr = new Map<
                string, 
                { oppAbv: string; kickoffIso: string | null; isHome: boolean }
            >();

            for (const g of games) {
                const kickoffIso = g.startTime ? g.startTime.toISOString() : null;
                const homeAbbr = g.homeTeam.abbr.toUpperCase();
                const awayAbbr = g.awayTeam.abbr.toUpperCase();

                matchupByTeamAbbr.set(awayAbbr, {
                    oppAbv: homeAbbr,
                    kickoffIso,
                    isHome: false,
                });

                matchupByTeamAbbr.set(homeAbbr, {
                    oppAbv: awayAbbr,
                    kickoffIso,
                    isHome: true,
                });
            }

            const projMap = new Map<string, number>(); // playerID -> projPts
            const dstProjMap = new Map<string, number>(); // teamAbv -> projPts

            try {
                const projResp = await tankGetProjections({ week, season });

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

            const decorated = slots.map((slot) => {
                const p = slot.player;
                const teamAbv = p?.team?.abbr ? p.team.abbr.toUpperCase() : null;
                const matchup = teamAbv ? matchupByTeamAbbr.get(teamAbv) : undefined;

                const byeWeeksBySeason = (p?.team?.byeWeeksBySeason ?? null) as Record<string, number> | null;

                const byeWeekForSeason = teamAbv && byeWeeksBySeason ? byeWeeksBySeason[String(season)] : null;

                const isBye = Number(byeWeekForSeason) === Number(week);

                const oppAbv = matchup ? matchup.oppAbv : isBye ? "BYE" : null;
                const kickoffIso = matchup?.kickoffIso ?? null;

                let projPts: number | null = null;
                if (p) {
                    if (p.position === "DST") {
                        projPts = teamAbv
                            ? dstProjMap.get(teamAbv) ?? null
                            : null;
                    } else {
                        const externalProj = p.externalId
                            ? projMap.get(p.externalId) ?? null
                            : null;
                        projPts = externalProj ?? p.projPts ?? null;
                    }
                }

                return {
                    ...slot,
                    oppAbv,
                    kickoffIso,
                    isHome: matchup?.isHome ?? null,
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
                season,
                roster: { starters, bench, ir },
            });
        } catch (err) {
            next(err);
        }
    }
);

myTeamRouter.post(
    "/:leagueId/teams/:teamId/roster/move",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const teamId = Number(req.params.teamId);

            if (!Number.isFinite(leagueId) || !Number.isFinite(teamId)) {
                return res.status(400).json({ error: "Invalid league id or team id" });
            }

            const fromRosterSlotId = Number(req.body?.fromRosterSlotId);
            const toRosterSlotId = Number(req.body?.toRosterSlotId);

            if (!Number.isFinite(fromRosterSlotId) || !Number.isFinite(toRosterSlotId)) {
                return res.status(400).json({ error: "Invalid move from/to" });
            }

            if (fromRosterSlotId === toRosterSlotId) {
                return res.json({ message: "No-op", moved: false });
            }

            const slots = await prisma.rosterSlot.findMany({
                where: {
                    id: { in: [fromRosterSlotId, toRosterSlotId] },
                    leagueId,
                    teamId,
                },
                include: {
                    player: {
                        include: {
                            team: { select: { abbr: true } },
                        },
                    },
                },
            });

            const fromSlot = slots.find((s) => s.id === fromRosterSlotId) ?? null;
            const toSlot = slots.find((s) => s.id === toRosterSlotId) ?? null;

            if (!fromSlot || !toSlot) {
                return res.status(404).json({ error: "Roster slot not found for this team" });
            }

            if (!fromSlot.playerId || !fromSlot.player?.position) {
                return res.status(400).json({ error: "No player in source slot" });
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

            // build kickoffByTeam from schedule
            const games = await prisma.game.findMany({
                where: { season, week },
                include: { homeTeam: { select: { abbr: true } }, awayTeam: { select: { abbr: true } } },
            });

            const kickoffByTeam = new Map<string, string | null>();
            for (const g of games) {
                const kickoffIso = g.startTime ? g.startTime.toISOString() : null;
                kickoffByTeam.set(g.homeTeam.abbr.toUpperCase(), kickoffIso);
                kickoffByTeam.set(g.awayTeam.abbr.toUpperCase(), kickoffIso);
            }

            const fromTeamAbbr = fromSlot.player?.team?.abbr?.toUpperCase() ?? null;
            const fromKickoff = fromTeamAbbr ? kickoffByTeam.get(fromTeamAbbr) ?? null : null;

            let toKickoff: string | null = null;
            if (toSlot.playerId && toSlot.player?.team?.abbr) {
                const abbr = toSlot.player.team.abbr.toUpperCase();
                toKickoff = kickoffByTeam.get(abbr) ?? null;
            }

            if (isGameLocked(fromKickoff) ||isGameLocked(toKickoff)) {
                return res.status(409).json({ error: "Player is locked. Game has already started" });
            }

            const movingPos = fromSlot.player.position;

            if (!slotCanAcceptPlayer(toSlot.slot, movingPos)) {
                return res.status(409).json({
                    error: `Illegal move: ${movingPos} cannot go into ${toSlot.slot}`,
                });
            }

            // if swapping, validate the opposite direction too
            if (toSlot.playerId && toSlot.player?.position) {
                const otherPos = toSlot.player.position;
                if (!slotCanAcceptPlayer(fromSlot.slot, otherPos)) {
                    return res.status(409).json({
                        error: `Illegal swap: ${otherPos} cannot go into ${fromSlot.slot}`,
                    });
                }
            }

            const result = await prisma.$transaction(async (tx) => {
                const fromPlayerId = fromSlot.playerId!;
                const toPlayerId = toSlot.playerId ?? null;

                await tx.rosterSlot.update({
                    where: { id: fromSlot.id },
                    data: { playerId: toPlayerId },
                });

                await tx.rosterSlot.update({
                    where: { id: toSlot.id },
                    data: { playerId: fromPlayerId },
                });

                return {
                    fromRosterSlotId: fromSlot.id,
                    toRosterSlotId: toSlot.id,
                    swapped: !!toPlayerId,
                };
            });

            res.json({
                message: result.swapped ? "Swapped" : "Moved",
                ...result,
                season,
                week,
            });
        } catch (err) {
            next(err);
        }
    }
);