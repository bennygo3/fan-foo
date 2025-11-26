import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { SlotType, Prisma } from "@prisma/client";
import { getCurrentSeasonWeek } from "./services/current-week";
import { tankGetProjections, extractPlayerProjections } from "./services/tank-call";

export const leagueRouter = express.Router();

// Get /leagues; Returns all leagues
leagueRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const leagues = await prisma.league.findMany({
            include: {
                settings: true,
                teams: {
                    include: {
                        manager: {
                            select: { id: true, username: true, email: true },
                        },
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        res.json({ items: leagues });
    } catch (err) {
        next(err);
    }
});

// GET /leagues/:leagueId/teams; List teams in league with manager info
leagueRouter.get("/:leagueId/teams", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueId = Number(req.params.leagueId);
        if (!Number.isFinite(leagueId)) {
            return res.status(400).json({ error: "Invalid leagueId" });
        }

        const league = await prisma.league.findUnique({
            where: { id: leagueId },
            include: {
                settings: true,
                teams: {
                    include: {
                        manager: { select: { id: true, username: true, email: true } },
                    },
                    orderBy: { name: "asc" },
                },
            },
        });
        if (!league) {
            return res.status(404).json({ error: "League not found" });
        }

        res.json(league);
    } catch (err) {
        next(err);
    }
});

// Returns all rosters with players for the league
leagueRouter.get("/:leagueId/rosters", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueId = Number(req.params.leagueId);
        if (!Number.isFinite(leagueId)) {
            return res.status(400).json({ error: "Invalid league ID" });
        }

        const slots = await prisma.rosterSlot.findMany({
            where: { leagueId },
            include: {
                team: {
                    select: { id: true, name: true },
                },
                player: {
                    select: {
                        id: true,
                        name: true,
                        position: true,
                        team: { select: { abbr: true, name: true } },
                    },
                },
            },
            orderBy: [{ teamId: "asc" }, { slot: "asc" }],
        });

        res.json({ leagueId, items: slots });
    } catch (err) {
        next(err);
    }
});

leagueRouter.get(
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
            // const orderParam = typeof req.query.order === "string" ? req.query.order.toLowerCase() : "asc";
            const orderParam = typeof req.query.order === "string" ? req.query.order.toLowerCase() : undefined;
            
            const dir: "asc" | "desc" =
                sortRaw === "proj" || sortRaw === "projPts" 
            ?
                orderParam === "asc" ? "asc" : "desc"
            :   orderParam === "desc" ? "desc" : "asc";
            
            
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
            try {
                const projResp = await tankGetProjections({ week: String(week), season: String(season) });
                const rows = extractPlayerProjections(projResp);
                for (const r of rows) {
                    const id = String(r?.playerID ?? r?.espnID ?? "");
                    if (!id) continue;
                    const projPts = Number(r?.fantasyPoints ?? r?.points ?? 0);
                    projMap.set(id, { projPts: Number.isFinite(projPts) ? projPts : 0 });
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
                const proj = p.externalId ? projMap.get(p.externalId) : undefined;

                if (idx < 5) {
                    console.log("[player-pool] join debug", {
                        dbId: p.id,
                        name: p.name,
                        externalId: p.externalId,
                        hasProj: p.externalId ? projMap.has(p.externalId) : false,
                        proj,
                    });
                }

                const projPts = proj?.projPts ?? p.projPts ?? null;

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
                    managedBy: 
                        unavailable && slot?.team
                        ? {
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
                sorted.sort((a,b) => {
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
                    return dir === "asc" ? cmp: -cmp;
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

leagueRouter.post(
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

leagueRouter.post(
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
                message: "Plaer dropped",
                slot: updatedSlot,
            });
        } catch (err) {
            next(err);
        }
    }
);

leagueRouter.get(
    "/:leagueId/teams/:teamId/roster",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const teamId = Number(req.params.teamId);

            if (!Number.isFinite(leagueId) || !Number.isFinite(teamId)) {
                return res.status(400).json({ error: "Invalid leagueId or teamId" });
            }

            // Load team-manager
            const team = await prisma.fantasyTeam.findFirst({
                where: { id: teamId, leagueId },
                include: {
                    manager: {
                        select: { id: true, username: true, email: true },
                    },
                    league: {
                        select: { id: true, name: true },
                    },
                },
            });

            if (!team) {
                return res.status(404).json({ error: "Team no aqui" });
            }

            // Load all roster slots for this team
            const slots = await prisma.rosterSlot.findMany({
                where: { leagueId, teamId },
                include: {
                    player: {
                        include: {
                            team: {
                                select: { id: true, abbr: true, name: true },
                            },
                        },
                    },
                },
                orderBy: { id: "asc" },
            });

            // group into starters/bench/IR
            const startersOrder: SlotType[] = [
                "QB",
                "RB",
                "RB",
                "WR",
                "WR",
                "TE",
                "FLEX",
                "DST",
                "K",
            ];

            const starters: typeof slots = [];
            const bench: typeof slots = [];
            const ir: typeof slots = [];

            for (const slot of slots) {
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


// Scrapyard:
// from player-pool route:

// const sortKey: "name" | "position" | "teamId" | "projPts" =
// sortRaw === "position"
// ? "position"
// : sortRaw === "teamId"
// ? "teamId"
// :sortRaw === "proj" || sortRaw === "projPts"
// ? "projPts"
// : "name";

// const dir : Prisma.SortOrder =
// sortKey === "projPts"
// ? "desc"
// : typeof req.query.order === "string" && req.query.order.toLowerCase() === "desc"
// ? "desc"
// : "asc";

// free agents in this league
// const and: Prisma.PlayerWhereInput[] = [];

// players that aren't on a rosterSlot
// and.push({
//     RosterSlot: {
//         none: { leagueId },
//     },
// });