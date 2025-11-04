import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function leagueMain() {
    // const COMMISH_EMAIL: string = process.env.SEED_COMMISH_EMAIL ?? "commish@example.com";
    const COMMISH_EMAIL = (process.env.SEED_COMMISH_EMAIL ?? "commish@example.com") as string;
    const COMMISH_USERNAME = COMMISH_EMAIL.split("@")[0]!;
    const LEAGUE_NAME: string = process.env.SEED_LEAGUE_NAME ?? "Forever Unclean (2025)";

    const TEAM_NAMES: string[] = [
        "Rippin' Darts", "Lovullo For Prez", "The Dude Abides", "Snortin' Addis-on",
        "OMARION COMIN' YO!", "Lou Holtz", "BIG TRUZZ", "Achane Reaction",
        "THE CHAMP", "Skatt-Cat-ebo", "The Grave Digger", "Ricky's Rolex no TikTok",
    ];

    console.log("🌱 Seeding league, settings, teams...");

    // Commissioner user (global unique on email/username)
    const commish = await prisma.user.upsert({
        where: { email: COMMISH_EMAIL },
        update: { username: COMMISH_USERNAME },
        create: { email: COMMISH_EMAIL, username: COMMISH_USERNAME },
    });

    // League (unique name)
    const league = await prisma.league.upsert({
        where: { name: LEAGUE_NAME },
        update: {},
        create: { name: LEAGUE_NAME },
    });

    // League settings 1:1 with League id
    await prisma.leagueSettings.upsert({
        where: { leagueId: league.id },
        update: {}, // defaults are in schema
        create: { leagueId: league.id },
    });

    // fantasy teams, assign the commish to Team 1
    for (const [idx, name] of TEAM_NAMES.entries()) {
        await prisma.fantasyTeam.upsert({
            where: { leagueId_name: { leagueId: league.id, name } },
            update: idx === 0 ? { managerId: commish.id } : {},
            create: {
                name,
                leagueId: league.id,
                managerId: idx === 0 ? commish.id : null,
            },
        });
    }

    console.log(`✅ Seeded: 
        - Commissioner: ${commish.email} (id=${commish.id})
        - League: ${league.name} (id=${league.id})
        - Teams: ${TEAM_NAMES.length} (Team #1 managed by ${commish.username})
    `);
}

leagueMain()
    .catch((e) => {
        console.error("Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });