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

// GET /:leagueId/matchups
// Returns fantasy matchups for a specific league season and week
leagueRouter.get(
    "/:leagueId/matchups",
    async (req: Request, res: Response, next: NextFunction) => {
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

            const week = parsePositiveInteger(req.query.week);

            if (week === null) {
                return res.status(400).json({
                    error: "Invalid or missing week",
                });
            }

            const league = await prisma.league.findUnique({
                where: {
                    id: leagueId,
                },
            });

            if (!league) {
                return res.status(404).json({
                    error: "League not found",
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
                            : `League season ${requestedSeason} not found`,
                });
            }

            const matchups = await prisma.fantasyMatchup.findMany({
                where: {
                    seasonId: leagueSeason.id,
                    week,
                },
                select: {
                    id: true,
                    week: true,
                    type: true,
                    status: true,
                    homeScore: true,
                    awayScore: true,

                    homeTeamSeason: {
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

                    awayTeamSeason: {
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
                },
                orderBy: {
                    id: "asc",
                },
            });

            const items = matchups.map((matchup) => ({
                id: matchup.id,
                week: matchup.week,
                type: matchup.type,
                status: matchup.status,

                homeTeam: {
                    teamSeasonId: matchup.homeTeamSeason.id,
                    fantasyTeamId: matchup.homeTeamSeason.fantasyTeam.id,
                    teamName: matchup.homeTeamSeason.name,
                    manager: matchup.homeTeamSeason.manager,
                    score: matchup.homeScore === null 
                        ? null
                        : Number(matchup.homeScore),
                },

                awayTeam: {
                    teamSeasonId: matchup.awayTeamSeason.id,
                    fantasyTeamId: matchup.awayTeamSeason.fantasyTeam.id,
                    teamName: matchup.awayTeamSeason.name,
                    manager: matchup.awayTeamSeason.manager,
                    score: matchup.awayScore === null 
                        ? null
                        : Number(matchup.awayScore),
                },
            }));

            res.json({
                league: {
                    id: league.id,
                    name: league.name,
                },

                leagueSeason: {
                    id: leagueSeason.id,
                    season: leagueSeason.season,
                },
                week,

                items,
            });
        } catch (err) {
            next(err);
        }
    }
);

// GET /:leagueId/standings
// Returns season standings plus each team's matchup for the requested week
leagueRouter.get(
    "/:leagueId/standings",
    async (req: Request, res: Response, next: NextFunction) => {
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

            const week = parsePositiveInteger(req.query.week);

            if (week === null) {
                return res.status(400).json({
                    error: "Invalid or missing week ",
                });
            }

            const league = await prisma.league.findUnique({
                where: {
                    id: leagueId,
                },
            });

            if (!league) {
                return res.status(404).json({
                    error: "League not found",
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
                            : `League season ${requestedSeason} not found`,
                });
            }

            // get all 12 teams for this season
            const teamSeasons = await prisma.fantasyTeamSeason.findMany({
                where: {
                    seasonId: leagueSeason.id,
                },
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
            });

            // get reg season matchups thru the requested week
            // FINAL games affect standings.
            // the requested week's matchup is also used for currentMatchup
            const matchups = await prisma.fantasyMatchup.findMany({
                where: {
                    seasonId: leagueSeason.id,
                    type: "REGULAR_SEASON",
                    week: {
                        lte: week,
                    },
                },
                orderBy: [
                    {
                        week: "asc",
                    },
                    {
                        id: "asc",
                    },
                ],
            });

            type StandingRow = {
                teamSeasonId: number;
                fantasyTeamId: number;
                teamName: string;
                manager: {
                    id: number;
                    username: string;
                } | null;

                wins: number;
                losses: number;

                pointsFor: number,
                pointsAgainst: number;

                currentMatchup: {
                    matchupId: number;
                    opponentTeamSeasonId: number;
                    opponentFantasyTeamId: number;
                    opponentTeamName: string;
                    opponentManager: {
                        id: number;
                        username: string;
                    } | null;
                    teamScore: number | null;
                    opponentScore: number | null;
                    status: string;
                } | null;
            };

            // create one empty standings row per team
            const standingsByTeamSeasonId = new Map<number, StandingRow>();

            for (const teamSeason of teamSeasons) {
                standingsByTeamSeasonId.set(teamSeason.id, {
                    teamSeasonId: teamSeason.id,
                    fantasyTeamId: teamSeason.fantasyTeam.id,
                    teamName: teamSeason.name,
                    manager: teamSeason.manager,

                    wins: 0,
                    losses: 0,

                    pointsFor: 0,
                    pointsAgainst: 0,

                    currentMatchup: null,
                });
            }

            // Loop thru the matchups and calculate standings
            for (const matchup of matchups) {
                const homeStanding = standingsByTeamSeasonId.get(
                    matchup.homeTeamSeasonId
                );

                const awayStanding = standingsByTeamSeasonId.get(
                    matchup.awayTeamSeasonId
                );

                if (!homeStanding || !awayStanding) {
                    throw new Error(
                        `Can't find standings row for matchup ${matchup.id}`
                    );
                }

                // only completed games affect w-l and pf,pa
                if (
                    matchup.status === "FINAL" &&
                    matchup.homeScore !== null &&
                    matchup.awayScore !== null
                ) {
                    const homeScore = Number(matchup.homeScore);
                    const awayScore = Number(matchup.awayScore);

                    homeStanding.pointsFor += homeScore;
                    homeStanding.pointsAgainst += awayScore;

                    awayStanding.pointsFor += awayScore;
                    awayStanding.pointsAgainst += homeScore;

                    if (homeScore > awayScore) {
                        homeStanding.wins++;
                        awayStanding.losses++;
                    } else if (awayScore > homeScore) {
                        awayStanding.wins++;
                        homeStanding.losses++;
                    }
                }

                // the requested week's game becomes currentMatchup
                // this works whether the matchup is:
                // SCHEDULE || IN_PROGRESS || FINAL
                if (matchup.week === week) {
                    homeStanding.currentMatchup = {
                        matchupId: matchup.id,
                        opponentTeamSeasonId: awayStanding.teamSeasonId,
                        opponentFantasyTeamId: awayStanding.fantasyTeamId,
                        opponentTeamName: awayStanding.teamName,
                        opponentManager: awayStanding.manager,
                        teamScore: matchup.homeScore === null
                            ? null
                            : Number(matchup.homeScore),
                        opponentScore: matchup.awayScore === null
                            ? null 
                            : Number(matchup.awayScore),

                        status: matchup.status,
                    };

                    awayStanding.currentMatchup = {
                        matchupId: matchup.id,
                        opponentTeamSeasonId: homeStanding.teamSeasonId,
                        opponentFantasyTeamId: homeStanding.fantasyTeamId,
                        opponentTeamName: homeStanding.teamName,
                        opponentManager: homeStanding.manager,
                        teamScore: matchup.awayScore === null
                            ? null
                            : Number(matchup.awayScore),
                        opponentScore: matchup.homeScore === null
                            ? null 
                            : Number(matchup.homeScore),

                        status: matchup.status,
                    };

                }
            }

            const items = Array.from(
                standingsByTeamSeasonId.values()
            ).map((standing) => ({
                ...standing,

                // prevent weird floating-point output such as:
                // 127.420000000000002.
                pointsFor: Number(
                    standing.pointsFor.toFixed(2)
                ),

                pointsAgainst: Number(
                    standing.pointsAgainst.toFixed(2)
                ),
            })).sort((a, b) => {
                // First: most wins
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }

                // fewest losses
                if (a.losses !== b.losses) {
                    return a.losses - b.losses;
                }

                // most points scored sort
                if (b.pointsFor !== a.pointsFor) {
                    return b.pointsFor - a.pointsFor
                }

                // final fallback: team name
                return a.teamName.localeCompare(b.teamName);
            });

            res.json({
                league: {
                    id: league.id,
                    name: league.name,
                },

                leagueSeason: {
                    id: leagueSeason.id,
                    season: leagueSeason.season,
                },

                week,
                items,
            });
        } catch (err) {
            next(err);
        }
    }
);

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
            leagueSeasonId: {
                id: leagueSeason.id,
                season: leagueSeason.season,
            },
            items: slots,
        });
    } catch (err) {
        next(err);
    }
});