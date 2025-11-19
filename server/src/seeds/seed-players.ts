import { PrismaClient, type Prisma } from "@prisma/client";
import { tankGetPlayersList } from "../routes/services/tank-call";

const prisma = new PrismaClient();

function normalizeTankPlayer(
    raw: any,
    teamIndex: Record<string, number>
) : Prisma.PlayerCreateManyInput | null {
    // Determines team
    const teamAbbr = String(
        raw.team ??
        raw.teamID ??
        raw.teamId ??
        raw.teamAbbrev ??
        ""
    )
    .trim()
    .toUpperCase();

    const teamId = teamIndex[teamAbbr];

    if (!teamId) {
        console.warn(`No matching team for player ${raw.espnName} via abbr ${teamAbbr}`);
        return null;
    }

    // Determines position
    const pos = String(
        raw.pos ??
        raw.position ??
        raw.playerPosition ??
        ""
    )
    .trim()
    .toUpperCase();

    const ALLOWED_POS = new Set(["QB", "RB", "WR", "TE", "K", "DST", "D/ST"]);

    if (!ALLOWED_POS.has(pos)) {
        return null; // skips long snappers, punters, defensive positions, etc
    }

    const normalizedPos = pos === "DST" ? "D/ST" : pos;

    // determine external ID (preferred is ESPN)
    const extId = 
    raw.espnID ??
    raw.sleeperBotID ??
    raw.yahooPlayerID ??
    raw.rotoWirePlayerIDFull ??
    raw.id ??
    raw.playerID;

    if (!extId) return null;

    // Determines player name
    const name =
    raw.espnName ??
    raw.fullName ??
    raw.cbsLongName ??
    raw.sleeperName ??
    "Unknown Player";

    return {
        name,
        position: normalizedPos,
        externalId: String(extId),
        externalSrc: "tank",
        teamId,
        projPts: null,
        adp: null,
        lastSyncedAt: new Date(),
    };
}

async function seedPlayers() {
    console.log("🌱 Seeding NFL players");

    // Load teams from DB
    const teams = await prisma.team.findMany();

    const teamIndex: Record<string, number> = {};

    for (const t of teams as any[]) {
        const candidates = [
            t.abbr,
            t.code,
            t.shortName,
            t.teamAbbr,
            t.nickname,
        ];

        for (const raw of candidates) {
            if (typeof raw === "string" && raw.trim()) {
                teamIndex[raw.toUpperCase()] = t.id;
            }
        }
    }

    console.log("🔎 Loaded team index keys:", Object.keys(teamIndex).length);

    // Fetch all players from Tank
    const tankResp = await tankGetPlayersList("2025");
    const body = tankResp?.body ?? tankResp ?? {};

    const rawPlayers: any[] = 
    Array.isArray(body?.players) ? body.players : 
    Array.isArray(body?.playerList) ? body.playerList :
    Array.isArray(body) ? body :
    [];
    
    console.log(`⏳ Tank returned ${rawPlayers.length} raw players`);

    if (rawPlayers.length === 0) {
        console.error("⚠️ No players found from Tank. Check corresponding API");
        return;
    }

    console.log("👀 Sample raw player:", rawPlayers[0]);
    console.log("📝 Keys:", Object.keys(rawPlayers[0] || {}));

    const normalized: Prisma.PlayerCreateManyInput[] = rawPlayers
    .map((p) => normalizeTankPlayer(p, teamIndex))
    .filter((p): p is Prisma.PlayerCreateManyInput => !!p);

    console.log(`✅ Normalized ${normalized.length} players`);

    if (normalized.length === 0) {
        console.error("❌ Normalized 0 players - mapping error");
        return;
    }
    
    // Upsert players
    let created = 0;
    let updated = 0;

    for (const p of normalized) {
        const result = await prisma.player.upsert({
            where: { externalSrc_externalId: { 
                externalSrc: p.externalSrc ?? "tank",
                externalId: p.externalId!,
            },
         },
            update: {
                name: p.name,
                position: p.position,
                teamId: p.teamId,
                lastSyncedAt: new Date(),
            },
            create: {
                ...p,
                lastSyncedAt: p.lastSyncedAt ?? new Date(),
            },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
        } else {
            updated++;
        } 
    }

    console.log(`🥳 Done seeding players from Tank`);
    console.log(` Created: ${created}, Updated: ${updated}`);

}

seedPlayers().catch((err) => {
    console.error("❌ Player seed error", err);
}).finally(async () => {
    await prisma.$disconnect();
});

    
