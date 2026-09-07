import express from "express";
import type { Request, Response, NextFunction, } from "express";

import { prisma } from "../lib/prisma";

export const draftRouter = express.Router();

function parsePositiveInteger(
    value: unknown
): number | null {
    if (
        typeof value !== "string" && 
        typeof value !== "number"
    ) {
        return null;
    }

    const normalized =
        typeof value === "string"
        ? value.trim()
        : value
    ;

    if (normalized === "") return null;

    const number = Number(normalized);

    return Number.isInteger(number) && number > 0
        ? number
        : null
    ;
}

function getSnakePick(
    overallPick: number,
    participantCount: number
) {
    const round = Math.floor((overallPick - 1) / participantCount) + 1;

    const pickInRound = ((overallPick - 1) % participantCount) + 1;

    const draftPosition = round % 2 === 1
        ? pickInRound
        : participantCount - pickInRound + 1
    ;
    
    return {
        round,
        pickInRound,
        draftPosition,
    };
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

// GET /leagues/:leagueId/draft?season=2026
draftRouter.get(
    "/:leagueId/draft",
    async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);

            const season = parsePositiveInteger(req.query.season);

            if (leagueId === null) {
                return res.status(400).json({
                    error: "Invalid leagueId",
                });
            }

            if (season === null) {
                return res.status(400).json({
                    error: "A valid season is required",
                });
            }

            const leagueSeason = await findLeagueSeason(
                leagueId,
                season
            );

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            const draft = await prisma.draft.findUnique({
                where: {
                    leagueSeasonId: leagueSeason.id,
                },
                include: {
                    participants: {
                        orderBy: {
                            draftPosition: "asc",
                        },
                        include: {
                            fantasyTeamSeason: {
                                select: {
                                    id: true,
                                    name: true,
                                    fantasyTeamId: true,
                                    manager: {
                                        select: {
                                            id: true,
                                            username: true,
                                        },
                                    },
                                    fantasyTeam: {
                                        select: {
                                            id: true,
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    picks: {
                        orderBy: {
                            overallPick: "asc",
                        },
                        include: {
                            player: {
                                select: {
                                    id: true,
                                    name: true,
                                    position: true,
                                    headshotUrl: true,
                                    team: {
                                        select: {
                                            id: true,
                                            abbr: true,
                                            name: true,
                                            logoUrl: true,
                                        },
                                    },
                                },
                            },
                            fantasyTeamSeason: {
                                select: {
                                    id: true,
                                    name: true,
                                    fantasyTeamId: true,
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

            if (!draft) {
                return res.status(404).json({
                    error: `Draft not found for ${season}`,
                });
            }

            const participantCount = draft.participants.length;

            const totalPicks = participantCount * draft.rounds;

            let onClock = null;

            if (
                participantCount > 0 &&
                draft.currentOverallPick <= totalPicks &&
                draft.status !== "COMPLETED"
            ) {
                const pickPosition = getSnakePick(
                    draft.currentOverallPick,
                    participantCount
                );

                const participant = draft.participants.find((entry) => entry.draftPosition === pickPosition.draftPosition) ?? null;
                    
                if (participant) {
                    onClock = {
                        overallPick: draft.currentOverallPick,
                        round: pickPosition.round,
                        pickInRound: pickPosition.pickInRound,
                        draftPosition: pickPosition.draftPosition,
                        fantasyTeamSeason: participant.fantasyTeamSeason,
                    };
                }
            }

            res.json({
                leagueId,
                season,
                leagueSeasonId: leagueSeason.id,
                draft: {
                    id: draft.id,
                    status: draft.status,
                    rounds: draft.rounds,
                    currentOverallPick: draft.currentOverallPick, 
                    totalPicks,
                    startedAt: draft.startedAt,
                    completedAt: draft.completedAt,
                    participants: draft.participants,
                    picks: draft.picks,
                    onClock,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// PUT /leagues/...
draftRouter.put(
    "/:leagueId/draft/order",
    async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);

            const season = parsePositiveInteger(req.body?.season);

            if (leagueId === null) {
                return res.status(400).json({
                    error: "invalid leagueId",
                });
            }

            if (season === null) {
                return res.status(400).json({
                    error: "A valid season is required",
                });
            }

            const rawOrder = req.body?.fantasyTeamSeasonIds;

            if (!Array.isArray(rawOrder)) {
                return res.status(400).json({
                    error: "fantasyTeamSeasonIds must be an array",
                });
            }

            const orderedTeamSeasonIds = rawOrder.map(parsePositiveInteger);

            if (orderedTeamSeasonIds.some(
                (id) => id === null)
            ) {
                return res.status(400).json({
                    error: "Draft order contains an invalid team-season ID",
                });
            }
        
            const teamSeasonIds = orderedTeamSeasonIds as number[];

            if (new Set(teamSeasonIds).size !== teamSeasonIds.length) {
                return res.status(400).json({
                    error: "Draft order contains duplicate teams",
                });
            }

            const leagueSeason = await findLeagueSeason(
                leagueId,
                season
            );

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            const draft = await prisma.draft.findUnique({
                where: {
                    leagueSeasonId: leagueSeason.id,
                },
                include: {
                    _count: {
                        select: {
                            picks: true,
                        },
                    },
                },
            });

            if (!draft) {
                return res.status(404).json({
                    error: `Draft not found for ${season}`,
                });
            }

            if (
                draft.status !== "SETUP" ||
                draft._count.picks > 0
            ) {
                return res.status(409).json({
                    error: "Draft order cannot be changed after the draft starts",
                });
            }

            const leagueTeamSeasons = await prisma.fantasyTeamSeason.findMany({
                where: {
                    seasonId: leagueSeason.id,
                },
                select: {
                    id: true,
                },
            });

            const validIds = new Set(
                leagueTeamSeasons.map(
                    (teamSeason) => teamSeason.id
                )
            );

            if (
                teamSeasonIds.length !== validIds.size ||
                teamSeasonIds.some(
                    (id) => !validIds.has(id)
                )
            ) {
                return res.status(400).json({
                    error: "Draft order must contain every tema in the league season exactly once",
                });
            }

            await prisma.$transaction([
                prisma.draftParticipant.deleteMany({
                    where: {
                        draftId: draft.id,
                    },
                }),
                prisma.draftParticipant.deleteMany({
                    where: {
                        draftId: draft.id,
                    },
                }),
                prisma.draftParticipant.createMany({
                    data: teamSeasonIds.map(
                        (
                            fantasyTeamSeasonId,
                            index
                        ) => ({
                            draftId: draft.id,
                            fantasyTeamSeasonId,
                            draftPosition: index + 1,
                        })
                    ),
                }),
            ]);

            res.json({
                message: "Draft order updated",
                draftId: draft.id,
                season,
                teamCount: teamSeasonIds.length,
            });
        } catch(error) {
            next(error);
        }
    }
);

// POST /draft/start
draftRouter.post(
    "/:leagueId/draft/start",
    async(
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);

            const season = parsePositiveInteger(req.body?.season);

            if (leagueId === null) {
                return res.status(400).json({
                    error: "invalid leagueId",
                });
            }

            if (season === null) {
                return res.status(400).json({
                    error: "a valid season is req",
                });
            }

            const leagueSeason = await findLeagueSeason(
                leagueId,
                season
            );

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            const draft = await prisma.draft.findUnique({
                where: {
                    leagueSeasonId: leagueSeason.id,
                },
                include: {
                    participants: {
                        select: {
                            fantasyTeamSeasonId: true,
                        },
                    },
                    _count: {
                        select: {
                            picks: true,
                        },
                    },
                },
            });

            if (!draft) {
                return res.status(404).json({
                    error: `draft not found for ${season}`,
                });
            }

            if (draft.status === "IN_PROGRESS") {
                return res.json({
                    message: "Draft is already in progress",
                    draftId: draft.id,
                    status: draft.status,
                    currentOverallPick:
                    draft.currentOverallPick,
                });
            }

            if (draft.status !== "SETUP") {
                return res.status(409).json({
                    error: `draft cannot start while its status is ${draft.status}`,
                });
            }

            if (draft._count.picks > 0) {
                return res.status(409).json({
                    error: "a setup draft cannot already contain picks",
                });
            }

            if (draft.participants.length === 0) {
                return res.status(409).json({
                    error: "Draft has no participants",
                });
            }

            const participantIds = draft.participants.map(
                (participant) => participant.fantasyTeamSeasonId
            );

            const [slotCount, filledSlotCount] = await Promise.all([
                prisma.rosterSlot.count({
                    where: {
                        leagueSeasonId: leagueSeason.id,
                        fantasyTeamSeasonId: {
                            in: participantIds,
                        },
                    },
                }),
                prisma.rosterSlot.count({
                    where: {
                        leagueSeasonId: leagueSeason.id,
                        fantasyTeamSeasonId: {
                            in: participantIds,
                        },
                        playerId: {
                            not: null,
                        },
                    },
                }),
            ]);

            const expectedSlotCount = draft.participants.length * draft.rounds;

            if (slotCount !== expectedSlotCount) {
                return res.status(409).json({
                    error: `expected ${expectedSlotCount} roster slots but found ${slotCount}`,
                });
            }

            if (filledSlotCount > 0) {
                return res.status(409).json({
                    error: "all rosters must be empty before starting the draft",
                });
            }

            const startedAt = new Date();

            const updated = await prisma.draft.updateMany({
                where: {
                    id: draft.id,
                    status: "SETUP",
                },
                data: {
                    status: "IN_PROGRESS",
                    currentOverallPick: 1,
                    startedAt,
                    completedAt: null,
                },
            });

            if (updated.count !== 1) {
                return res.status(409).json({
                    error: "Draft status changed before it could be started",
                });
            }

            res.json({
                message: "draft started",
                draftId: draft.id,
                status: "IN_PROGRESS",
                currentOverallPick: 1,
                startedAt,
            });
        } catch (error) {
            next(error);
        }
    }
);