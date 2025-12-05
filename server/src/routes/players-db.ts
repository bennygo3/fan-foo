import { Router, type Request, type Response } from "express";
import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

const router = Router();

// talks to prisma player table, simple list and detail of players, shows who is in player database
router.get("/", async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const teamId = typeof req.query.teamId === "string" ? Number(req.query.teamId) : undefined;
    const position = typeof req.query.position === "string" ? req.query.position : undefined;

    const page = Math.max(1, typeof req.query.page === "string" ? Number(req.query.page) : 1);
    const limit = Math.min(100, Math.max(1, typeof req.query.limit === "string" ? Number(req.query.limit) : 50));

    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "name";
    // Locks sot to allowed fields to keep types happy (and to avoid injection)
    const sortKey: "name" | "position" | "teamId" | "projPts" =
        sortRaw === "position" ? "position" :
            sortRaw === "teamId" ? "teamId" :
                sortRaw === "proj" || sortRaw === "projPts" ? "projPts" :
                    "name"
    ;

    const dir: Prisma.SortOrder =
        sortKey === "projPts"
            ? "desc"
            : (typeof req.query.order === "string" && req.query.order.toLowerCase() === "desc" ? "desc" : "asc")
    ;

    const and: Prisma.PlayerWhereInput[] = [];
    if (search.trim()) {
        and.push({ name: { contains: search.trim(), mode: "insensitive", } });
    }

    if (Number.isFinite(teamId)) and.push({ teamId });
    if (position && position.trim()) and.push({ position: position.trim().toUpperCase() });
    // if (typeof teamId === "number" && Number.isFinite(teamId)) { and.push({ teamId }); }

    const where: Prisma.PlayerWhereInput = and.length ? { AND: and } : {};
    const skip = (page - 1) * limit;
    const take = limit;

    // Build orderBy with a narrow union so it remains type-safe -------->
    const orderBy: Prisma.PlayerOrderByWithRelationInput =
        sortKey === "name" ? { name: dir } :
            sortKey === "position" ? { position: dir } :
                sortKey === "teamId" ? { teamId: dir } : { projPts: dir }
    ;

    try {
        const [items, total] = await Promise.all([
            prisma.player.findMany({ where, skip, take, orderBy, include: { team: true }, }),
            prisma.player.count({ where }),
        ]);
        res.json({ items, total, page, limit });
    } catch (e) {
        console.error("GET /players failed:", e);
        res.status(500).json({ error: "failed to fetch players" });
    }
});

// GET /players/:id 
router.get("/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid player id" });

    try {
        const item = await prisma.player.findUnique({ where: { id }, include: { team: true }, });
        if (!item) return res.status(404).json({ error: "player/id not found" });
        res.json(item);
    } catch (e) {
        console.error("GET /players/:id failed:", e);
        res.status(500).json({ error: "Failed to fetch player" });
    }
});

export default router;
