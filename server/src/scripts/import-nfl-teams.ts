import { prisma } from "src/lib/prisma";
import { tankGetTeamsWithRosters } from "src/routes/services/tank-call";

async function main() {
    const season = "2025";
    const api = await tankGetTeamsWithRosters(season);
    const rows: any[] = api?.body ?? [];

    for (const row of rows) {
        const abbr = String(row.teamAbv ?? "").toUpperCase();
        if (!abbr) continue;

        const name = row.teamName ?? (row.teamCity && row.teamName ? `${row.teamCity} ${row.teamName}` : abbr);

        const logoUrl = row.espnLogo1 ?? row.nflComLogo1 ?? null;

        const byeWeeks = row.byeWeeks ?? null;

        await prisma.team.upsert({
            where: { abbr },
            update: {name, logoUrl, byeWeeks },
            create: { abbr, name, logoUrl, byeWeeks },
        });
        console.log("Upserted team", abbr, name);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});