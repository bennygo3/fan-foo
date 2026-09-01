import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma, SlotType } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { getCurrentSeasonWeek } from "./services/current-week";
import { tankGetProjections, extractPlayerProjections, extractDSTProjections } from "./services/tank-call";
import { scoreDST } from "../scoring/dst";

export const playerPoolRouter = express.Router();

function parsePositiveInteger(value: unknown): number | null {
    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return null;
    }

    return parsed;
}

function hasPrismaCode(error: unknown, code: string): boolean {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    return (error as { code?: unknown }).code === code;
}

async function findLeagueSeason(
    leagueId: number,
    season: number
) {
    return prisma.leagueSeason.findUnique({
        where: {
            leagueId_season: {
                leagueId,
                season,
            },
        },
    });
}

playerPoolRouter.get(
    "/:leagueId/player-pool",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = parsePositiveInteger(
                req.params.leagueId
            );

            if (leagueId === null) {
                return res.status(400).json({ error: "Invalid leagueId", });
            }

            // filters
            const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
            const position = typeof req.query.position === "string" ? req.query.position.trim().toUpperCase() : undefined;
            const teamAbv = typeof req.query.teamAbv === "string" ? req.query.teamAbv.trim().toUpperCase() : undefined;

            const requestedSeason = req.query.season === undefined ? undefined : parsePositiveInteger(req.query.season);
            const requestedWeek = req.query.week === undefined ? undefined : parsePositiveInteger(req.query.week);

            if (requestedSeason === null) {
                return res.status(400).json({
                    error: "Invalid season",
                });
            }

            if (requestedWeek === null) {
                return res.status(400).json({
                    error: "Invalid week",
                });
            }

            let season: number;
            let week: number;

            if (
                requestedSeason === undefined ||
                requestedWeek === undefined
            ) {
                const current = await getCurrentSeasonWeek();

                season = requestedSeason ?? current.season;
                week = requestedWeek ?? current.week;
            } else {
                season = requestedSeason;
                week = requestedWeek;
            }

            const leagueSeason = await findLeagueSeason(
                leagueId,
                season
            );

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League's season ${season} not found`,
                });
            }

            const requestedPage =
                req.query.page === undefined
                    ? 1
                    : parsePositiveInteger(req.query.page)
                ;

            const requestedLimit =
                req.query.limit === undefined
                    ? 100
                    : parsePositiveInteger(req.query.limit)
                ;

            if (requestedPage === null) {
                return res.status(400).json({
                    error: "Invalid page",
                });
            }

            if (requestedLimit === null) {
                return res.status(400).json({
                    error: "Invalid limit",
                });
            }

            const page = requestedPage;
            const limit = Math.min(100, requestedLimit);

            const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "name";
            const orderParam = typeof req.query.order === "string" ? req.query.order.toLowerCase() : undefined;

            const dir: "asc" | "desc" =
                sortRaw === "proj" || sortRaw === "projPts"
                    ? orderParam === "asc" ? "asc" : "desc"
                    : orderParam === "desc" ? "desc" : "asc"
                ;

            const and: Prisma.PlayerWhereInput[] = [];

            if (search) {
                and.push({
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                });
            }

            if (position) {
                and.push({ position });
            }

            if (teamAbv) {
                and.push({
                    team: {
                        abbr: {
                            equals: teamAbv,
                            mode: "insensitive",
                        },
                    },
                });
            }

            const where: Prisma.PlayerWhereInput =
                and.length > 0
                    ? { AND: and }
                    : {}
                ;

            // type PlayerWithAtts = Prisma.PlayerGetPayload<{
            //     include: {
            //         team: true;
            //         RosterSlot: {
            //             include: {
            //                 team: {
            //                     include: { manager: true };
            //                 };
            //             };
            //         };
            //     };
            // }>;

            const players = await prisma.player.findMany({
                where,
                include: {
                    team: true,
                    RosterSlot: {
                        where: {
                            leagueSeasonId: leagueSeason.id,
                        },
                        select: {
                            id: true,
                            fantasyTeamSeason: {
                                select: {
                                    id: true,
                                    name: true,
                                    managerId: true,
                                    manager: {
                                        select: {
                                            id: true,
                                            username: true,
                                        },
                                    },
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
                {
                    oppAbv: string;
                    kickoffIso: string | null;
                }
            >();

            for (const game of games) {
                const kickoffIso = game.startTime
                    ? game.startTime.toISOString()
                    : null;

                const homeAbbr = game.homeTeam.abbr.toUpperCase();
                const awayAbbr = game.awayTeam.abbr.toUpperCase();

                matchupByTeamAbbr.set(homeAbbr, {
                    oppAbv: awayAbbr,
                    kickoffIso,
                });

                matchupByTeamAbbr.set(awayAbbr, {
                    oppAbv: homeAbbr,
                    kickoffIso,
                });
            }

            // projections from Tank
            const projMap = new Map<string, { projPts: number }>();
            const dstProjMap = new Map<string, { projPts: number }>();

            try {
                const projResp = await tankGetProjections({ week: String(week), season: String(season), });
                const playerRows = extractPlayerProjections(projResp);
                for (const row of playerRows) {
                    const externalId = String(row?.playerID ?? row?.espnID ?? "");
                    if (!externalId) continue;
                    const projPts = Number(row?.fantasyPoints ?? row?.points ?? 0);
                    projMap.set(externalId, { projPts: Number.isFinite(projPts) ? projPts : 0 });
                }

                const dstRows = extractDSTProjections(projResp);
                for (const dRow of dstRows) {
                    const teamAbv = String(dRow?.teamAbv ?? dRow?.team ?? "").toUpperCase();
                    if (!teamAbv) continue;

                    const scored = scoreDST({
                        teamAbv: teamAbv,
                        sacks: Number(dRow?.sacks ?? 0),
                        interceptions: Number(dRow?.interceptions ?? 0),
                        fumbleRecoveries: Number(dRow?.fumbleRecoveries ?? 0),
                        safeties: Number(dRow?.safeties ?? 0),
                        defTD: Number(dRow?.defTD ?? 0),
                        returnTD: Number(dRow?.returnTD ?? 0),
                        blockKick: Number(dRow?.blockKick ?? 0),
                        ptsAgainst: Number(dRow?.ptsAgainst ?? 99),
                        yardsAgainst: Number(dRow?.yardsAgainst ?? 0),
                    });

                    dstProjMap.set(teamAbv, { projPts: scored });
                }
            } catch (err) {
                console.error("Failed to load projections:", err);
            }


            const items = players.map((player) => {

                const rosterSlot = player.RosterSlot[0] ?? null;
                const fantasyTeamSeason = rosterSlot?.fantasyTeamSeason ?? null;
                const unavailable = rosterSlot !== null;

                const nflTeamAbv = player.team?.abbr.toUpperCase() ?? null;
                const matchup = nflTeamAbv ? matchupByTeamAbbr.get(nflTeamAbv) : undefined;

                let projPts: number | null = null;

                const playerPosition = player.position.toUpperCase();

                if (playerPosition === "DST" || playerPosition === "D/ST" || playerPosition === "DEF") {
                    const dstProj = nflTeamAbv ? dstProjMap.get(nflTeamAbv) : undefined;

                    projPts = dstProj?.projPts ?? player.projPts ?? null;

                    // if (idx < 5) {
                    //     console.log("[D/ST debug]", {
                    //         dbId: p.id,
                    //         teamAbv,
                    //         hasDstProj: teamAbv ? dstProjMap.has(teamAbv.toUpperCase()) : false,
                    //         dstProj,
                    //     });
                    // }
                } else {
                    // Offensive player 🏈 projections come from playerProjections
                    const playerProj = player.externalId ? projMap.get(player.externalId) : undefined;

                    projPts = playerProj?.projPts ?? player.projPts ?? null;

                    // if (idx < 5) {
                    //     console.log("[player-pool] join debug", {
                    //         dbId: p.id,
                    //         name: p.name,
                    //         externalId: p.externalId,
                    //         hasProj: p.externalId ? projMap.has(p.externalId) : false,
                    //         proj,
                    //     });
                    // }
                }

                return {
                    id: player.id,
                    name: player.name,
                    position: player.position,
                    teamAbv: nflTeamAbv,
                    projPts,
                    oppAbv: matchup?.oppAbv ?? null,
                    kickoffIso: matchup?.kickoffIso ?? null,
                    headshot: player.headshotUrl ?? null,
                    available: !unavailable,
                    managedBy: unavailable && fantasyTeamSeason ?
                        {
                            managerId: fantasyTeamSeason.managerId ?? null,
                            managerTeamName: fantasyTeamSeason.name,
                            managerName: fantasyTeamSeason.manager?.username ?? null,
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

            res.json({ items: paged, total, page, limit, leagueSeasonId: leagueSeason.id, season, week });
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
            const leagueId = parsePositiveInteger(req.params.leagueId);
            const fantasyTeamId = parsePositiveInteger(req.params.teamId);
            const playerId = parsePositiveInteger(req.body?.playerId);
            const season = parsePositiveInteger(req.body?.season);
            const requestedSlot =
                typeof req.body?.slot === "string"
                    ? (req.body.slot.toUpperCase() as SlotType)
                    : undefined;

            if (
                leagueId === null ||
                fantasyTeamId === null ||
                playerId === null
            ) {
                return res.status(400).json({ error: "Invalid leagueId, teamId, or playerId" });
            }

            if (season === null) {
                return res.status(400).json({
                    error: "A valid season is required",
                });
            }

            const leagueSeason =
                await findLeagueSeason(
                    leagueId,
                    season
                )
                ;

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            // check for valid league and team
            const fantasyTeamSeason = await prisma.fantasyTeamSeason.findFirst({
                where: { seasonId: leagueSeason.id, fantasyTeamId, },
                include: {
                    fantasyTeam: {
                        select: {
                            leagueId: true,
                        },
                    },
                },
            });

            if (!fantasyTeamSeason || fantasyTeamSeason.fantasyTeam.leagueId !== leagueId) {
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
                where: { leagueSeasonId: leagueSeason.id, playerId },
            });
            if (alreadyOnRoster) {
                return res.status(409).json({
                    error: "Player already rostered.",
                    rosterSlotId: alreadyOnRoster.id,
                    fantasyTeamSeasonId: alreadyOnRoster.fantasyTeamSeasonId,
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

            let emptySlotId: number | null = null;

            for (const slotType of candidateSlots) {
                const emptySlot = await prisma.rosterSlot.findFirst({
                    where: {
                        leagueSeasonId: leagueSeason.id,
                        fantasyTeamSeasonId: fantasyTeamSeason.id,
                        playerId: null,
                        slot: slotType,
                    },
                    select: {
                        id: true,
                    },
                    orderBy: { id: "asc" },
                });

                if (emptySlot) {
                    emptySlotId = emptySlot.id;
                    break;
                } 
            }

            if (emptySlotId === null) {
                return res.status(400).json({
                    error: "Must drop a player",
                    triedSlots: candidateSlots,
                });
            }

            const claimedSlot =
                await prisma.rosterSlot.updateMany({
                    where: {
                        id: emptySlotId,
                        leagueSeasonId: leagueSeason.id,
                        fantasyTeamSeasonId: fantasyTeamSeason.id,
                        playerId: null,
                    },
                    data: {
                        playerId,
                    },
                });

                if (claimedSlot.count !== 1) {
                    return res.status(409).json({
                        error: "Roster changed before the player could be added. Try again.",
                    });
                }

            // Finally fill the slot
            const updatedSlot = await prisma.rosterSlot.findUnique({
                where: { id: emptySlotId, },
                include: {
                    player: {
                        include: { team: true, }, // nfl team
                    },
                    fantasyTeamSeason: {
                        select: {
                            id: true,
                            name: true,
                            manager: {
                                select: {
                                    id: true,
                                    username: true,
                                },
                            },
                        },
                    },
                },
            });

            res.json({
                message: "Player added to roster",
                leagueSeasonId: leagueSeason.id,
                season,
                slot: updatedSlot,
            });
        } catch (err) {
            if (hasPrismaCode(err, "P2002")) {
                return res.status(409).json({
                    error: "Player was added to another roster first",
                });
            }
            next(err);
        }
    }
);

playerPoolRouter.post(
    "/:leagueId/teams/:teamId/roster/drop",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);
            const fantasyTeamId = parsePositiveInteger(req.params.teamId);
            const rosterSlotId = parsePositiveInteger(req.body?.rosterSlotId);
            const season = parsePositiveInteger(req.body?.season);

            if (leagueId === null || fantasyTeamId === null || rosterSlotId === null) {
                return res.status(400).json({ error: "Invalid leagueId, teamId, or rosterSlotId", });
            }

            if (season === null) {
                return res.status(400).json({
                    error: "A valid season is required",
                });
            }

            const leagueSeason = await findLeagueSeason(leagueId, season);
            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            const fantasyTeamSeason = await prisma.fantasyTeamSeason.findFirst({
                where: {
                    seasonId: leagueSeason.id,
                    fantasyTeamId,
                },
                include: {
                    fantasyTeam: {
                        select: {
                            leagueId: true,
                        },
                    },
                },
            });

            if (!fantasyTeamSeason || fantasyTeamSeason.fantasyTeam.leagueId ! == leagueId) {
                return res.status(404).json({
                    error: "Fantasy team was not found in this league's season",
                });
            }

            // slot belongs to this team
            const slot = await prisma.rosterSlot.findFirst({
                where: { 
                    id: rosterSlotId, 
                    leagueSeasonId: leagueSeason.id,
                    fantasyTeamSeasonId: fantasyTeamSeason.id, 
                },
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
                leagueSeasonId: leagueSeason.id,
                season,
                slot: updatedSlot,
            });
        } catch (err) {
            next(err);
        }
    }
);
