import { prisma } from "../lib/prisma";
import { normalizeByeWeeksBySeason } from "../lib/byeWeeks";

async function main() {
    const teams = await prisma.team.findMany({
        select: {
            id: true,
            abbr: true,
            byeWeeks: true,
            byeWeeksBySeason: true,
        },
    });

    let updated = 0;

    for (const team of teams) {
        // skip teams that are already normalized
        if (team.byeWeeksBySeason) continue;

        const normalized = normalizeByeWeeksBySeason(team.byeWeeks);
        if (!normalized) continue;

        await prisma.team.update({
            where: { id: team.id },
            data: { byeWeeksBySeason: normalized },
        });

        updated++;
        console.log("Backfilled", team.abbr, normalized);
    }

    console.log(`Done. Updated ${updated} team(s)`)
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});