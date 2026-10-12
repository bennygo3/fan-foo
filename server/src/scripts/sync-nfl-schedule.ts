import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../lib/prisma";
import { tankGetSeasonSchedule } from "../routes/services/tank-call";

type TankGame = {
    away?: string;
    home?: string;
    gameID?: string;
    gameWeek?: string;
    gameTime_epoch?: string | number | null;
    gameStatus?: string;
    gameStatusCode?: string | number;
    season?: string | number;
    seasonType?: string;
};

type NormalizedGame = {
    season: number;
    week: number;
    away: string;
    home: string;
    startTime: Date | null;
    status: string;
    externalGameId: string;
};

const TEAM_ALIASES: Record<string, string> = {
    WAS: "WSH",
    JAC: "JAX",
};

function normalizeAbbreviation(value: unknown): string {
    const abbreviation = String(value ?? "")
        .trim()
        .toUpperCase();

    return TEAM_ALIASES[abbreviation] ?? abbreviation;
}

function parseWeek(value: unknown): number {
    const match = /^Week\s+(\d{1,2})$/i.exec(
        String(value ?? "").trim()
    );

    const week = Number(match?.[1]);

    if (!Number.isInteger(week) || week < 1 || week > 18) {
        throw new Error(`Invalid regular-season week: ${String(value)}`);
    }

    return week;
}

function parseStartTime(value: unknown): Date | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const epochSeconds = Number(value);

    if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) {
        return null;
    }

    const date = new Date(epochSeconds * 1000);

    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(game: TankGame): string {
    switch (String(game.gameStatusCode ?? "")) {
        case "0":
            return "scheduled";
        case "1":
            return "in_progress";
        case "2":
            return "final";
        case "3":
            return "postponed";
        case "4": 
            return "suspended";
        default: {
            const status = String(game.gameStatus ?? "scheduled")
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "");

            return status || "scheduled";
        }
    }
}

function normalizeGame(
    game: TankGame,
    requestedSeason: number
): NormalizedGame {
    const externalGameId = String(game.gameID ?? "").trim();

    if (!externalGameId) {
        throw new Error("Tank game is missing gameID");
    }

    const away = normalizeAbbreviation(game.away);
    const home = normalizeAbbreviation(game.home);

    if (!away || !home || away === home) {
        throw new Error(
            `Invalid matchup for ${externalGameId}: ${away} @ ${home}`
        );
    }

    return {
        season: requestedSeason,
        week: parseWeek(game.gameWeek),
        away,
        home,
        startTime: parseStartTime(game.gameTime_epoch),
        status: normalizeStatus(game),
        externalGameId,
    };
}

function validateSchedule(games: NormalizedGame[]): void {
    if (games.length !== 272) {
        throw new Error(
            `Expected 272 regular-season games, received ${games.length}`
        );
    }

    const externalIds = new Set<string>();
    const matchups = new Set<string>();
    const teamWeeks = new Set<string>();
    const teamGameCounts = new Map<string, number>();
    const weeks = new Set<number>();

    for (const game of games) {
        if (externalIds.has(game.externalGameId)) {
            throw new Error(
                `Duplicate external game ID: ${game.externalGameId}`
            );
        }

        externalIds.add(game.externalGameId);
        weeks.add(game.week);

        const matchupKey = `${game.season}:${game.week}:${game.away}@${game.home}`;

        if (matchups.has(matchupKey)) {
            throw new Error(`Duplicate matchup: ${matchupKey}`);
        }

        matchups.add(matchupKey);

        for (const team of [game.away, game.home]) {
            const teamWeekKey = `${game.week}:${team}`;

            if (teamWeeks.has(teamWeekKey)) {
                throw new Error(
                    `${team} appears more than once in Week ${game.week}`
                );
            }

            teamWeeks.add(teamWeekKey);
            teamGameCounts.set(
                team,
                (teamGameCounts.get(team) ?? 0) + 1
            );
        }
    }

    if (weeks.size !== 18) {
        throw new Error(
            `Expected 32 teams, found ${teamGameCounts.size}`
        );
    }

    for (const [team, count] of teamGameCounts) {
        if (count !== 17) {
            throw new Error(
                `${team} has ${count} games instead of 17`
            );
        }
    }
}

