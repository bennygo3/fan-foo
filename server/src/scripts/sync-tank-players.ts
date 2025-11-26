import { syncTankPlayersToDb } from "../routes/services/sync-players";

async function main() {
    await syncTankPlayersToDb("2025");
    console.log("✅ Finished syncing Tank players DB");
}

main().catch((err) => {
    console.error("❌ sync-tank-players failed", err);
    process.exit(1);
});