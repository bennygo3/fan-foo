import { prisma } from "../lib/prisma";
import { tankGetTeamsWithRosters } from "../routes/services/tank-call";
import { normalizeByeWeeksBySeason } from "../lib/byeWeeks";

async function main() {
    const season = "2025";
    const api = await tankGetTeamsWithRosters(season);
    const rows: any[] = api?.body ?? [];

    for (const row of rows) {
        const abbr = String(row.teamAbv ?? "").toUpperCase();
        
        if (!abbr) continue;

        const name = row.teamName ?? (row.teamCity && row.teamName ? `${row.teamCity} ${row.teamName}` : abbr);

        const logoUrl = row.espnLogo1 ?? row.nflComLogo1 ?? null;

        const rawByeWeeks = row.byeWeeks ?? null;

        const byeWeeksBySeason = normalizeByeWeeksBySeason(rawByeWeeks);

        await prisma.team.upsert({
            where: { abbr, },
            update: {
                name, 
                logoUrl, 
                ...(byeWeeksBySeason ? { byeWeeksBySeason } : {}), 
            },
            create: { 
                abbr, 
                name, 
                logoUrl, 
                ...(byeWeeksBySeason ? { byeWeeksBySeason } : {}), },
        });
        console.log("Upserted team", abbr, name);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});