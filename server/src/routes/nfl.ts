import express, { Request, Response, NextFunction } from "express";
import { tankGetPlayers } from "./services/tank-call.js";
import { mapTankPlayersToDTO } from "../mappers/tank-to-domain.js";

export const nfl = express.Router();

// GET /nfl/players?season=2025
nfl.get("/players", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const search = (req.query.search as string) ?? "";
        const position = (req.query.position as string) ?? "";
        const teamAbv = req
        res.set("Cache-Control", "public, max-age=60");
        res.json(raw);
    } catch (e) {
        next(e);
    }
});

// GET /nfl/roster/:teamAbv?season=2025
nfl.get("/roster/:teamAbv", async (req, res, next) => {
    try {
        const season = (req.query.season as string) || "2025";
        const teamAbv = req.params.teamAbv.toUpperCase();
        const raw = await tankGetsTeamsWithRosters(season);
        const dtoList = mapTankRostersToOffense(raw);
        const team = pickTeamRoster(dtoList, teamAbv);
        if (!team) return res.status(404).json({ error: `Team ${teamAbv} not found` });
        res.json(team);
    } catch (e) {
        next(e);
    }
});

