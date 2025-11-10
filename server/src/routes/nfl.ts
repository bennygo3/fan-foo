import express from "express";
import type { Request, Response, NextFunction } from "express";

import {
    tankGetPlayersList,
    tankGetTeamsWithRosters,
    tankGetProjections,
    tankGetBoxScore,
    extractPlayerProjections,
    extractDSTProjections,
} from "./services/tank-call";

import {
    mapTanksPlayersListToDTO,
    mapTanksRostersToPlayersDTO
} from "../mappers/tank-to-domain";

import type { PlayerDTO } from "../mappers/tank-to-domain.ts";
import { scoreDST } from "../scoring/dst";

export const nfl = express.Router();

// GET /nfl/players?season=2025
nfl.get("/players", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const weekParam = (req.query.week as string) ?? "";
        const search = (req.query.search as string) ?? "";
        const position = (req.query.position as string) ?? "";
        const teamAbv = (req.query.teamAbv as string) ?? "";
        const freeAgents = String(req.query.freeAgents ?? "false").toLowerCase() === "true";
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
        const sort = (req.query.sort as string) ?? "name";
        const orderRaw = (req.query.order as string) ?? "asc";
        const order: "asc" | "desc" = orderRaw.toLowerCase() === "desc" ? "desc" : "asc";
        
        // Load players from a lighter endpoint; fall back to rosters if needed
        let raw: any;
        let players: PlayerDTO[];
        try {
            raw = await tankGetPlayersList(season);
            players = mapTanksPlayersListToDTO(raw);
        } catch {
            raw = await tankGetTeamsWithRosters(season);
            players = mapTanksRostersToPlayersDTO(raw);
        }

        // Attach projection when week provided or sort = projections
        if (weekParam || sort === "proj") {
            try {
                const projResp = await tankGetProjections({ week: weekParam || "1", season });
                const rows = extractPlayerProjections(projResp);

                const projById = new Map<string, any>();
                for (const r of rows) {
                    const id = String(r?.playerID ?? r?.espnID ?? "");
                    if (id) projById.set(id, r);
                }

                // Attaches ONLY the provider's: Tank's total projected points
                players = players.map((p) => {
                    const rawProj = projById.get(p.id);
                    const providerPts = Number(rawProj?.fantasyPoints ?? rawProj?.points ?? 0);
                    return { ...p, projPts: Number.isFinite(providerPts) ? providerPts : 0 };
                });
            } catch {
                // If projections fail, continue without projPts
                console.log("/players route error");
            }
        }
    
        const filtered = players.filter((p) => {
            if (position && p.position !== position.toUpperCase()) return false;
            if (teamAbv && (p.teamAbv ?? "") !== teamAbv.toUpperCase()) return false;
            if (freeAgents && !p.isFA) return false;
            if (search) {
                const hay = `${p.name} ${p.teamAbv ?? ""}`.toLowerCase();
                if (!hay.includes(search.toLowerCase())) return false;
            } 
            return true;
        });

        const sorted = [...filtered].sort((a, b) => {
            if (sort === "proj") return (b.projPts ?? 0) - (a.projPts ?? 0); // projected points will be in desc format
            if (sort === "position") {
                const cmp = a.position.localeCompare(b.position);
                return cmp !== 0 ? (order === "asc" ? cmp : -cmp) : a.name.localeCompare(b.name);
            } 
            if (sort === "team") {
                const ta = (a.teamAbv ?? "");
                const tb = (b.teamAbv ?? "");
                const cmp = ta.localeCompare(tb);
                return cmp !== 0 ? (order === "asc" ? cmp : -cmp) : a.name.localeCompare(b.name);
            } 
            const cmp = a.name.localeCompare(b.name);
            return order === "asc" ? cmp : -cmp;
        });

        // paginate
        const start = (page - 1) * limit;
        const items = sorted.slice(start, start + limit);

        res.set("Cache-Control", "public, max-age=60");
        res.json({ items, total: sorted.length, page, limit });
    } catch (e) {
        next(e);
    }
});

nfl.get("/dst", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const week = (req.query.week as string) ?? "1";
        const sort = (req.query.sort as string) ?? "proj";
        const teamAbv = (req.query.teamAbv as string) ?? "";

        const projResp = await tankGetProjections({ week, season });
        const rows = extractDSTProjections(projResp);

        const items = rows  
            .map((r: any) => ({
                teamAbv: String(r?.teamAbv ?? r?.team ?? ""),
                sacks: Number(r?.sacks ?? 0),
                interceptions: Number(r?.interceptions ?? 0),
                fumbleRecoveries: Number(r?.fumbleRecoveries ?? 0),
                safeties: Number(r?.safeties ?? 0),
                defTD: Number(r?.defTD ?? 0),
                returnTD: Number(r?.returnTD ?? 0),
                blockKick: Number(r?.blockKick ?? 0),
                ptsAgainst: Number(r?.ptsAgainst ?? 99),
            }))
            .filter(x => (teamAbv ? x.teamAbv.toUpperCase() === teamAbv.toUpperCase() : true))
            .map(x => ({ ...x, projPts: scoreDST(x) }));

        const sorted = [...items].sort((a, b) => 
            sort === "team" ? a.teamAbv.localeCompare(b.teamAbv) : (b.projPts ?? 0) - (a.projPts ?? 0)
        );

        res.set("Cache-Control", "public, max-age=60");
        res.json({ items: sorted, total: sorted.length, week: Number(week), season });
    } catch (e) {
        next(e);
    }
});

