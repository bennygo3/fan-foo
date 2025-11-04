import express from "express";
import type { Request, Response, NextFunction } from "express";
import { tankGetWeeklySchedule, tankGetBoxScore, NON_PPR_SCORING } from "../services/tank-call";

export const mockTeam = express.Router();

type MockTeam = {
    name: string;
    season: string;
    roster: string[];
};

const TEAM: MockTeam = { name: "BenGee's Test Team", season: "2025", roster: [] };

// Map playerId -> teamAbv (fills when player is added to team)
const playerIndex = 
new Map<string, { name?: string; position?: string; teamAbv?: string }>(); 

const uniq = <T,>(arr: T[]) => [...new Set(arr)];

// GET current team
mockTeam.get("/", (_req, res) => {
    res.json({ team: TEAM, count: TEAM.roster.length });
});

// POST add player { playerID, teamAbv, name?, position? }
mockTeam.post("/add", (req: Request, res: Response) => {
    const { playerID, teamAbv, name, position } = req.body || {};
    if (!playerID) return res.status(400).json({ error: "playerID required" });

    if (!TEAM.roster.includes(String(playerID))) {
        TEAM.roster.push(String(playerID));
    }

    if (!playerIndex.has(String(playerID))) {
        playerIndex.set(String(playerID), { teamAbv, name, position });
    } 
    res.json({ ok: true, roster: TEAM.roster, added: String(playerID) })
});

// GET /mock-team/score?season=2025&week=8
mockTeam.get("/score", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? TEAM.season;
        const week = (req.query.week as string) ?? "1";

        const sched = await tankGetWeeklySchedule(week, season);
        const games: any[] = sched?.body ?? sched ?? [];
        const teamToGame = new Map<string, string>();
        for (const g of games) {
            const gameID = String(g?.gameID ?? `${g?.gameDate}_${g?.awayTeam}@${g?.homeTeam}`);
            if (g?.homeTeam) teamToGame.set(String(g.homeTeam).toUpperCase(), gameID);
            if (g?.awayTeam) teamToGame.set(String(g.awayTeam).toUpperCase(), gameID);
        }

        const players = TEAM.roster.map(id => ({ id, meta: playerIndex.get(id) || {} }));
        const byGame = new Map<string, string[]>();
        for (const p of players) {
            const abv = (p.meta.teamAbv || "").toUpperCase();
            const gameID = abv ? teamToGame.get(abv) : undefined;
            if (!gameID) continue;
            if(!byGame.has(gameID)) byGame.set(gameID, []);
            byGame.get(gameID)!.push(p.id);
        }

        let teamTotal = 0;
        const perPlayer: Array<{ playerID: string; name?: string; teamAbv?: string; points: number }> = [];

        for (const [gameID, playerIDs] of byGame) {
            const box = await tankGetBoxScore(gameID, NON_PPR_SCORING);

            const body = box?.body ?? box ?? {};
            const allPlayers: any[] =
            body?.playerStats ?? body?.players ?? body?.playerProjections ?? body?.stats ?? [];

            const fp = new Map<string, number>();
            for (const row of allPlayers) {
                const id = String(row?.playerID ?? row?.espnID ?? "");
                const pts = Number(row?.fantasyPoints ?? row?.fantasyPointsDefault ?? 0);
                if (id) fp.set(id, pts);
            }
            
            for (const id of playerIDs) {
                const pts = fp.get(id) ?? 0;
                teamTotal += pts;
                const meta = playerIndex.get(id);
                perPlayer.push({ playerID: id, name: meta?.name, teamAbv: meta?.teamAbv, points: pts });
            }
        }

        res.json({
            season,
            week: Number(week),
            rosterCount: TEAM.roster.length,
            total: Number(teamTotal.toFixed(2)),
            players: perPlayer.sort((a,b) => b.points - a.points),
        });
    } catch (e) {
        next(e);
    }
});