async function main() {
    const season = Number(process.argv[2]);

    if (!Number.isInteger(season) || season < 2000) {
        throw new Error(
            "Provide a valid season, for example: npm run sync:schedule -- 2026"
        );
    }

    console.log(`Fetching the ${season} NFL schedule...`);

    // single RapidAPI request:
    const response = await tankGetSeasonSchedule(season);

    if (
        response?.statusCode !== undefined &&
        Number(response.statusCode) !== 200
    ) {
        throw new Error(
            `Tank returned status ${String(response.statusCode)}`
        );
    }

    // save the provider response before transforming it:
    const snapshotPath = resolve(
        process.cwd(),
        "data",
        `tank-nfl-schedule-${season}.json`
    );

    await mkdir(dirname(snapshotPath), { recursive: true });
    await writeFile(
        snapshotPath,
        `${JSON.stringify(response, null, 2)}\n`,
        "utf8"
    );

    console.log(`Saved raw response to ${snapshotPath}`);

    const body = response?.body ?? response;

    if (!Array.isArray(body)) {
        throw new Error("Tank schedule body was not an array");
    }

    const regularSeasonGames = (body as TankGame[]).filter(
        (game) => 
            String(game.season) === String(season) &&
        String(game.seasonType)
            .trim()
            .toLowerCase() === "regular season"
    );

    const games = regularSeasonGames.map((game) => 
        normalizeGame(game, season)
    );

    // nothing has been written to the database yet...
    validateSchedule(games);

    const teams = await prisma.team.findMany({
        select: {
            id: true,
            abbr: true,
        },
    });

    const teamByAbbreviation = new Map(
        teams.map((team) => [
            team.abbr.toUpperCase(),
            team,
        ])
    );

    const missingTeams = [
        ...new Set(
            games.flatMap((game) => [game.away, game.home])
        ),
    ].filter(
        (abbreviation) => 
            !teamByAbbreviation.has(abbreviation)
    );

    if (missingTeams.length > 0) {
        throw new Error(
            `Teams missing from the database: ${missingTeams.join(", ")}`
        );
    }

    const existingGames = await prisma.game.findMany({
        where: {
            season,
        },
        select: {
            id: true,
            week: true,
            awayTeamId: true,
            homeTeamId: true,
            startTime: true,
        },
    });

    const existingByMatchup = new Map<string,(typeof existingGames)[number]>();

    for (const game of existingGames) {
        const key = 
            `${season}:${game.week}:` +
            `${game.awayTeamId}@${game.homeTeamId}`;

        if (existingByMatchup.has(key)) {
            throw new Error(
                `Duplicate existing database matchup: ${key}`
            );
        }

        existingByMatchup.set(key, game);
    }

    let created = 0;
    let updated = 0;

    const operations = games.map((game) => {
        const awayTeam = teamByAbbreviation.get(game.away)!;
        const homeTeam = teamByAbbreviation.get(game.home)!;

        const key = 
            `${season}:${game.week}:` + 
            `${awayTeam.id}@${homeTeam.id}`;

        const existing = existingByMatchup.get(key);

        const sharedData = {
            season,
            week: game.week,
            awayTeamId: awayTeam.id,
            homeTeamId: homeTeam.id,
            status: game.status,
            externalGameId: game.externalGameId,
            externalSrc: "tank",
        };

        if (existing) {
            updated++;

            return prisma.game.update({
                where: {
                    id: existing.id,
                },
                data: {
                    ...sharedData,

                    // do not erase a known time if Tank temporarily returns no kickoff time
                    startTime: game.startTime ?? existing.startTime,
                },
            });
        }

        created++;

        return prisma.game.create({
            data: {
                ...sharedData,
                startTime: game.startTime,
                isFlexed: false,
            },
        });
    });

    // all schedule changes succeed or all are rolled back
    await prisma.$transaction(operations);

    console.log(`Synced ${games.length} games:` + `${created} created, ${updated} updated`)
}

main()
    .catch((error) => {
        console.error("Failed to sync nfl schedule:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });