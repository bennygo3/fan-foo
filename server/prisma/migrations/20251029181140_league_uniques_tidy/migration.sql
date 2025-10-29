/*
  Warnings:

  - A unique constraint covering the columns `[externalSrc,externalId]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K', 'BN', 'IR');

-- DropIndex
DROP INDEX "public"."Player_externalSrc_externalId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "passYdsPerPt" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "passTDPts" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "passIntPts" DOUBLE PRECISION NOT NULL DEFAULT -2,
    "rushYdsPerPt" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "rushTDPts" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "recYdsPerPt" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "recTDPts" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "ppr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fgMadePts" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "fgMissPts" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "xpMadePts" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "xpMissPts" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "qbStarters" INTEGER NOT NULL DEFAULT 1,
    "rbStarters" INTEGER NOT NULL DEFAULT 2,
    "wrStarters" INTEGER NOT NULL DEFAULT 2,
    "teStarters" INTEGER NOT NULL DEFAULT 1,
    "flexStarters" INTEGER NOT NULL DEFAULT 1,
    "dstStarters" INTEGER NOT NULL DEFAULT 1,
    "kStarters" INTEGER NOT NULL DEFAULT 1,
    "benchSpots" INTEGER NOT NULL DEFAULT 7,
    "irSpots" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "managerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterSlot" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "slot" "SlotType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_name_key" ON "League"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");

-- CreateIndex
CREATE INDEX "FantasyTeam_leagueId_managerId_idx" ON "FantasyTeam"("leagueId", "managerId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_leagueId_name_key" ON "FantasyTeam"("leagueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_leagueId_managerId_key" ON "FantasyTeam"("leagueId", "managerId");

-- CreateIndex
CREATE INDEX "RosterSlot_teamId_slot_idx" ON "RosterSlot"("teamId", "slot");

-- CreateIndex
CREATE INDEX "RosterSlot_leagueId_slot_idx" ON "RosterSlot"("leagueId", "slot");

-- CreateIndex
CREATE INDEX "RosterSlot_teamId_playerId_idx" ON "RosterSlot"("teamId", "playerId");

-- CreateIndex
CREATE INDEX "RosterSlot_playerId_idx" ON "RosterSlot"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_leagueId_playerId_key" ON "RosterSlot"("leagueId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_teamId_playerId_key" ON "RosterSlot"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalSrc_externalId_key" ON "Player"("externalSrc", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
