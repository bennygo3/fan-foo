import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /teams 
router.get("/", async (_req, res) => {
    try {
        const teams = await prisma.team.findMany({ 
            select: {
                id: true,
                abbr: true,
                name: true,
                logoUrl: true,
                byeWeeksBySeason: true,
            },
            orderBy: { name: "asc" } 
        });
        res.json({ items: teams });
    } catch (e) {
        console.error("GET /teams failed:", e);
        res.status(500).json({ error: "Failed to fetch team/s" });
    }
});

export default router;