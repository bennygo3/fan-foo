import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma, SlotType } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { getCurrentSeasonWeek } from "./services/current-week";
import { tankGetProjections, extractPlayerProjections, extractDSTProjections } from "./services/tank-call";
import { scoreDST } from "../scoring/dst";

export const playerPoolRouter = express.Router();

playerPoolRouter.get(
    "/:leagueId/player-pool",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isFinite(leagueId)) {
                return res.status(400).json({ error: "Invalid leagueId" });
            }

            // filters
            const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
            const position = typeof req.query.position === "string" ? req.query.position.trim().toUpperCase() : undefined;
            const teamAbv = typeof req.query.teamAbv === "string" ? req.query.teamAbv.trim().toUpperCase() : undefined;

            const seasonParam = typeof req.query.season === "string" ? req.query.season : undefined;
            const weekParamRaw = typeof req.query.week === "string" ? req.query.week : undefined;

            let season: number;
            let week: number;

            if (seasonParam && weekParamRaw) {
                season = Number(seasonParam);
                week = Number(weekParamRaw);
            } else {
                const current = await getCurrentSeasonWeek();
                season = current.season;
                week = current.week;
            }

            const page = Math.max(1, typeof req.query.page === "string" ? Number(req.query.page) : 1);
            const limit = Math.min(100, Math.max(1, typeof req.query.limit === "string" ? Number(req.query.limit) : 100));

            const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "name";
            const orderParam = typeof req.query.order === "string" ? req.query.order.toLowerCase() : undefined;

            const dir: "asc" | "desc" =
            sortRaw === "proj" || sortRaw === "projPts"
            ?
            orderParam === "asc" ? "asc" : "desc"
            : orderParam === "desc" ? "desc" : "asc";

            const and: Prisma.PlayerWhereInput[] = [];

            if (search) {
                and.push({
                    name: { contains: search, mode: "insensitive" },
                });
            }

            if (position) {
                and.push({ position });
            }

            if (teamAbv) {
                and.push({
                    team: {
                        abbr: { equals: teamAbv, mode: "insensitive" },
                    },
                });
            }

            const where: Prisma.PlayerWhereInput = and.length ? { AND: and } : {};

            type PlayerWithAtts = Prisma.PlayerGetPayload<{
                include: {
                    team: true;
                    RosterSlot: {
                        include: {
                            team: {
                                include: { manager: true };
                            };
                        };
                    };
                };
            }>;

            const players: PlayerWithAtts[] = await prisma.player.findMany({
                where,
                include: {
                    team: true,
                    RosterSlot: {
                        where: { leagueId },
                        include: {
                            team: {
                                include: {
                                    manager: true,
                                },
                            },
                        },
                    },
                },
            });

            // build matchup map for the season/wek based on Game
            const games = await prisma.game.findMany({
                where: {
                    season,
                    week,
                },
                include: {
                    homeTeam: true,
                    awayTeam: true,
                },
            });

            const matchupByTeamAbbr = new Map<
                string,
                { oppAbv: string; kickoffIso: string | null }
            >();

            for (const g of games) {
                const kickoffIso = g.startTime ? g.startTime.toISOString() : null;

                matchupByTeamAbbr.set(g.homeTeam.abbr, {
                    oppAbv: g.awayTeam.abbr,
                    kickoffIso,
                });

                matchupByTeamAbbr.set(g.awayTeam.abbr, {
                    oppAbv: g.homeTeam.abbr,
                    kickoffIso,
                });
            }

            // projections from Tank
            const projMap = new Map<string, { projPts: number }>();
            const dstProjMap = new Map<string, { projPts: number }>();

            try {
                const projResp = await tankGetProjections({ week: String(week), season: String(season) });
                const rows = extractPlayerProjections(projResp);
                for (const r of rows) {
                    const id = String(r?.playerID ?? r?.espnID ?? "");
                    if (!id) continue;
                    const projPts = Number(r?.fantasyPoints ?? r?.points ?? 0);
                    projMap.set(id, { projPts: Number.isFinite(projPts) ? projPts : 0 });
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
                        blockKick: Number(d?.blockKick ?? 0),
                        ptsAgainst: Number(d?.ptsAgainst ?? 99),
                        yardsAgainst: Number(d?.yardsAgainst ?? 0),
                    });

                    dstProjMap.set(teamAbv, { projPts: scored });
                }
                console.log("[player-pool] projMap size:", projMap.size)
            } catch (err) {
                console.error("Failed to load projections:", err);
            }


            const items = players.map((p, idx) => {
                const slot = p.RosterSlot[0];
                const unavailable = !!slot;

                const teamAbv = p.team?.abbr ?? null;
                const matchup = teamAbv ? matchupByTeamAbbr.get(teamAbv) : undefined;
                // const proj = p.externalId ? projMap.get(p.externalId) : undefined;
                let projPts: number | null = null;

                if (p.position === "DST" || p.position === "D/ST") {
                    const dstProj = teamAbv ? dstProjMap.get(teamAbv.toUpperCase()) : undefined;
                    projPts = dstProj?.projPts ?? p.projPts ?? null;

                    if (idx < 5) {
                        console.log("[D/ST debug]", {
                            dbId: p.id,
                            teamAbv,
                            hasDstProj: teamAbv ? dstProjMap.has(teamAbv.toUpperCase()) : false,
                            dstProj,
                        });
                    }
                } else {
                    // Offensive player 🏈 projections come from playerProjections
                    const proj = p.externalId ? projMap.get(p.externalId) : undefined;
                    projPts = proj?.projPts ?? p.projPts ?? null;

                    if (idx < 5) {
                        console.log("[player-pool] join debug", {
                            dbId: p.id,
                            name: p.name,
                            externalId: p.externalId,
                            hasProj: p.externalId ? projMap.has(p.externalId) : false,
                            proj,
                        });
                    }
                }

                return {
                    id: p.id,
                    name: p.name,
                    position: p.position,
                    teamAbv,
                    projPts,
                    oppAbv: matchup?.oppAbv ?? null,
                    kickoffIso: matchup?.kickoffIso ?? null,
                    headshot: p.headshotUrl ?? null,
                    available: !unavailable,
                    managedBy: unavailable && slot?.team ?
                        {
                            managerId: slot.team.managerId ?? null,
                            managerTeamName: slot.team.name,
                            managerName: slot.team.manager?.username ?? null,
                        }
                    : null,
                };
            });

            // Sort in memory
            const sorted = [...items];

            if (sortRaw === "proj" || sortRaw === "projPts") {
                sorted.sort((a, b) => {
                    const av = a.projPts ?? 0;
                    const bv = b.projPts ?? 0;
                    return dir === "asc" ? av - bv : bv - av;
                });
            } else if (sortRaw === "position") {
                sorted.sort((a, b) => {
                    const cmp = a.position.localeCompare(b.position);
                    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
                    return a.name.localeCompare(b.name);
                });
            } else if (sortRaw === "team" || sortRaw === "teamId") {
                sorted.sort((a, b) => {
                    const ta = a.teamAbv ?? "";
                    const tb = b.teamAbv ?? "";
                    const cmp = ta.localeCompare(tb);
                    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
                    return a.name.localeCompare(b.name);
                });
            } else {
                // default sort by name
                sorted.sort((a, b) => {
                    const cmp = a.name.localeCompare(b.name);
                    return dir === "asc" ? cmp : -cmp;
                });
            }

            const total = sorted.length;
            const start = (page - 1) * limit;
            const paged = sorted.slice(start, start + limit);

            res.json({ items: paged, total, page, limit, season, week });
        } catch (err) {
            next(err);
        }
    }
);

