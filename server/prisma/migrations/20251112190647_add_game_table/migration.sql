-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "isFlexed" BOOLEAN NOT NULL DEFAULT false,
    "externalGameId" TEXT,
    "externalSrc" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_externalGameId_key" ON "Game"("externalGameId");

-- CreateIndex
CREATE INDEX "Game_season_week_idx" ON "Game"("season", "week");

-- CreateIndex
CREATE UNIQUE INDEX "Game_season_week_homeTeamId_awayTeamId_startTime_key" ON "Game"("season", "week", "homeTeamId", "awayTeamId", "startTime");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
