import express, { Request, Response, NextFunction } from "express";
import { tankGetPlayersList, tankGetTeamsWithRosters } from "./services/tank-call.js";
import { PlayerDTO, mapTanksPlayersListToDTO, mapTanksRostersToPlayersDTO } from "../mappers/tank-to-domain.js";

export const nfl = express.Router();

// GET /nfl/players?season=2025
nfl.get("/players", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const search = (req.query.search as string) ?? "";
        const position = (req.query.position as string) ?? "";
        const teamAbv = (req.query.teamAbv as string) ?? "";
        const freeAgents = String(req.query.freeAgents ?? "false").toLowerCase() === "true";
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
        const sort = (req.query.sort as string) ?? "name";

        let raw: any;
        let players: PlayerDTO[];
        try {
            raw = await tankGetPlayersList(season);
            players = mapTanksPlayersListToDTO(raw);
        } catch {
            raw = await tankGetTeamsWithRosters(season);
            players = mapTanksRostersToPlayersDTO(raw);
        }

        const filtered = players.filter((p) => {
            if (position && p.position !== position.toUpperCase()) return false;
            if (teamAbv && (p.teamAbv ?? "") !== teamAbv.toUpperCase()) return false;
            if (freeAgents && !p.isFA) return false;
            if (search && !(`${p.name} ${p.teamAbv ?? ""}`.toLowerCase().includes(search.toLowerCase()))) return false;
            return true;
        });

        const sorted = [...filtered].sort((a, b) => {
            if (sort === "position") return a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
            if (sort === "team") return (a.teamAbv ?? "").localeCompare(b.teamAbv ?? "") || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });

        // paginate
        const start = (page - 1) * limit;
        const items = sorted.slice(start, start + limit);

        res.set("Cache-Control", "public, max-age=60");
        res.json({ items, total: sorted.length, page, limit });
    } catch (e) {
        next (e);
    }
});

// GET /nfl/roster/:teamAbv?season=2025
// nfl.get("/roster/:teamAbv", async (req, res, next) => {
//     try {
//         const season = (req.query.season as string) || "2025";
//         const teamAbv = req.params.teamAbv.toUpperCase();
//         const raw = await tankGetsTeamsWithRosters(season);
//         const dtoList = mapTankRostersToOffense(raw);
//         const team = pickTeamRoster(dtoList, teamAbv);
//         if (!team) return res.status(404).json({ error: `Team ${teamAbv} not found` });
//         res.json(team);
//     } catch (e) {
//         next(e);
//     }
// });

