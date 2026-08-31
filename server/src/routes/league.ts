import express from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export const leagueRouter = express.Router();

function parsePositiveInteger(value: unknown): number | null {
    if (typeof value !== "string") return null;

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return null;
    }

    return parsed;
}

function readOptionalSeason(req: Request): number | null | undefined {
    if (req.query.season === undefined) {
        return undefined;
    }

    return parsePositiveInteger(req.query.season);
}

async function findLeagueSeason(
    leagueId: number,
    season?: number
) {
    if (season !== undefined) {
        return prisma.leagueSeason.findUnique({
            where: {
                leagueId_season: {
                    leagueId,
                    season,
                },
            },
        });
    }

    return prisma.leagueSeason.findFirst({
        where: {
            leagueId,
        },
        orderBy: {
            season: "desc",
        },
    });
}

// Get /leagues; Returns leagues with their seasons and seasonal teams
leagueRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const leagues = await prisma.league.findMany({
            include: {
                settings: true,
                seasons: {
                    include: {
                        teams: {
                            include: {
                                fantasyTeam: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                                manager: {
                                    select: {
                                        id: true,
                                        username: true,
                                    },
                                },
                            },
                            orderBy: {
                                name: "asc",
                            },
                        },
                    },
                    orderBy: {
                        season: "desc",
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        res.json({ items: leagues, });
    } catch (err) {
        next(err);
    }
});

// GET /leagues/:leagueId/teams; Lists seasonal fantasy teams with manager info
leagueRouter.get("/:leagueId/teams", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueId = parsePositiveInteger(req.params.leagueId);

        if (leagueId === null) {
            return res.status(400).json({
                error: "Invalid leagueId",
            });
        }

        const requestedSeason = readOptionalSeason(req);

        if (requestedSeason === null) {
            return res.status(400).json({
                error: "Invalid season",
            });
        }

        const league = await prisma.league.findUnique({
            where: { id: leagueId },
            include: {
                settings: true,
            },
        });

        if (!league) {
            return res.status(404).json({ error: "League not found" });
        }

        const leagueSeason = await findLeagueSeason(
            leagueId,
            requestedSeason
        );

        if (!leagueSeason) {
            return res.status(404).json({
                error:
                    requestedSeason === undefined
                        ? "No seasons found for this league"
                        : `League season ${requestedSeason} not found`,
            });
        }

        const teamSeasons = await prisma.fantasyTeamSeason.findMany({
            where: {
                seasonId: leagueSeason.id,
            },
            include: {
                fantasyTeam: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                manager: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        res.json({
            league: {
                id: league.id,
                name: league.name,
            },
            settings: league.settings,
            leagueSeason: {
                id: leagueSeason.id,
                season: leagueSeason.season,
            },
            items: teamSeasons,
        });
    } catch (err) {
        next(err);
    }
});

// Returns all rosters with players for the league
leagueRouter.get("/:leagueId/rosters", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueId = parsePositiveInteger(req.params.leagueId);

        if (leagueId === null) {
            return res.status(400).json({ error: "Invalid league ID", });
        }

        const requestedSeason = readOptionalSeason(req);

        if (requestedSeason === null) {
            return res.status(400).json({
                error: "Invalid season",
            });
        }

        const leagueSeason = await findLeagueSeason(
            leagueId,
            requestedSeason
        ); 

        if (!leagueSeason) {
            return res.status(404).json({
                error:
                    requestedSeason === undefined
                        ? "No seasons found for this league"
                        : `League seasons ${requestedSeason} not found`,
            });
        }

        const slots = await prisma.rosterSlot.findMany({
            where: {
                leagueSeasonId: leagueSeason.id,
            },
            include: {
                fantasyTeamSeason: {
                    select: {
                        id: true,
                        name: true,
                        fantasyTeam: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        manager: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                },
                player: {
                    select: {
                        id: true,
                        name: true,
                        position: true,
                        team: {
                            select: {
                                abbr: true,
                                name: true
                            },
                        },
                    },
                },
            },
            orderBy: [
                {
                    fantasyTeamSeasonId: "asc",
                },
                {
                    slot: "asc",
                },
                {
                    id: "asc",
                },
            ],
        });

        res.json({
            leagueId,
            leagueSeasonId: leagueSeason,
            items: slots,
        });
    } catch (err) {
        next(err);
    }
});