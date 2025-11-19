import { PrismaClient, SlotType } from "@prisma/client";

const prisma = new PrismaClient();

const ROSTER_TEMPLATE: SlotType[] = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "DST",
    "K",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "BN",
    "IR",
];

async function main() {
    console.log("🌱 Seeding empty roster templates for all fantasy teams");

    const league = await prisma.league.findFirst();
    if(!league) throw new Error("No league aqui- run script first");

    const teams = await prisma.fantasyTeam.findMany({
        where: { leagueId: league.id },
        orderBy: { id: "asc" },
    });

    if (!teams.length) throw new Error("No fantasy teams found for this league");

    console.log(`🏈 Found ${teams.length} fantasy teams`);

    await prisma.rosterSlot.deleteMany({ where: { leagueId: league.id } });

    const rows = [];

    for (const team of teams) {
        for (const slot of ROSTER_TEMPLATE) {
            rows.push({
                leagueId: league.id,
                teamId: team.id,
                slot,
                // playerId: null
            });
        }
    }

    console.log(`📥 Creating ${rows.length} empty slots...`);

    if (rows.length) {
        await prisma.rosterSlot.createMany({ data: rows, skipDuplicates: true });
    }

    console.log("✅ Finished seeding roster template");
}

main().catch((err) => {
    console.error("❌ seed-roster-template failed", err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
})