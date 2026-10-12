import { 
    Router, 
    type Request, 
    type Response, 
    type NextFunction 
} from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/schedule", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const season = 
            typeof req.query.season === "string"
                ? Number(req.query.season)
                : NaN
            ;

        if ( !Number.isInteger(season) || season < 2000 ) {
            return res.status(400).json({
                error: "A valid season is required.",
            });
        }
        
        let week: number | undefined;

        if (req.query.week !== undefined) {
            if (typeof req.query.week !== "string") {
                return res.status(400).json({
                    error: "Invalid week",
                });
            }

            week = Number(req.query.week);

            if (
                !Number.isInteger(week) ||
                week < 1 ||
                week > 18
            ) {
                return res.status(400).json({
                    error: "Week must be between 1 and 18",
                });
            }
        } 

        const games = await prisma.game.findMany({
            where: {
                season,
                ...(week !== undefined ? { week } : {}),
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