import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";

import { prisma } from "./lib/prisma"
import { nfl } from "./routes/nfl";
import { leagueRouter } from "./routes/league";
import { myTeamRouter } from "./routes/my-team";
import { playerPoolRouter } from "./routes/player-pool";
import nflScheduleRouter from "./routes/nfl-schedule";
import playersRouter from "./routes/players-db";
import teamsRouter from "./routes/nfl-teams";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
    
    // checking if routes are hitting code as intended
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
        console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
});

app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
});

// Get all users
app.get("/users", async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany();
    res.json(users);
});

app.get("/", (_req: Request, res: Response) => {
    res.send("🏈 Fantasy Football API is running 🚀")
})

app.use("/nfl", nfl);
app.use("/leagues", leagueRouter);
app.use("/leagues", myTeamRouter);
app.use("/leagues", playerPoolRouter);
app.use("/players", playersRouter);
app.use("/teams", teamsRouter);
app.use("/nfl", nflScheduleRouter);

// Create a new user
app.post("/users", async (req: Request, res: Response) => {
    const { email, username } = req.body as { email: string; username: string };
    try {
        const newUser = await prisma.user.create({
            data: { email, username },
        });
        res.status(201).json(newUser);
    } catch (err) {
        console.error("index.ts /users created error:", err);
        res.status(500).json({ error: "Failed to create a new user" });
    }
});

    // global error handling
app.use((err: any, req: Request, res: Response, _next: any) => {
    // always log full error on the server
    console.error("[api error]", req.method, req.originalUrl, err);

    // setting up prisma errors
    const status = 
        (typeof err?.statusCode === "number" && err.statusCode) ||
        (typeof err?.status === "number" && err.status) ||
        (err?.code ? 400 : 500);
    
    res.status(status).json({
        error: err?.message ?? "Internal Server Error",
        code: err?.code ?? undefined,
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
});

process.on("SIGINT", async () => {
    console.log("🧹 shutting down gracefully SIGINT...");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("🧹 shutting down gracefully SIGterm");
    await prisma.$disconnect();
    process.exit(0);
});