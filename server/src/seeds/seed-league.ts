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

    const TEAM_MANAGERS = [
        { teamName: "Rippin' Darts", email: "jKarg@example.com", username: "JKarg"},
        { teamName: "Lovullo For Prez", email: "sheaNo@example.com", username: "SheaNo" },
        { teamName: "The Dude Abides", email: "milesMc@example.com", username: "MilesMc" },
        { teamName: "Snortin' Addis-on", email: "KevG@example.com", username: "KevG" },
        { teamName: "OMARION COMIN' YO!", email: "AndyMc@example.com", username: "AndyMc" },
        { teamName: "Lou Holtz", email: "BenG@example.com", username: "BenG" },
        { teamName: "BIG TRUZZ", email: "SpenceMc@example.com", username: "SpenceMc" },
        { teamName: "Achane Reaction", email: "AlSpi@example.com", username: "AlSpi" },
        { teamName: "THE CHAMP", email: "MattH@example.com", username: "MattH" },
        { teamName: "Skatt-Cat-ebo", email: "kNo@example.com", username: "KNo" },
        { teamName: "The Grave Digger", email: "bScho@example.com", username: "BScho" },
        { teamName: "Ricky's Rolex no TikTok", email: "cLew@example.com", username: "CLew" },
    ];

async function seedLeague() {
    const LEAGUE_NAME = "Forever Unclean";

    console.log("🌱 Seeding league, settings, teams...");

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

    const usersByTeamName = new Map<string, { id: number; email: string; username: string }>();

    for (const mgr of TEAM_MANAGERS) {
        const user = await prisma.user.upsert({
            where: { email: mgr.email },
            update: { username: mgr.username },
            create: {
                email: mgr.email,
                username: mgr.username,
            },
        });

        usersByTeamName.set(mgr.teamName, {
            id: user.id,
            email: user.email,
            username: user.username,
        });
    }

    for (const mgr of TEAM_MANAGERS) {
        const u = usersByTeamName.get(mgr.teamName);
        if(!u) {
            throw new Error(`No user found for team ${mgr.teamName}`);
        }

        await prisma.fantasyTeam.upsert({
            where: {
                leagueId_name: {
                    leagueId: league.id,
                    name: mgr.teamName,
                },
            },
            update: {
                managerId: u.id,
            },
            create: {
                name: mgr.teamName,
                leagueId: league.id,
                managerId: u.id,
            },
        });
    }

    console.log(`✅ Seeded: 
        - League: ${league.name} (id=${league.id})
        - Teams: ${TEAM_MANAGERS.length})
        - Managers: ${TEAM_MANAGERS.map((t) => t.username).join(", ")}
        - Commissioner: "The Grave Digger" (BScho)

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