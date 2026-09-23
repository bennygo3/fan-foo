-- CreateEnum
CREATE TYPE "RosterTransactionType" AS ENUM ('ADD', 'DROP', 'ADD_DROP', 'TRADE');

-- CreateTable
CREATE TABLE "RosterTransaction" (
    "id" SERIAL NOT NULL,
    "leagueSeasonId" INTEGER NOT NULL,
    "type" "RosterTransactionType" NOT NULL,
    "week" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterTransactionItem" (
    "id" SERIAL NOT NULL,
    "rosterTransactionId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "fromFantasyTeamSeasonId" INTEGER,
    "toFantasyTeamSeasonId" INTEGER,
    "fromSlot" "SlotType",
    "toSlot" "SlotType",

    CONSTRAINT "RosterTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterTransaction_leagueSeasonId_createdAt_idx" ON "RosterTransaction"("leagueSeasonId", "createdAt");

-- CreateIndex
CREATE INDEX "RosterTransactionItem_playerId_idx" ON "RosterTransactionItem"("playerId");

-- CreateIndex
CREATE INDEX "RosterTransactionItem_fromFantasyTeamSeasonId_idx" ON "RosterTransactionItem"("fromFantasyTeamSeasonId");

-- CreateIndex
CREATE INDEX "RosterTransactionItem_toFantasyTeamSeasonId_idx" ON "RosterTransactionItem"("toFantasyTeamSeasonId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterTransactionItem_rosterTransactionId_playerId_key" ON "RosterTransactionItem"("rosterTransactionId", "playerId");

-- AddForeignKey
ALTER TABLE "RosterTransaction" ADD CONSTRAINT "RosterTransaction_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTransactionItem" ADD CONSTRAINT "RosterTransactionItem_rosterTransactionId_fkey" FOREIGN KEY ("rosterTransactionId") REFERENCES "RosterTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTransactionItem" ADD CONSTRAINT "RosterTransactionItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTransactionItem" ADD CONSTRAINT "RosterTransactionItem_fromFantasyTeamSeasonId_fkey" FOREIGN KEY ("fromFantasyTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTransactionItem" ADD CONSTRAINT "RosterTransactionItem_toFantasyTeamSeasonId_fkey" FOREIGN KEY ("toFantasyTeamSeasonId") REFERENCES "FantasyTeamSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
