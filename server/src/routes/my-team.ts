import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { SlotType, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { getCurrentSeasonWeek } from "./services/current-week";
import { tankGetProjections, extractPlayerProjections, extractDSTProjections } from "./services/tank-call";
import { scoreDST } from "../scoring/dst";
import { parse } from "path";

export const myTeamRouter = express.Router();

function parsePositiveInteger(value: unknown): number | null {
    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        return null;
    }

    const normalized = typeof value === "string" ? value.trim() : value;

    if (normalized === "") return null;

    const number = Number(normalized);

    return Number.isInteger(number) && number > 0
        ? number
        : null
        ;
}

function readOptionalPositiveInteger(
    value: unknown
): number | null | undefined {
    if (value === undefined) return undefined;
    return parsePositiveInteger(value);
}

async function resolveSeasonAndWeek(
    req: Request
): Promise<
    | { season: number; week: number }
    | { error: string }
> {
    const requestedSeason = readOptionalPositiveInteger(
        req.query.season
    );
    const requestedWeek = readOptionalPositiveInteger(
        req.query.week
    );

    if (requestedSeason === null) {
        return { error: "Invalid season" };
    }

    if (requestedWeek === null) {
        return { error: "Invalid week" }
    }

    if (
        requestedSeason !== undefined &&
        requestedWeek !== undefined
    ) {
        return {
            season: requestedSeason,
            week: requestedWeek,
        };
    }

    const current = await getCurrentSeasonWeek();

    const currentSeason = parsePositiveInteger(current.season);
    const currentWeek = parsePositiveInteger(current.week);

    const season = requestedSeason ?? currentSeason;
    const week = requestedWeek ?? currentWeek;

    if (season === null) {
        return { error: "Unable to determine season" };
    }

    if (week === null) {
        return { error: "Unable to determine week" };
    }

    return { season, week };
}

// normalizes/verifies bye weeks for each player. Converts Prisma JSON into a predicatble bye-week object.
function jsonToByeWeeks(
    value: Prisma.JsonValue | null | undefined
): Record<string, number> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const output: Record<string, number> = {};

    for (const [season, byeWeek] of Object.entries(
        value as Record<string, unknown>
    )) {
        const number = typeof byeWeek === "number" ? byeWeek : Number(byeWeek);
        if (Number.isFinite(number)) output[season] = number;
    }

    return output;
}

function isGameLocked(kickoffIso: string | null): boolean {
    if (!kickoffIso) return false;

    const kickoffTime = Date.parse(kickoffIso);

    if (!Number.isFinite(kickoffTime)) return false;

    return kickoffTime <= Date.now();
}

function canSlotAcceptPlayer(
    slotType: SlotType,
    playerPos: string
): boolean {
    if (slotType === "BN") return true;
    if (slotType === "IR") return false; // need to: link data from an external call for weekly injury status
    if (slotType === "FLEX") {
        return (
            playerPos === "RB" ||
            playerPos === "WR" ||
            playerPos === "TE"
        );
    }

    return slotType === (playerPos as SlotType);
}

type DecoratedRosterSlot = {
    id: number;
    leagueSeasonId: number;
    fantasyTeamSeasonId: number;
    playerId: number | null;
    slot: SlotType;
    createdAt: Date,

    player: {
        id: number;
        name: string;
        position: string;
        externalId: string | null;
        projPts: number | null;
        headshotUrl: string | null;
        team: {
            id: number;
            abbr: string;
            name: string;
            logoUrl: string | null;
            byeWeeksBySeason: Record<string, number> | null;
        } | null;
    } | null;

    oppAbv: string | null;
    kickoffIso: string | null;
    isHome: boolean | null;
    projPts: number | null;
    livePts: number | null;
};

myTeamRouter.get(
    "/:leagueId/teams/:teamId/roster",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);
            const teamId = parsePositiveInteger(req.params.teamId);

            if (leagueId === null || teamId === null) {
                return res.status(400).json({ error: "Invalid leagueId or teamId", });
            }

            const seasonWeek = await resolveSeasonAndWeek(req);

            if ("error" in seasonWeek) {
                return res.status(400).json({
                    error: seasonWeek.error,
                });
            }

            const { season, week } = seasonWeek;

            const leagueSeason =
                await prisma.leagueSeason.findUnique({
                    where: {
                        leagueId_season: {
                            leagueId,
                            season,
                        },
                    },
                })
                ;

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            /*
            * The route's teamId remains the permanent FantasyTeam Id.
            * The roster belongs to that team's FantasyTeamSeason for the req year. 
            */
            const fantasyTeamSeason = 
                await prisma.fantasyTeamSeason.findUnique({
                    where: {
                        seasonId_fantasyTeamId: {
                            seasonId: leagueSeason.id,
                            fantasyTeamId: teamId,
                        },
                    },
                    include: {
                        fantasyTeam: {
                            include: {
                                league: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                        manager: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                })
            ;

            if (!fantasyTeamSeason || fantasyTeamSeason.fantasyTeam.leagueId !== leagueId) {
                return res.status(404).json({
                    error: `Team not found for the ${season} league season`,
                });
            }

            // load all roster slots for team
            const slots = await prisma.rosterSlot.findMany({
                where: {
                    leagueSeasonId: leagueSeason.id,
                    fantasyTeamSeasonId: fantasyTeamSeason.id,
                },
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
                orderBy: {
                    id: "asc",
                },
            });

            const games = await prisma.game.findMany({
                where: { season, week, },
                include: {
                    homeTeam: { select: { abbr: true }, },
                    awayTeam: { select: { abbr: true }, },
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

            const playerProjectionByExternalId = new Map<string, number>(); // playerID -> projPts
            const dstProjectionByTeam = new Map<string, number>(); // teamAbv -> projPts

            try {
                const projResp = await tankGetProjections({ season, week, });

                const playerProjections = extractPlayerProjections(projResp);
                
                for (const projection of playerProjections) {
                    const externalId = String(
                        projection?.playerID ?? 
                        projection?.espnID ?? 
                        ""
                    );

                    if (!externalId) continue;

                    const projectedPts = Number(
                        projection?.fantasyPoints ?? 
                        projection?.points 
                        ?? 
                        0
                    );
                    
                    playerProjectionByExternalId.set(
                        externalId, 
                        Number.isFinite(projectedPts) 
                        ? projectedPts 
                        : 0
                    );
                }

                const dstProjections = extractDSTProjections(projResp);
                
                for (const projection of dstProjections) {
                    const teamAbv = String(
                        projection?.teamAbv ?? 
                        projection?.team ?? 
                        ""
                    ).toUpperCase();

                    if (!teamAbv) continue;

                    const projectedPoints = scoreDST({
                        teamAbv: teamAbv,
                        sacks: Number(projection?.sacks ?? 0),
                        interceptions: Number(projection?.interceptions ?? 0),
                        fumbleRecoveries: Number(projection?.fumbleRecoveries ?? 0),
                        safeties: Number(projection?.safeties ?? 0),
                        defTD: Number(projection?.defTD ?? 0),
                        returnTD: Number(projection?.returnTD ?? 0),
                        blockKick: Number(projection?.blockKick ?? 0),
                        ptsAgainst: Number(projection?.ptsAgainst ?? 99),
                        yardsAgainst: Number(projection?.yardsAgainst ?? 0),
                    });

                    dstProjectionByTeam.set(teamAbv, projectedPoints);
                }
            } catch (error) {
                console.error("[roster] projection error:", error);
            }

            const decorated: DecoratedRosterSlot[] = slots.map((slot) => {
                const player = slot.player;

                const byeWeeksBySeason = jsonToByeWeeks(player?.team?.byeWeeksBySeason);

                const teamAbv = player?.team?.abbr ? player.team.abbr.toUpperCase() : null;
                const matchup = teamAbv ? matchupByTeamAbbr.get(teamAbv) : undefined;

                const byeWeek = byeWeeksBySeason?.[String(season)] ?? null;

                const isBye = byeWeek !== null && byeWeek === week;

                const oppAbv = matchup ? matchup.oppAbv : isBye ? "BYE" : null;
                
                const kickoffIso = matchup?.kickoffIso ?? null;

                let projPts: number | null = null;

                if (player) {
                    if (player.position === "DST") {
                        projPts = teamAbv
                            ? dstProjectionByTeam.get(teamAbv) ?? null
                            : null;
                    } else {
                        const externalProj = player.externalId
                            ? playerProjectionByExternalId.get(player.externalId) ?? null
                            : null;

                        projPts = externalProj ?? player.projPts ?? null;
                    }
                }

                return {
                    id: slot.id,
                    leagueSeasonId: slot.leagueSeasonId,
                    fantasyTeamSeasonId: slot.fantasyTeamSeasonId,
                    playerId: slot.playerId ?? null,
                    slot: slot.slot,
                    createdAt: slot.createdAt,

                    player: player
                        ? {
                            id: player.id,
                            name: player.name,
                            position: player.position,
                            externalId: player.externalId ?? null,
                            projPts: player.projPts ?? null,
                            headshotUrl: player.headshotUrl ?? null,
                            team: player.team
                                ? {
                                    id: player.team.id,
                                    abbr: player.team.abbr,
                                    name: player.team.name,
                                    logoUrl: player.team.logoUrl ?? null,
                                    byeWeeksBySeason,
                                }
                                : null,
                        }
                        : null,

                    oppAbv,
                    kickoffIso,
                    isHome: matchup?.isHome ?? null,
                    projPts,
                    livePts: null,
                };
            });

            const starters: DecoratedRosterSlot[] = [];
            const bench: DecoratedRosterSlot[] = [];
            const ir: DecoratedRosterSlot[] = [];

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

            starters.sort((first, second) => {
                const firstPriority = slotPriority[first.slot] ?? 999;
                const secondPriority = slotPriority[second.slot] ?? 999;

                if (firstPriority !== secondPriority) {
                    return firstPriority - secondPriority;
                } 

                return first.id - second.id;
            });

            // shape response for frontend
            res.json({
                leagueId,
                team: {
                    id: fantasyTeamSeason.fantasyTeam.id, // Permanent fantasyteam id
                    fantasyTeamSeasonId: fantasyTeamSeason.id, // this team's record for the selected year
                    name: fantasyTeamSeason.name, // use the historical name for this season
                    league: fantasyTeamSeason.fantasyTeam.league,
                    manager: fantasyTeamSeason.manager ?? null,
                },
                week,
                season,
                roster: { starters, bench, ir, },
            });
        } catch (error) {
            next(error);
        }
    }
);

myTeamRouter.post(
    "/:leagueId/teams/:teamId/roster/move",
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = parsePositiveInteger(req.params.leagueId);
            const teamId = parsePositiveInteger(req.params.teamId);

            if (leagueId === null || teamId === null) {
                return res.status(400).json({ error: "Invalid league id or team id" });
            }

            const fromRosterSlotId = parsePositiveInteger(req.body?.fromRosterSlotId);
            const toRosterSlotId = parsePositiveInteger(req.body?.toRosterSlotId);

            if (fromRosterSlotId === null || toRosterSlotId === null) {
                return res.status(400).json({ error: "Invalid move from/to" });
            }

            if (fromRosterSlotId === toRosterSlotId) {
                return res.json({ message: "No-op", moved: false });
            }

            const seasonWeek = await resolveSeasonAndWeek(req);

            if ("error" in seasonWeek) {
                return res.status(400).json({
                    error: seasonWeek.error,
                });
            }

            const { season, week} = seasonWeek;

            const leagueSeason =
                await prisma.leagueSeason.findUnique({
                    where: {
                        leagueId_season: {
                            leagueId,
                            season,
                        },
                    },
                })
            ;

            if (!leagueSeason) {
                return res.status(404).json({
                    error: `League season ${season} not found`,
                });
            }

            const fantasyTeamSeason =
                await prisma.fantasyTeamSeason.findUnique({
                    where: {
                        seasonId_fantasyTeamId: {
                            seasonId: leagueSeason.id,
                            fantasyTeamId: teamId,
                        },
                    },
                    include: {
                        fantasyTeam: {
                            select: {
                                leagueId: true,
                            },
                        },
                    },
                });

            if (
                !fantasyTeamSeason || fantasyTeamSeason.fantasyTeam.leagueId !== leagueId
            ) {
                return res.status(404).json({
                    error: `Team not found for the ${season} league's season`,
                });
            }

            const slots = await prisma.rosterSlot.findMany({
                where: {
                    id: { 
                        in: [
                            fromRosterSlotId, 
                            toRosterSlotId,
                        ],
                    },
                    leagueSeasonId: leagueSeason.id,
                    fantasyTeamSeasonId: fantasyTeamSeason.id,
                },
                include: {
                    player: {
                        include: {
                            team: { 
                                select: { 
                                    abbr: true, 
                                }, 
                            },
                        },
                    },
                },
            });

            const fromSlot = slots.find((slot) => slot.id === fromRosterSlotId) ?? null;
            const toSlot = slots.find((slot) => slot.id === toRosterSlotId) ?? null;

            if (!fromSlot || !toSlot) {
                return res.status(404).json({ error: "Roster slot not found for this team" });
            }

            if (!fromSlot.playerId || !fromSlot.player?.position) {
                return res.status(400).json({ error: "No player in source slot" });
            }

            // build kickoffByTeam from schedule
            const games = await prisma.game.findMany({
                where: { season, week, },
                include: { homeTeam: { select: { abbr: true, }, }, awayTeam: { select: { abbr: true, }, }, },
            });

            const kickoffByTeam = new Map<string, string | null>();
            
            for (const game of games) {
                const kickoffIso = game.startTime 
                    ? game.startTime.toISOString() 
                    : null
                ;

                kickoffByTeam.set(game.homeTeam.abbr.toUpperCase(), kickoffIso);
                kickoffByTeam.set(game.awayTeam.abbr.toUpperCase(), kickoffIso);
            }

            const fromTeamAbbr = fromSlot.player.team?.abbr?.toUpperCase() ?? null;
            const fromKickoff = fromTeamAbbr ? kickoffByTeam.get(fromTeamAbbr) ?? null : null;

            let toKickoff: string | null = null;

            if (toSlot.playerId && toSlot.player?.team?.abbr) {
                const toTeamAbbr = toSlot.player.team.abbr.toUpperCase();

                toKickoff = kickoffByTeam.get(toTeamAbbr) ?? null;
            }

            if (isGameLocked(fromKickoff) || isGameLocked(toKickoff)) {
                return res.status(409).json({ error: "Player is locked. Game has already started" });
            }

            const movingPos = fromSlot.player.position;

            if (!canSlotAcceptPlayer(toSlot.slot, movingPos)) {
                return res.status(409).json({
                    error: `Illegal move: ${movingPos} cannot go into ${toSlot.slot}`,
                });
            }

            // if swapping, validate the opposite direction too
            if (toSlot.playerId && toSlot.player?.position) {
                const otherPos = toSlot.player.position;
                if (!canSlotAcceptPlayer(fromSlot.slot, otherPos)) {
                    return res.status(409).json({
                        error: `Illegal swap: ${otherPos} cannot go into ${fromSlot.slot}`,
                    });
                }
            }

            // swapping players in lineup
            const result = await prisma.$transaction(
                async (
                    transaction: Prisma.TransactionClient
                ) => {
                const fromPlayerId = fromSlot.playerId!;
                const toPlayerId = toSlot.playerId ?? null;

                await transaction.rosterSlot.update({
                    where: { id: fromSlot.id },
                    data: { playerId: null },
                });

                await transaction.rosterSlot.update({
                    where: { id: toSlot.id },
                    data: { playerId: fromPlayerId, },
                });

                if (toPlayerId !== null) {
                    await transaction.rosterSlot.update({
                        where: { id: fromSlot.id },
                        data: { playerId: toPlayerId, },
                    });
                }

                return {
                    fromRosterSlotId: fromSlot.id,
                    toRosterSlotId: toSlot.id,
                    swapped: toPlayerId !== null,
                };
            });

            res.json({
                message: result.swapped ? "Swapped" : "Moved",
                ...result,
                leagueId,
                leagueSeasonId: leagueSeason.id,
                fantasyTeamSeasonId: fantasyTeamSeason.id,
                season,
                week,
            });
        } catch (error) {
            console.error("[roster/move] error:", error);
            next(error);
        }
    }
);