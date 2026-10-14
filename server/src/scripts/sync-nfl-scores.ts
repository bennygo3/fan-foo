import {
    mkdir,
    writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../lib/prisma";
import { tankGetScoresForDate } from "../routes/services/tank-call";

type TankScoreGame = {
    gameID?: string;
    homePts?: string | number | null;
    awayPts?: string | number | null;
    gameStatus?: string;
    gameStatusCode?: string | number;
};

type ScoreUpdate = {
    id: number;
    externalGameId: string;
    homeScore: number;
    awayScore: number;
    status: string;
};

function parseScore(
    value: unknown
): number | null {
    if (
        value === null || 
        value === undefined ||
        (
            typeof value === "string" &&
            value.trim() === ""
        )
    ) {
        return null;
    }

    const score = Number(value);

    if (
        !Number.isInteger(score) || 
        score < 0
    ) {
        return null;
    }

    return score;
}

function normalizeStatus(
    game: TankScoreGame,
    fallback: string
): string {
    switch (
        String(game.gameStatusCode ?? "")
    ) {
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
            const status = String(
                game.gameStatus ?? ""
            ) 
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "_"
                )
                .replace(
                    /^_+|_+$/g,
                    ""
                );

                return status || fallback;
        }
    }
}

function getGameDate(
    externalGameId: string
): string {
    const match = /^(\d{8})_/.exec(
        externalGameId.trim()
    );

    const gameDate = match?.[1];

    if (!gameDate) {
        throw new Error(
            `Cannot determine date from game ID: ${externalGameId}`
        );
    }

    return gameDate;
}

function extractScoreGames(
    response: any 
): TankScoreGame[] {
    const body = response?.body ?? response;

    if (Array.isArray(body)) {
        return body as TankScoreGame[];
    }

    if (
        body !== null &&
        typeof body === "object"
    ) {
        return Object.values(
            body as Record<
                string,
                TankScoreGame
            >
        );
    }

    throw new Error("Tank score response body was not an object or array");
}

async function main() {
    const season = Number(
        process.argv[2]
    );

    const week = Number(
        process.argv[3]
    );

    const dryRun =
        process.argv.includes(
            "--dry-run"
        );

    if (
        !Number.isInteger(season) ||
        season < 2000
    ) {
        throw new Error(
            "Provide a valid season"
        );
    }

    if (
        !Number.isInteger(week) ||
        week < 1 ||
        week > 18
    ) {
        throw new Error("Provide a week from 1 through 18");
    }

    const databaseGames =
        await prisma.game.findMany({
            where: {
                season,
                week,
            },
            select: {
                id: true,
                externalGameId: true,
                status: true,
            },
            orderBy: {
                startTime: "asc",
            },
        });

    if (databaseGames.length === 0) {
        throw new Error(`No database games found for ${season} Week ${week}`);
    }

    const gameDates = [
        ...new Set(
            databaseGames.map((game) => {
                if (!game.externalGameId) {
                    throw new Error(`Game ${game.id} is missing externalGameId`);
                }

                return getGameDate(
                    game.externalGameId
                );
            })
        ),
    ].sort();

    console.log(
        `${season} Week ${week} has ` +
        `${databaseGames.length} games across ` +
        `${gameDates.length} score request(s)`
    );

    console.log(`Dates: ${gameDates.join(", ")}`);

    if (dryRun) {
        console.log("Dry run completed. No Tank requests were made.");

        return;
    }

    const scoresByGameId = new Map<string, TankScoreGame>();

    const dataDirectory = resolve(
        process.cwd(),
        "data"
    );

    await mkdir(
        dataDirectory,
        {
            recursive: true,
        }
    );

    for (const gameDate of gameDates) {
        console.log(`Fetching scores for ${gameDate}...`);

        const response = await tankGetScoresForDate(gameDate);

        if (
            response?.statusCode !== undefined && 
            Number(response.statusCode) !== 
                200
        ) {
            throw new Error(
                `Tank returned staus ${String(response.statusCode)} ` +
                `for ${gameDate}`
            );
        }

        if (response?.error) {
            throw new Error(
                `Tank score error for ${gameDate}: ` +
                `${String(response.error)}`
            );
        }

        const snapshotPath = resolve(
            dataDirectory,
            `tank-nfl-scores-${gameDate}.json`
        );

        await writeFile(
            snapshotPath,
            `${JSON.stringify(
                response,
                null,
                2
            )}\n`,
            "utf8"
        );

        console.log(`Saved ${snapshotPath}`);

        const scoreGames = extractScoreGames(response);

        for (const scoreGame of scoreGames) {
            const externalGameId = 
                String(
                    scoreGame.gameID ?? ""
                ).trim();

            if (!externalGameId) {
                continue;
            }

            if (
                scoresByGameId.has(
                    externalGameId
                )
            ) {
                throw new Error(
                    `Duplicate score response for ${externalGameId}`
                );
            }

            scoresByGameId.set(
                externalGameId,
                scoreGame
            );
        }
    }

    const updates: ScoreUpdate[] = [];
    const skippedGames: string[] = [];

    for (const databaseGame of databaseGames) {
        const externalGameId = databaseGame.externalGameId!;

        const scoreGame = scoresByGameId.get(externalGameId);

        if (!scoreGame) {
            skippedGames.push(
                `${externalGameId}: no score response`
            );

            continue;
        }

        const homeScore = parseScore(scoreGame.homePts);
        const awayScore = parseScore(scoreGame.awayPts);

        if (
            homeScore === null ||
            awayScore === null
        ) {
            skippedGames.push(
                `${externalGameId}: incomplete score`
            );

            continue;
        }

        updates.push({
            id: databaseGame.id,
            externalGameId,
            homeScore,
            awayScore,
            status: normalizeStatus(
                scoreGame,
                databaseGame.status
            ),
        });
    }

    if (updates.length > 0) {
        await prisma.$transaction(
            updates.map((update) => 
                prisma.game.update({
                    where: {
                        id: update.id,
                    },
                    data: {
                        homeScore: update.homeScore,
                        awayScore: update.awayScore,
                        status: update.status,
                    },
                })
            )
        );
    }

    console.log(
        `Updated ${updates.length} of ` +
        `${databaseGames.length} games`
    );

    for (const update of updates) {
        console.log(
            `${update.externalGameId}: ` +
            `${update.awayScore}-` +
            `${update.homeScore}`
        );
    }

    if (skippedGames.length > 0) {
        console.log("Skipped games:");

        for (const skipped of skippedGames) {
            console.log(`- ${skipped}`);
        }
    }
}

main() 
    .catch((error) => {
        console.error(
            "Failed to sync NFL scores:",
            error
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });