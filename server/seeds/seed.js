import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const teams = [
        { abbr: "MIN", name: "Minnesota Vikings" },
        { abbr: "DAL", name: "Dallas Cowboys" },
        { abbr: "LAR", name: "Los Angeles Rams" },
    ];

    await Promise.all(
        teams.map((t) => 
            prisma.team.upsert({
                where: {abbr: t.abbr },
                update: t,
                create: t,
            })
        )
    );
    console.log(`✅ Seeded ${teams.length} teams`);

    // Read players.json 
    const raw = readFileSync(path.join(__dirname, "players.json"), "utf8");
    const players = JSON.parse(raw);

    // Map team abbreviation 
    const teamsInDb = await prisma.team.findMany();
    const teamMap = Object.fromEntries(teamsInDb.map((t) => [t.abbr, t.id]));

    const data = players.map((p) => ({
        name: p.name,
        position: p.position,
        projPts: p.projPts ?? 0,
        adp: p.adp ?? 999,
        teamId: teamMap[p.team.abbr] ?? null,
    }));
    
    // Insert players 
    await prisma.player.createMany({ data, skipDuplicates: true });
    console.log(`Seeded ${data.length} players`);
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());