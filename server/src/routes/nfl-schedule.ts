import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/schedule", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = 2025;
        const week = req.query.week ? Number(req.query.week) : undefined;

        const games = await prisma.game.findMany({
            where: {
                season,
                ...(week ? { week } : {}),
            },
            include: {
                awayTeam: { select: { id: true, name: true, abbr: true } },
                homeTeam: { select: { id: true, name: true, abbr: true } },
            },
            orderBy: [{ week: "asc" }, { startTime: "asc" }],
        });

        res.json(games);
    } catch (err) {
        next(err);
    }
  }
);

export default router;