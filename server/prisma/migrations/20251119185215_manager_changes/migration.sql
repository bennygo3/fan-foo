-- DropForeignKey
ALTER TABLE "public"."RosterSlot" DROP CONSTRAINT "RosterSlot_playerId_fkey";

-- AlterTable
ALTER TABLE "RosterSlot" ALTER COLUMN "playerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
