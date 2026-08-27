import { PrismaClient, SlotType } from "@prisma/client";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Forever Unclean";
const FANTASY_SEASON = 2026;

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

    const league = await prisma.league.findUnique({
        where: { name: LEAGUE_NAME },
    });

    if(!league) throw new Error("No league aqui- run script first");

    const leagueSeason = await prisma.leagueSeason.findUnique({
        where: {
            leagueId_season: {
                leagueId: league.id,
                season: FANTASY_SEASON,
            },
        },
    });

    if (!leagueSeason) {
        throw new Error(
            `${FANTASY_SEASON} league season was not found. Run the league seed first.`
        );
    }

    const teamSeasons = await prisma.fantasyTeamSeason.findMany({
        where: {
            seasonId: leagueSeason.id,
        }, 
        orderBy: {
            id: "asc",
        },
    });

    if (!teamSeasons.length) {
        throw new Error(
            `No fantasy-team seasons found for ${FANTASY_SEASON}`
        );
    }

    console.log(
        `🏈 Found ${teamSeasons.length} fantasy teams for ${FANTASY_SEASON}`
    );

    await prisma.rosterSlot.deleteMany({ 
        where: { 
            leagueSeasonId: leagueSeason.id,
        },
    });

    const rows = teamSeasons.flatMap((teamSeason) => 
        ROSTER_TEMPLATE.map((slot) => ({
            leagueSeasonId: leagueSeason.id,
            fantasyTeamSeasonId: teamSeason.id,
            slot,
        }))
    );

    console.log(`📥 Creating ${rows.length} empty slots...`);

    await prisma.rosterSlot.createMany({
        data: rows,
    });

    console.log("✅ Finished seeding roster template");
}

main().catch((err) => {
    console.error("❌ seed-roster-template failed", err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});