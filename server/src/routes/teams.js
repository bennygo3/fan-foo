import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

// GET /teams 
router.get("/", async (_req, res) => {
    try {
        const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
        res.json(teams);
    } catch (e) {
        console.error("GET /teams failed:", e);
        res.status(500).json({ error: "Failed to fetch team/s" });
    }
});

export default router;