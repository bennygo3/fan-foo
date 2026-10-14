import { 
    Router, 
    type Request, 
    type Response, 
    type NextFunction 
} from "express";
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

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

        const rawTeamAbv = req.query.teamAbv;

        let selectedTeam:
            | {
                id: number;
                abbr: string;
            }
            | undefined;

        if (rawTeamAbv !== undefined) {
            if (typeof rawTeamAbv !== "string") {
                return res.status(400).json({
                    error: "Invalid team abbreviation",
                });
            }

            const teamAbv = rawTeamAbv
                .trim()
                .toUpperCase();

            if (!/^[A-Z]{2,3}$/.test(teamAbv)) {
                return res.status(400).json({
                    error: "Invalid teamsAbv",
                });
            }

            selectedTeam = 
                (await prisma.team.findUnique({
                    where: {
                        abbr: teamAbv,
                    },
                    select: {
                        id: true,
                        abbr: true,
                    },
                })) ?? undefined;
            
            if (!selectedTeam) {
                return res.status(404).json({
                    error: `NFL team ${teamAbv} not found`,
                });
            }
        }

        const where: Prisma.GameWhereInput = {
            season,
            ...(week !== undefined ? { week } : {}),
            ...(selectedTeam 
                ? {
                    OR: [
                        {
                            homeTeamId: selectedTeam.id,
                        },
                        {
                            awayTeamId: selectedTeam.id,
                        },
                    ],
                }
            : {}),
        };

        const games = await prisma.game.findMany({
            where,
            include: {
                awayTeam: { select: { id: true, name: true, abbr: true, logoUrl: true, } },
                homeTeam: { select: { id: true, name: true, abbr: true, logoUrl: true, } },
            },
            orderBy: [{ week: "asc" }, { startTime: { sort: "asc", nulls: "last", },  }, ],
        });

        res.json(games);
    } catch (err) {
        next(err);
    }
  }
);

export default router;