-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('SETUP', 'IN_PROGRESS', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Draft" (
    "id" SERIAL NOT NULL,
    "leagueSeasonId" INTEGER NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'SETUP',
    "rounds" INTEGER NOT NULL DEFAULT 17,
    "currentOverallPick" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftParticipant" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "fantasyTeamSeasonId" INTEGER NOT NULL,
    "draftPosition" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "fantasyTeamSeasonId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "overallPick" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "pickInRound" INTEGER NOT NULL,
    "madeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Draft_leagueSeasonId_key" ON "Draft"("leagueSeasonId");

-- CreateIndex
CREATE INDEX "DraftParticipant_fantasyTeamSeasonId_idx" ON "DraftParticipant"("fantasyTeamSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftParticipant_draftId_fantasyTeamSeasonId_key" ON "DraftParticipant"("draftId", "fantasyTeamSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftParticipant_draftId_draftPosition_key" ON "DraftParticipant"("draftId", "draftPosition");

-- CreateIndex
CREATE INDEX "DraftPick_fantasyTeamSeasonId_overallPick_idx" ON "DraftPick"("fantasyTeamSeasonId", "overallPick");

-- CreateIndex
CREATE INDEX "DraftPick_playerId_idx" ON "DraftPick"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_overallPick_key" ON "DraftPick"("draftId", "overallPick");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_playerId_key" ON "DraftPick"("draftId", "playerId");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftParticipant" ADD CONSTRAINT "DraftParticipant_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftParticipant" ADD CONSTRAINT "DraftParticipant_fantasyTeamSeasonId_fkey" FOREIGN KEY ("fantasyTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_fantasyTeamSeasonId_fkey" FOREIGN KEY ("fantasyTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