function allowedSlotsForPosition(pos: string): SlotType[] {
    const p = pos.toUpperCase();

    switch (p) {
        case "QB":
            return ["QB", "BN"];
        case "RB":
        case "FB":
            return ["RB", "FLEX", "BN"];
        case "WR":
            return ["WR", "FLEX", "BN"];
        case "TE":
            return ["TE", "FLEX", "BN"];
        case "K":
            return ["K", "BN"];
        case "D/ST":
        case "DST":
        case "DEF":
            return ["DST", "BN"];
        default:
            return ["BN"];
    }
}

playerPoolRouter.post(
    "/:leagueId/teams/:teamId/roster/add",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const teamId = Number(req.params.teamId);
            const playerId = Number(req.body.playerId);
            const requestedSlot = req.body.slot as SlotType | undefined;

            if (!Number.isFinite(leagueId) || !Number.isFinite(teamId) || !Number.isFinite(playerId)) {
                return res.status(400).json({ error: "Invalid leagueId, teamId, or playerId" });
            }

            // check for valid league and team
            const team = await prisma.fantasyTeam.findFirst({
                where: { id: teamId, leagueId },
            });
            if (!team) {
                return res.status(404).json({ error: "Team not found in this league" });
            }

            const player = await prisma.player.findUnique({
                where: { id: playerId },
                include: { team: true }, // nfl team
            });
            if (!player) {
                return res.status(404).json({ error: "Player not found" });
            }

            // make sure player isn't on another manager's team
            const alreadyOnRoster = await prisma.rosterSlot.findFirst({
                where: { leagueId, playerId },
            });
            if (alreadyOnRoster) {
                return res.status(400).json({
                    error: "Player already rostered.",
                    rosterSlotId: alreadyOnRoster.id,
                    teamId: alreadyOnRoster.teamId,
                });
            }

            // which slots user is allowed to fill
            let candidateSlots: SlotType[];

            if (requestedSlot) {
                const allowed = allowedSlotsForPosition(player.position);
                if (!allowed.includes(requestedSlot)) {
                    return res.status(400).json({
                        error: `Slot ${requestedSlot} is not valid for position ${player.position}`,
                    });
                }
                candidateSlots = [requestedSlot];
            } else {
                candidateSlots = allowedSlotsForPosition(player.position);
            }

            console.log("[roster/add] adding player", {
                playerId: player.id,
                name: player.name,
                position: player.position,
                requestedSlot,
                candidateSlots,
            });

            let emptySlot = null;

            for (const slotType of candidateSlots) {
                emptySlot = await prisma.rosterSlot.findFirst({
                    where: {
                        leagueId,
                        teamId,
                        playerId: null,
                        slot: slotType,
                    },
                    orderBy: { id: "asc" },
                });

                if (emptySlot) break;
            }

            if (!emptySlot) {
                return res.status(400).json({
                    error: "Must drop a player",
                    triedSlots: candidateSlots,
                });
            }

            // Finally fill the slot
            const updatedSlot = await prisma.rosterSlot.update({
                where: { id: emptySlot.id },
                data: { playerId },
                include: {
                    player: {
                        include: { team: true }, // nfl team
                    },
                    team: true, // fantasy team
                },
            });

            res.json({
                message: "Player added to roster",
                slot: updatedSlot,
            });
        } catch (err) {
            next(err);
        }
    }
);

playerPoolRouter.post(
    "/:leagueId/teams/:teamId/roster/drop",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const teamId = Number(req.params.teamId);
            const rosterSlotId = Number(req.body.rosterSlotId);

            if (!Number.isFinite(leagueId) || !Number.isFinite(teamId) || !Number.isFinite(rosterSlotId)) {
                return res.status(400).json({ error: "Invalid leagueId, teamId, or rosterSlotId" });
            }

            // slot belongs to this team
            const slot = await prisma.rosterSlot.findFirst({
                where: { id: rosterSlotId, leagueId, teamId },
            });

            if (!slot) {
                return res.status(404).json({ error: "Roster slot not found" })
            }

            if (slot.playerId == null) {
                return res.status(400).json({ error: "Roster slot already empty " });
            }

            const updatedSlot = await prisma.rosterSlot.update({
                where: { id: slot.id },
                data: { playerId: null },
            });

            res.json({
                message: "Player dropped",
                slot: updatedSlot,
            });
        } catch (err) {
            next(err);
        }
    }
);
