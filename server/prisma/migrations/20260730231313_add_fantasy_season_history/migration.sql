/*
  Warnings:

  - You are about to drop the column `byeWeeks` on the `Team` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FantasyMatchupType" AS ENUM ('REGULAR_SEASON', 'PLAYOFF', 'CONSOLATION', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "FantasyMatchupStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL');

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "byeWeeks";

-- CreateTable
CREATE TABLE "LeagueSeason" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeamSeason" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "fantasyTeamId" INTEGER NOT NULL,
    "managerId" INTEGER,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyTeamSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyMatchup" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "homeTeamSeasonId" INTEGER NOT NULL,
    "awayTeamSeasonId" INTEGER NOT NULL,
    "homeScore" DECIMAL(10,2),
    "awayScore" DECIMAL(10,2),
    "type" "FantasyMatchupType" NOT NULL DEFAULT 'REGULAR_SEASON',
    "status" "FantasyMatchupStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyMatchup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueSeason_season_idx" ON "LeagueSeason"("season");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSeason_leagueId_season_key" ON "LeagueSeason"("leagueId", "season");

-- CreateIndex
CREATE INDEX "FantasyTeamSeason_managerId_idx" ON "FantasyTeamSeason"("managerId");

-- CreateIndex
CREATE INDEX "FantasyTeamSeason_fantasyTeamId_idx" ON "FantasyTeamSeason"("fantasyTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeamSeason_seasonId_fantasyTeamId_key" ON "FantasyTeamSeason"("seasonId", "fantasyTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeamSeason_seasonId_managerId_key" ON "FantasyTeamSeason"("seasonId", "managerId");

-- CreateIndex
CREATE INDEX "FantasyMatchup_seasonId_week_idx" ON "FantasyMatchup"("seasonId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyMatchup_seasonId_week_homeTeamSeasonId_key" ON "FantasyMatchup"("seasonId", "week", "homeTeamSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyMatchup_seasonId_week_awayTeamSeasonId_key" ON "FantasyMatchup"("seasonId", "week", "awayTeamSeasonId");

-- AddForeignKey
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeamSeason" ADD CONSTRAINT "FantasyTeamSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeamSeason" ADD CONSTRAINT "FantasyTeamSeason_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeamSeason" ADD CONSTRAINT "FantasyTeamSeason_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyMatchup" ADD CONSTRAINT "FantasyMatchup_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyMatchup" ADD CONSTRAINT "FantasyMatchup_homeTeamSeasonId_fkey" FOREIGN KEY ("homeTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyMatchup" ADD CONSTRAINT "FantasyMatchup_awayTeamSeasonId_fkey" FOREIGN KEY ("awayTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
