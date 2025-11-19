import { PrismaClient, Prisma } from "@prisma/client";
import schedule2025 from "./nfl-schedule-2025.json" assert { type: "json" };

const prisma = new PrismaClient();

type GameSeed = {
    week: number;
    season: number;
    away: string;
    home: string;
    timeET: string | null;
    localTime: string | null;
    startTime: string | null;
}

async function seedLeague() {
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

async function seedTeamsAndGames() {
    console.log("🌱 Seeding NFL Teams and Games...");

    const games = schedule2025 as GameSeed[];

    const abbrs = Array.from(
        new Set(games.flatMap((g) => [g.away, g.home]))
    );

    // Upsert Teams by abbr
    const teams = await prisma.$transaction(
        abbrs.map((abbr) => 
            prisma.team.upsert({
                where: { abbr },
                update: {},
                create: {
                    abbr,
                    name: abbr, // can be changed later to full team name
                },
            })
        )
    );

    const teamByAbbr = new Map(teams.map((t) => [t.abbr, t.id]));

    // Clear potential existing 2025 games to prevent duplicates
    await prisma.game.deleteMany({
        where: { season: 2025 },
    });

    // Build rows and validate startTime prior to hitting Prisma
    const gameRows = [];

    for (const g of games) {
        const awayTeamId = teamByAbbr.get(g.away);
        const homeTeamId = teamByAbbr.get(g.home);

        if (!homeTeamId || !awayTeamId) {
            throw new Error(`Unknown team abbr in schedule: ${g.away} vs ${g.home}`);
        }

        const base = {
            season: g.season,
            week: g.week,
            awayTeamId,
            homeTeamId,
        } as any;

        if (g.startTime) {
            const d = new Date(g.startTime);

            if (Number.isNaN(d.getTime())) {
                console.error("🚨 Invalid startTime in schedule JSON:");
                console.error(" raw startTime:", g.startTime);
                console.error(
                    ` game: season=${g.season}, week=${g.week}, ${g.away} @ ${g.home}`
                );
            }

            base.startTime = d;
        }

        gameRows.push(base);
    }
    
    // Insert all of the games
    await prisma.game.createMany({
        data: gameRows,
        skipDuplicates: true,
    });
    console.log(`✅ Seeded ${teams.length} teams and ${gameRows.length} games`);
}

async function main() {
    await seedLeague();
    await seedTeamsAndGames();
}

main().catch((e) => {
    console.error("seed failed:", e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});