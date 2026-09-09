import { prisma } from "../../lib/prisma";
import { tankGetPlayersList, tankGetTeamsWithRosters } from "./tank-call";
import {
    mapTanksPlayersListToDTO,
    mapTanksRostersToPlayersDTO,
    type PlayerDTO,
} from "../../mappers/tank-to-domain";
import { disconnect } from "process";

export async function syncTankPlayersToDb(season: string) {
    let dtos: PlayerDTO[];

    try {
        const raw = await tankGetPlayersList(season);
        dtos = mapTanksPlayersListToDTO(raw);
    } catch (primaryError) {
        console.warn(
            "[player sync] Player-list req failed; trying team rosters",
            primaryError
        );

        const raw = await tankGetTeamsWithRosters(season);

        dtos = mapTanksRostersToPlayersDTO(raw);
    }

    const playersByExternalId = new Map<string, PlayerDTO>();

    for (const player of dtos) {
        const externalId = String(
            player.id ?? ""
        ).trim();

        if (!externalId) continue;

        playersByExternalId.set(
            externalId,
            player
        );
    }

    if (playersByExternalId.size === 0) {
        throw new Error(`Tank returned no usable players for ${season}; existing players were left unchanged`);
    }

    const nflTeams = await prisma.team.findMany({
        select: {
            abbr: true,
        },
    });

    const knownTeamAbbreviations = new Set(
        nflTeams.map((team) =>
            team.abbr.toUpperCase()
        )
    );

    const unknownTeamAbbreviations = new Set<string>();

    const syncedAt = new Date();

    for (const [
        externalId,
        player,
    ] of playersByExternalId) {
        const teamAbbr = player.teamAbv
            ? player.teamAbv
                .trim()
                .toUpperCase()
            : null;

        const hasKnownTeam =
            teamAbbr !== null &&
            knownTeamAbbreviations.has(teamAbbr);

        const hasNoCurrentTeam =
            teamAbbr === null ||
            teamAbbr === "FA" ||
            teamAbbr === "UFA";

        if (
            teamAbbr &&
            !hasKnownTeam &&
            !hasNoCurrentTeam
        ) {
            unknownTeamAbbreviations.add(
                teamAbbr
            );
        }

        await prisma.player.upsert({
            where: {
                externalSrc_externalId: {
                    externalSrc: "tank",
                    externalId,
                },
            },
            create: {
                name: player.name,
                position: player.position,
                externalSrc: "tank",
                externalId,
                projPts: player.projPts ?? null,
                headshotUrl: player.headshot ?? null,
                adp: null,
                lastSyncedAt: syncedAt,
                isActive: true,

                ...(hasKnownTeam 
                    ? {
                        team: {
                            connect: {
                                abbr: teamAbbr,
                            },
                        },
                    }
                    : {}),
            },
            update: {
            name: player.name,
            position: player.position,
            projPts: player.projPts ?? null,
            headshotUrl: player.headshot ?? null,
            lastSyncedAt: syncedAt,
            isActive: true,

            ...(hasKnownTeam 
                ? {
                    team: {
                        connect: {
                            abbr: teamAbbr,
                        },
                    },
                }
            : hasNoCurrentTeam
                    ? {
                        team: {
                            disconnect: true,
                        },
                    }
                : {}),
            },
        });
    }

    const syncedExternalIds = Array.from(
        playersByExternalId.keys()
    );

    const deactivated =
        await prisma.player.updateMany({
            where: {
                externalSrc: "tank",
                position: {
                    not: "DST",
                },
                OR: [
                    {
                        externalId: null,
                    },
                    {
                        externalId: {
                            notIn: syncedExternalIds,
                        },
                    },
                ],
            },
            data: {
                isActive: false,
            },
        });

    console.log(`[player sync] synced ${playersByExternalId.size} active players for ${season}`);

    console.log(
        `[player sync] Marked ${deactivated.count} missing players inactive`
    );

    if (unknownTeamAbbreviations.size > 0) {
        console.warn(
            "[player sync unknown nfl team abbv:",
            Array.from(
                unknownTeamAbbreviations
            ).sort()
        );
    }
}