/*
  Warnings:

  - You are about to drop the column `managerId` on the `FantasyTeam` table. All the data in the column will be lost.
  - You are about to drop the column `leagueId` on the `RosterSlot` table. All the data in the column will be lost.
  - You are about to drop the column `teamId` on the `RosterSlot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id,seasonId]` on the table `FantasyTeamSeason` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[leagueSeasonId,playerId]` on the table `RosterSlot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fantasyTeamSeasonId` to the `RosterSlot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `leagueSeasonId` to the `RosterSlot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RosterSlot` table without a default value. This is not possible if the table is not empty.

*/
-- Preserve the current manager/team assignments as the 2026 season.
INSERT INTO "LeagueSeason" (
  "leagueId",
  "season",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  "leagueId",
  2026,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "FantasyTeam"
ON CONFLICT ("leagueId", "season") DO NOTHING;

INSERT INTO "FantasyTeamSeason" (
  "seasonId",
  "fantasyTeamId",
  "managerId",
  "name",
  "createdAt",
  "updatedAt"
)
SELECT 
  league_season."id",
  fantasy_team."id",
  fantasy_team."managerId",
  fantasy_team."name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "FantasyTeam" AS fantasy_team
INNER JOIN "LeagueSeason" AS league_season
  ON league_season."leagueId" = fantasy_team."leagueId"
  AND league_season."season" = 2026
WHERE NOT EXISTS (
  SELECT 1
  FROM "FantasyTeamSeason" AS existing_team_season
  WHERE existing_team_season."seasonId" = league_season."id"
  AND existing_team_season."fantasyTeamId" = fantasy_team."id"
);

-- Existing roster assignments are disposable test data.
-- Everything else, including players and NFL teams, is preserved.
DELETE FROM "RosterSlot";

-- DropForeignKey
ALTER TABLE "FantasyTeam" DROP CONSTRAINT "FantasyTeam_managerId_fkey";

-- DropForeignKey
ALTER TABLE "RosterSlot" DROP CONSTRAINT "RosterSlot_teamId_fkey";

-- DropIndex
DROP INDEX "FantasyTeam_leagueId_managerId_idx";

-- DropIndex
DROP INDEX "FantasyTeam_leagueId_managerId_key";

-- DropIndex
DROP INDEX "RosterSlot_leagueId_playerId_key";

-- DropIndex
DROP INDEX "RosterSlot_leagueId_slot_idx";

-- DropIndex
DROP INDEX "RosterSlot_teamId_playerId_idx";

-- DropIndex
DROP INDEX "RosterSlot_teamId_playerId_key";

-- DropIndex
DROP INDEX "RosterSlot_teamId_slot_idx";

-- AlterTable
ALTER TABLE "FantasyTeam" DROP COLUMN "managerId";

-- AlterTable
ALTER TABLE "RosterSlot" DROP COLUMN "leagueId",
DROP COLUMN "teamId",
ADD COLUMN "fantasyTeamSeasonId" INTEGER NOT NULL,
ADD COLUMN "leagueSeasonId" INTEGER NOT NULL,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "FantasyTeam_leagueId_idx" ON "FantasyTeam"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeamSeason_id_seasonId_key" ON "FantasyTeamSeason"("id", "seasonId");

-- CreateIndex
CREATE INDEX "RosterSlot_fantasyTeamSeasonId_slot_idx" ON "RosterSlot"("fantasyTeamSeasonId", "slot");

-- CreateIndex
CREATE INDEX "RosterSlot_leagueSeasonId_slot_idx" ON "RosterSlot"("leagueSeasonId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_leagueSeasonId_playerId_key" ON "RosterSlot"("leagueSeasonId", "playerId");

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_fantasyTeamSeasonId_leagueSeasonId_fkey" FOREIGN KEY ("fantasyTeamSeasonId", "leagueSeasonId") REFERENCES "FantasyTeamSeason"("id", "seasonId") ON DELETE CASCADE ON UPDATE CASCADE;
