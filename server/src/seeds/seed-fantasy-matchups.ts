import { PrismaClient, FantasyMatchupType, FantasyMatchupStatus } from "@prisma/client";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Forever Unclean";
const SEASON = 2026;

const MANAGER_USERNAMES = [
    "JKarg",
    "SheaNo",
    "MilesMc",
    "KevG",
    "AndyMc",
    "BenG",
    "SpenceMc",
    "AlSpi",
    "MattH",
    "KNo",
    "BScho",
    "CLew",
] as const;

type ManagerUsername = (typeof MANAGER_USERNAMES[number]);

type ScheduleMatchup = readonly [
    homeManager: ManagerUsername,
    awayManager: ManagerUsername,
];

type ScheduleWeek = {
    week: number;
    matchups: readonly ScheduleMatchup[];
};

const FANTASY_SCHEDULE_2026: readonly ScheduleWeek[] = [
    {
        week: 1,
        matchups: [
            ["AlSpi", "SheaNo"],
            ["SpenceMc", "JKarg"],
            ["MilesMc", "MattH"],
            ["BScho", "KNo"],
            ["BenG", "AndyMc"],
            ["CLew", "KevG"],
        ],
    },
    {
        week: 2,
        matchups: [
            ["KNo", "SheaNo"],
            ["CLew", "JKarg"],
            ["KevG", "SpenceMc"],
            ["BenG", "MattH"],
            ["AndyMc", "MilesMc"],
            ["BScho", "AlSpi"],
        ],
    },
    {
        week: 3,
        matchups: [
            ["CLew", "SpenceMc"],
            ["MattH", "AndyMc"],
            ["BenG", "MilesMc"],
            ["JKarg", "KevG"],
            ["AlSpi", "KNo"],
            ["SheaNo", "BScho"],
        ],
    },
    {
        week: 4,
        matchups: [
            ["SheaNo", "MattH"],
            ["MilesMc", "KNo"],
            ["JKarg", "AlSpi"],
            ["CLew", "BScho"],
            ["AndyMc", "SpenceMc"],
            ["BenG", "KevG"],
        ],
    },
    {
        week: 5,
        matchups: [
            ["AlSpi", "KevG"],
            ["AndyMc", "KNo"],
            ["MattH", "CLew"],
            ["MilesMc", "SheaNo"],
            ["BenG", "SpenceMc"],
            ["JKarg", "BScho"],
        ],
    },
    {
        week: 6,
        matchups: [
            ["BScho", "MattH"],
            ["SheaNo", "BenG"],
            ["MilesMc", "SpenceMc"],
            ["JKarg", "AndyMc"],
            ["KNo", "KevG"],
            ["AlSpi", "CLew"],
        ],
    },
    {
        week: 7,
        matchups: [
            ["MattH", "SpenceMc"],
            ["KevG", "BScho"],
            ["SheaNo", "AndyMc"],
            ["KNo", "CLew"],
            ["AlSpi", "BenG"],
            ["MilesMc", "JKarg"],
        ],
    },
    {
        week: 8,
        matchups: [
            ["JKarg", "BenG"],
            ["SheaNo", "CLew"],
            ["KNo", "MattH"],
            ["BScho", "SpenceMc"],
            ["KevG", "MilesMc"],
            ["AndyMc", "AlSpi"],
        ],
    },
    {
        week: 9,
        matchups: [
            ["KevG", "SheaNo"],
            ["KNo", "SpenceMc"],
            ["AndyMc", "CLew"],
            ["BScho", "BenG"],
            ["MattH", "JKarg"],
            ["AlSpi", "MilesMc"],
        ],
    },
    {
        week: 10,
        matchups: [
            ["SpenceMc", "AlSpi"],
            ["SheaNo", "JKarg"],
            ["MattH", "KevG"],
            ["AndyMc", "BScho"],
            ["KNo", "BenG"],
            ["CLew", "MilesMc"],
        ],
    },
    {
        week: 11,
        matchups: [
            ["BenG", "CLew"],
            ["KevG", "AndyMc"],
            ["AlSpi", "MattH"],
            ["BScho", "MilesMc"],
            ["SheaNo", "SpenceMc"],
            ["KNo", "JKarg"],
        ],
    },
    {
        week: 12,
        matchups: [
            ["JKarg", "SpenceMc"],
            ["MattH", "MilesMc"],
            ["KNo", "BScho"],
            ["KevG", "CLew"],
            ["AndyMc", "BenG"],
            ["SheaNo", "AlSpi"],
        ],
    },
    {
        week: 13,
        matchups: [
            ["AlSpi", "BScho"],
            ["KevG", "SpenceMc"],
            ["AndyMc", "MilesMc"],
            ["CLew", "JKarg"],
            ["SheaNo", "KNo"],
            ["BenG", "MattH"],
        ],
    },
    {
        week: 14,
        matchups: [
            ["BScho", "SheaNo"],
            ["SpenceMc", "CLew"],
            ["AlSpi", "KNo"],
            ["MattH", "AndyMc"],
            ["MilesMc", "BenG"],
            ["KevG", "JKarg"],
        ],
    },
];

