import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

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