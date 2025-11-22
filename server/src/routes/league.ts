import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { SlotType, Prisma } from "@prisma/client";

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
                            select: {id: true, username: true, email: true },
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
            orderBy: [{ teamId: "asc"}, { slot: "asc" }],
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
            const search = typeof req.query.search === "string" 
            ? req.query.search.trim() 
            : "";

            const position = typeof req.query.position === "string" 
            ? req.query.position.trim().toUpperCase() 
            : undefined;

            const teamAbbr = typeof req.query.team === "string"
            ? req.query.team.trim().toUpperCase()
            : undefined;

            const page = Math.max(1, typeof req.query.page === "string" 
                ? Number(req.query.page) 
                : 1
            );

            const limit = Math.min(100, Math.max(1, typeof req.query.limit === "string"
                ? Number(req.query.limit)
                : 100)
            );

            const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "name";

            const sortKey =
            sortRaw === "position"
            ? "position" 
            : sortRaw === "teamId"
            ? "teamId"
            :sortRaw === "proj" || sortRaw === "projPts"
            ? "projPts"
            : "name";

            const dir: Prisma.SortOrder =
            sortKey === "projPts"
            ? "desc"
            : typeof req.query.order === "string" && req.query.order.toLowerCase() === "desc"
            ? "desc"
            : "asc";

            const and: Prisma.PlayerWhereInput[] = [];

            if (search) {
                and.push({
                    name: { contains: search, mode: "insensitive" },
                });
            }

            if (position) {
                and.push({ position });
            }

            if (teamAbbr) {
                and.push({
                    team: {
                        abbr: { equals: teamAbbr, mode: "insensitive" },
                    },
                });
            }

            const where: Prisma.PlayerWhereInput = and.length ? { AND: and } : {};

            const skip = (page - 1) * limit;
            const take = limit;

            const orderBy: Prisma.PlayerOrderByWithRelationInput =
            sortKey === "name"
            ? { name: dir }
            : sortKey === "position"
            ? { position: dir }
            : sortKey === "teamId"
            ? { teamId: dir }
            : { projPts: dir };

            type PlayerWithAtts = Prisma.PlayerGetPayload<{
                include: {
                    team: true;
                    RosterSlot: {
                        include: {
                            team: true;
                        };
                    };
                };
            }>;

            const [players, total] = await Promise.all([
                prisma.player.findMany({
                    where, 
                    skip,
                    take,
                    orderBy,
                    include: {
                        team: true,
                        RosterSlot: {
                            where: { leagueId },
                            include: {
                                team: true,
                            },
                        },
                    },
                }) as Promise<PlayerWithAtts[]>,
                prisma.player.count({ where }),
            ]);

            const items = players.map((p) => {
                const firstSlot = p.RosterSlot[0];
                const unavailable = !!firstSlot;

                return {
                    id: p.id,
                    name: p.name,
                    position: p.position,
                    teamAbv: p.team?.abbr ?? null,
                    projPts: p.projPts,
                    headshot: null,
                    oppAbv: null,
                    kickoffIso: null,

                    available: !unavailable,

                    managedBy: unavailable && firstSlot?.team
                        ? {  
                            managerTeamName: firstSlot.team.name,
                        }
                    : null,
                };
            });

            res.json({ items, total, page, limit });
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
            return ["QB", "FLEX", "BN"];
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
                return res.status(404).json({ error: "Team not found in this league"});
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

            const emptySlot = await prisma.rosterSlot.findFirst({
                where: {
                    leagueId,
                    teamId,
                    playerId: null, 
                    slot: { in: candidateSlots },
                },
                orderBy: { id: "asc" },
            });

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
                        include: { team: true },
                    },
                    team: true,
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
                return res.status(404).json({ error: "Roster slot not found"})
            }

            if (slot.playerId == null) {
                return res.status(400).json({ error: "Roster slot already empty "});
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