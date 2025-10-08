import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// GET /players?search
router.get("/", async (req, res) => {
    const {
        search = "",
        teamId,
        position,
        page = 1,
        limit = 25,
        sort = "name",
        order = "asc",
    } = req.query;

    const where = {
        AND: [
            search ? { name: { contains: String(search), mode: "insensitive" } } : {},
            teamId ? { teamId: Number(teamId) } : {},
            position ? { position: String(position) } : {},
        ],
    };

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    try {
        const [items, total] = await Promise.all([
            prisma.player.findMany({
                where,
                skip,
                take,
                orderBy: { [String(sort)]: order === "desc" ? "desc" : "asc" },
                include: { team: true },
            }),
            prisma.player.count({ where }),
        ]);

        res.json({ items, total, page: Number(page), limit: Number(limit) });
    } catch (e) {
        console.error("GET /players failed:", e);
        res.status(500).json({ error: "failed to fetch players" });
    }
});

// GET /players/:id 
router.get("/:id", async (req, res) => {
    try {
        const item = await prisma.player.findUnique({
            where: { id: Number(req.params.id) },
            include: { team: true },
        });
        if (!item) return res.status(404).json({ error: "player/id not found" });
        res.json(item);
    } catch (e) {
        console.error("GET /players/:id failed:", e);
        res.status(500).json({ error: "Failed to fetch player" });
    }
});

export default router;