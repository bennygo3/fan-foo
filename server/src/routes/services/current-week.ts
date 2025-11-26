import { prisma } from "../../lib/prisma";

export async function getCurrentSeasonWeek() {
    const now = new Date();

    // Find next game in the future 
    const nextGame = await prisma.game.findFirst({
        where: { startTime: { gte: now } },
        orderBy: { startTime: "asc" },
        select: { season: true, week: true },
    });

    if (nextGame) {
        return { season: nextGame.season, week: nextGame.week };
    }

    // If season is over, use the last game that already happened
    const lastGame = await prisma.game.findFirst({
        where: { startTime: { lte: now } },
        orderBy: { startTime: "desc" },
        select: { season: true, week: true },
    });

    if (lastGame) {
        return { season: lastGame.season, week: lastGame.week };
    }

    // Fallback shouldn't happen if schedule is seeded
    const year = now.getUTCFullYear();
    return { season: year, week: 1 };
}