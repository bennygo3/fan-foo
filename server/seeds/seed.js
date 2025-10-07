import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const raw = readFileSync(path.join(__dirname, "players.json"), "utf8");
    const players = JSON.parse(raw);
    await prisma.player.createMany({ data: players });
    console.log(`Seeded ${players.length} players`);
}

main().finally(() => prisma.$disconnect());