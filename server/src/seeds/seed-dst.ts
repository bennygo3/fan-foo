import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding DST psuedo-players...");

    const teams = await prisma.team.findMany();

    let created = 0;
    let updated = 0;

    for (const t of teams) {
        const abbr = t.abbr.toUpperCase();
        const name = `${t.name} D/ST`;

        const player = await prisma.player.upsert({
            where: {
                externalSrc_externalId: {
                    externalSrc: "tank-dst",
                    externalId: abbr,
                },
            },
            create: {
                name,
                position: "DST",
                teamId: t.id,
                externalSrc: "tank-dst",
                externalId: abbr,
                projPts: null,
                adp: null,
                lastSyncedAt: new Date(),
            },
            update: {
                name,
                position: "DST",
                teamId: t.id,
                lastSyncedAt: new Date(),
            },
        });

        if (player.createdAt.getTime() === player.updatedAt.getTime()) {
            created++;
        } else {
            updated++;
        }
    }

    console.log(`✅ D/ST seed complete. Created: ${created}, Updated: ${updated}`);
}

main().catch((err) => {
    console.error("😵 seed-dst failed", err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
})