/*
 * Check the schedule before touching the database
 *
 * Each regular season week should:
 *  - Contain exactly 6 matchups
 *  - Contain all 12 managers
 *  - contain each manager exactly once
 *  - Never have a manager play himself
*/

function validateSchedule() {
    if (FANTASY_SCHEDULE_2026.length !== 14) {
        throw new Error(`Exected 14 regular-season weeks, found ${FANTASY_SCHEDULE_2026.length}.`);
    }

    const expectedManagers = new Set<string>(MANAGER_USERNAMES);
    const expectedWeeks = new Set(
        Array.from({ length: 14 }, (_, index) => index + 1)
    );

    for (const scheduleWeek of FANTASY_SCHEDULE_2026) {
        const { week, matchups } = scheduleWeek;

        if (!expectedWeeks.has(week)) {
            throw new Error(`Invalid fantasy week: ${week}`);
        }

        expectedWeeks.delete(week);

        if (matchups.length !== 6) {
            throw new Error(`Week ${week} should have 6 matchups, but has ${matchups.length}`);
        }

        const managersUsedThisWeek = new Set<string>();

        for (const [homeManager, awayManager] of matchups) {
            if (!expectedManagers.has(homeManager)) {
                throw new Error(`Unknown manager ${homeManager} in week ${week}.`);
            }

            if (!expectedManagers.has(awayManager)) {
                throw new Error(`Unknown manager ${awayManager} in week ${week}.`);
            }

            if (homeManager === awayManager) {
                throw new Error(`Week ${week} has ${homeManager} playing against themselves`);
            }

            for (const manager of [homeManager, awayManager]) {
                if (managersUsedThisWeek.has(manager)) {
                    throw new Error(`${manager} appears more than once in week ${week}`);
                }

                managersUsedThisWeek.add(manager);
            }
        }

        if (managersUsedThisWeek.size !== MANAGER_USERNAMES.length) {
            throw new Error(`Week ${week} contains ${managersUsedThisWeek.size} managers instead of ${MANAGER_USERNAMES.length}.`);
        }
    }

    if (expectedWeeks.size > 0) {
        throw new Error(`Missing fantasy weeks: ${Array.from(expectedWeeks).join(", ")}`);
    }

    const totalMatchups = FANTASY_SCHEDULE_2026.reduce(
        (total, scheduleWeek) => total + scheduleWeek.matchups.length,
        0
    );

    if (totalMatchups !== 84) {
        throw new Error(`Expected 84 regular season matchups, found ${totalMatchups}.`);
    }

    console.log(`✅ Schedule validation passed: ${totalMatchups} matchups across 14 weeks`);
}

