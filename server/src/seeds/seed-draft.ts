import { prisma } from "../lib/prisma";

const LEAGUE_NAME = "Forever Unclean";
const DRAFT_SEASON = 2026;
const DRAFT_ROUNDS = 16;

const DRAFT_ORDER = [
    { displayName: "Shea N", username: "SheaNo" },
    { displayName: "A Spicker", username: "AlSpi" },
    { displayName: "Kyle N", username: "KNo" },
    { displayName: "B Scho", username: "BScho" },
    { displayName: "M Huff", username: "MattH" },
    { displayName: "Miles M", username: "MilesMc" },
    { displayName: "Be Go", username: "BenG" },
    { displayName: "Andy M", username: "AndyMc" },
    { displayName: "C Lewis", username: "CLew" },
    { displayName: "Kevin G", username: "KevG" },
    { displayName: "J Karges", username: "JKarg" },
    { displayName: "Spencer M", username: "SpenceMc" },
] as const;

async function main() {
    const league = await prisma.league.findUnique({
        where: {
            name: LEAGUE_NAME,
        },
    });

    if (!league) {
        throw new Error(`League "${LEAGUE_NAME}" not found`);
    }

    const leagueSeason = await prisma.leagueSeason.findUnique({
        where: {
            leagueId_season: {
                leagueId: league.id,
                season: DRAFT_SEASON,
            },
        },
    });

    if (!leagueSeason) {
        throw new Error(
            `${LEAGUE_NAME} does not have a ${DRAFT_SEASON} season`
        );
    }

    const usernames = DRAFT_ORDER.map(
        (entry) => entry.username
    );

    const teamSeasons =
        await prisma.fantasyTeamSeason.findMany({
            where: {
                seasonId: leagueSeason.id,
                manager: {
                    is: {
                        username: {
                            in: usernames,
                        },
                    },
                },
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
        })
    ;

    const teamSeasonByUsername = new Map<string, (typeof teamSeasons)[number]>();

    for (const teamSeason of teamSeasons) {
        if (teamSeason.manager) {
            teamSeasonByUsername.set(
                teamSeason.manager.username,
                teamSeason
            );
        }
    }

    const missingManagers = DRAFT_ORDER.filter(
        (entry) => !teamSeasonByUsername.has(entry.username)
    );

    if (missingManagers.length) {
        throw new Error(
            `Missing 2026 team-season records for: ${missingManagers
                .map(
                    (entry) => 
                        `${entry.displayName} (${entry.username})`
                ).join(", ")
            }`
        );
    }

    const draft = await prisma.draft.upsert({
        where: {
            leagueSeasonId: leagueSeason.id,
        },
        update: {
            rounds: DRAFT_ROUNDS,
        },
        create: {
            leagueSeasonId: leagueSeason.id,
            rounds: DRAFT_ROUNDS,
        },
    });

    const existingPickCount =
        await prisma.draftPick.count({
            where: {
                draftId: draft.id,
            },
        })
    ;

    if (existingPickCount > 0) {
        throw new Error(
            "Draft order cannot be reseeded after picks have been made"
        );
    }

    const participantRows = DRAFT_ORDER.map(
        (entry, index) => {
            const teamSeason =
                teamSeasonByUsername.get(entry.username)
            ;

            if (!teamSeason) {
                throw new Error(
                    `Team season not found for ${entry.username}`
                );
            }

            return {
                draftId: draft.id,
                fantasyTeamSeasonId: teamSeason.id,
                draftPosition: index + 1,
            };
        }
    );

    await prisma.$transaction([
        prisma.draftParticipant.deleteMany({
            where: {
                draftId: draft.id,
            },
        }),
        prisma.draft.update({
            where: {
                id: draft.id,
            },
            data: {
                status: "SETUP",
                rounds: DRAFT_ROUNDS,
                currentOverallPick: 1,
                startedAt: null,
                completedAt: null,
            },
        }),
        prisma.draftParticipant.createMany({
            data: participantRows,
        }),
    ]);

    const savedOrder =
        await prisma.draftParticipant.findMany({
            where: {
                draftId: draft.id,
            },
            include: {
                fantasyTeamSeason: {
                    include: {
                        manager: {
                            select: {
                                username: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                draftPosition: "asc",
            },
        })
    ;

    console.log(`Created ${DRAFT_SEASON} draft with ${DRAFT_ROUNDS} rounds`);

    for (const participant of savedOrder) {
        console.log(`${participant.draftPosition}. ` + `${participant.fantasyTeamSeason.manager?.username ?? "No manager"} - ` + participant.fantasyTeamSeason.name);
    }
}

main()
    .catch((error) => {
        console.error("Failed to seed draft:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    })
;