// RAW DEBUG PASSTHROUGHS (no mapping)

nfl.get("/_tank/players", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const resp = await tankGetPlayersList(season);
        res.json(resp);
    } catch (e) {
        next(e);
    }
});

nfl.get("/_tank/projections", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = (req.query.season as string) ?? "2025";
        const week = (req.query.week as string) ?? "10";
        const resp = await tankGetProjections({ week, season });
        res.json(resp);
    } catch (e) {
        next(e);
    }
});

nfl.get("/_tank/box", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gameID = (req.query.gameID as string) ?? "";
        if (!gameID) return res.status(400).json({ error: "gameID required" });
        const resp = await tankGetBoxScore(gameID);
        res.json(resp);
    } catch (e) {
        next(e);
    }
});

// scrapyard: 
// 
// const pp = extractPlayerProjections(projResp);
                
// const projById = new Map<string, any>();
// for (const r of pp) {
//     const id = String(r?.playerID ?? r?.espnID ?? "");
//     if (id) projById.set(id, r);
// }

               
// const projById = new Map<string, any>();
//     const fp = new Map<string, number>(); // playerID -> projPts
//     for (const r of pp) {
//         const id = String(r?.playerID ?? r?.espnID ?? "");
//         const pts = Number(r?.fantasyPoints ?? r?.points ?? 0);
//         if (id) fp.set(id, pts);
//     }
//     players = players.map(p => ({ ...p, projPts: fp.get(p.id) ?? 0 }));
// } catch {
//     // projections failed; continue without projPts
// }
// const debug = String(req.query.debug ?? "0") === "1";
                
// players = players.map((p): PlayerDTO => {
//     const rawProj = projById.get(p.id);
                    
//     const projPts = Number(
//         rawProj?.fantasyPoints ?? raw?.points ?? p.projPts ?? 0
//     ); 

//     if (!debug) {
//         return { ...p, projPts: Number.isFinite(projPts) ? projPts : 0 };
//     }

//     // Attaches breakdown only while we are debugging the 
//     const pass = raw?.Passing ?? {};
//     const rush = raw?.Rushing ?? {};
//     const recv = raw?.Receiving ?? {};
//     const kick = raw?.Kicking ?? raw?.kicking ?? {};

//     const projBreakdown = {
//         Passing: {
//             passAttempts: Number(pass?.passAttempts ?? 0),
//             passCompletions: Number(pass?.passCompletions ?? 0),
//             passYds: Number(pass?.passYds ?? 0),
//             passTD: Number(pass?.passTD ?? 0),
//             int: Number(pass?.int ?? 0),
//         },
//         Rushing: {
//             carries: Number(rush?.carries ?? 0),
//             rushYds: Number(rush?.rushYds ?? 0),
//             rushTD: Number(rush?.rushTD ?? 0),
//         },
//         Receiving: {
//             targets: Number(recv?.targets ?? 0),
//             receptions: Number(recv?.receptions ?? 0),
//             recYds: Number(recv?.recYds ?? 0),
//             recTD: Number(recv?.recTD ?? 0),
//         },
//         Kicking: {
//             fgMade: Number(kick?.fgMade?? 0),
//             fgMissed: Number(kick?.fgMissed ?? 0),
//             xpMade: Number(kick?.xpMade ?? 0),
//             xpMissed: Number(kick?.xpMissed ?? 0),
//         },
//     };

//     return {
//         ...p,
//         projPts: Number.isFinite(projPts) ? projPts: 0,
//         // projBreakdown,
//     };
// });
            
// ...
// const filtered = players.filter((p) => {
        //     if (position && p.position !== position.toUpperCase()) return false;
        //     if (teamAbv && (p.teamAbv ?? "") !== teamAbv.toUpperCase()) return false;
        //     if (freeAgents && !p.isFA) return false;
        //     if (search && !(`${p.name} ${p.teamAbv ?? ""}`.toLowerCase().includes(search.toLowerCase()))) return false;
        //     return true;
// });

//  const sorted = [...filtered].sort((a, b) => {
//     if (sort === "proj") return (b.projPts ?? 0) - (a.projPts ?? 0); // projected points will be in desc format
//     if (sort === "position") return a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
//     if (sort === "team") return (a.teamAbv ?? "").localeCompare(b.teamAbv ?? "") || a.name.localeCompare(b.name);
//     return a.name.localeCompare(b.name);
// });