async function seedFantasyMatchups() {
    console.log("🌱 seeding 2026 fantasy matchups...");

    // first make sure the hard-coded schedule itself is valid
    validateSchedule();

    // find the permanent league
    const league = await prisma.league.findUnique({
        where: {
            name: LEAGUE_NAME,
        },
    });

    if (!league) {
        throw new Error(`League "${LEAGUE_NAME}" was not found. Run seed-league.ts first`);
    }

    // find the 20-- LeagueSeason
    // FantasyMatchup belongs to LeagueSeason rather than directly to League
    const leagueSeason = await prisma.leagueSeason.findUnique({
        where: {
            leagueId_season: {
                leagueId: league.id,
                season: SEASON,
            },
        },
        include: {
            teams: {
                include: {
                    manager: true,
                },
            },
        },
    });

    if (!leagueSeason) {
        throw new Error(`${LEAGUE_NAME} does not have a ${SEASON} leagueseason. run seed-league.ts first`);
    }

    /* 
     * Build:
     *
     * username -> FantasyTeamSeason.id
     * 
     * Example:
     * 
     * "BenG" -> 6
     * "JKarg" -> 1
     * 
     * actual IDs depend on db, not hard-coded
    */

    const teamSeasonIdByUsername = new Map<string, number>();

    for (const teamSeason of leagueSeason.teams) {
        if (!teamSeason.manager) {
            continue;
        }

        teamSeasonIdByUsername.set(
            teamSeason.manager.username,
            teamSeason.id
        );
    }

    // verify that every manager used by the schedule has a corresponding FantasyTeamSeason record 
    for (const username of MANAGER_USERNAMES) {
        if (!teamSeasonIdByUsername.has(username)) {
            throw new Error(`Could not find a 2026 FantasyTeamSeason for manager "${username}".`);
        }
    }

    let createdCount = 0;
    let existingCount = 0;

    // run the actual insert work in one transaction.
    // 
    // if anything is wrong halfway through, the transaction rolls back instead of leaving with half a fantasy schedule
    await prisma.$transaction(async (tx) => {
        for (const scheduleWeek of FANTASY_SCHEDULE_2026) {
            for (const [homeManager, awayManager] of scheduleWeek.matchups) {
                const homeTeamSeasonId = teamSeasonIdByUsername.get(homeManager);

                const awayTeamSeasonId = teamSeasonIdByUsername.get(awayManager);

                if (!homeTeamSeasonId || !awayTeamSeasonId) {
                    throw new Error(`Missing FantasyTeamSeason ID for week ${scheduleWeek.week}: ${homeManager} vs ${awayManager}`);
                }


                // because of this compound unique constraint:
                // @@unique([seasonId, week, homeTeamSeasonId])
                // Prisma gives a generated unique lookup called:
                // seasonId_week_homeTeamSeasonId
                const existingMatchup =
                    await tx.fantasyMatchup.findUnique({
                        where: {
                            seasonId_week_homeTeamSeasonId: {
                                seasonId: leagueSeason.id,
                                week: scheduleWeek.week,
                                homeTeamSeasonId,
                            },
                        },
                    });

                if (existingMatchup) {
                    // if matchup is already seeded, leave it alone.
                    // important! because eventually the row will contain real scores
                    // and IN_PROGRESS or FINAL status. 
                    // Rerunning the seed should not wipe those out.
                    if (existingMatchup.awayTeamSeasonId !== awayTeamSeasonId) {
                        throw new Error(
                            [
                                `Schedule conflict in week ${scheduleWeek.week}`,
                                `${homeManager} already has a matchup in the database,`,
                                `but it is not again ${awayManager}`,
                            ].join(" ")
                        );
                    }

                    existingCount++;
                    continue;
                }

                // the Prisma unique constraints protect a team from appearing twice as HOME or twice as AWAY
                // but it does not prevent:
                // team 6 as home in one matchup AND team 6 as away in another matchup during the same week
                // so an explicit check for both colums here:
                const conflictingMatchup =
                    await tx.fantasyMatchup.findFirst({
                        where: {
                            seasonId: leagueSeason.id,
                            week: scheduleWeek.week,
                            OR: [
                                {
                                    homeTeamSeasonId: {
                                        in: [
                                            homeTeamSeasonId,
                                            awayTeamSeasonId,
                                        ],
                                    },
                                },
                                {
                                    awayTeamSeasonId: {
                                        in: [
                                            homeTeamSeasonId,
                                            awayTeamSeasonId,
                                        ],
                                    },
                                },
                            ],
                        },
                    });

                if (conflictingMatchup) {
                    throw new Error(
                        [
                            `Week ${scheduleWeek.week} contains a database conflict`,
                            `${homeManager} or ${awayManager} is already assigned to another matchup`,
                        ].join(" ")
                    );
                }

                await tx.fantasyMatchup.create({
                    data: {
                        seasonId: leagueSeason.id,
                        week: scheduleWeek.week,
                        homeTeamSeasonId,
                        awayTeamSeasonId,
                        type: FantasyMatchupType.REGULAR_SEASON,
                        status: FantasyMatchupStatus.SCHEDULED,
                    },
                });

                createdCount++;
            }
        }
    });

    console.log(`
        ✅ fantasy matchup seed complete:
            - League: ${league.name}
            - Season: ${leagueSeason.season}
            - Weeks: 14
            - Matchups expected: 84
            - Matchups created: ${createdCount}
            - Matchups already existed: ${existingCount}
    `);
}

async function main() {
    await seedFantasyMatchups();
}

main() 
    .catch((error) => {
        console.error("❌ fantasy matchup seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    })
;

