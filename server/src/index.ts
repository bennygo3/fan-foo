import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response } from "express";
import cors from "cors";

import { prisma } from "./lib/prisma"
import { nfl } from "./routes/nfl";
import { leagueRouter } from "./routes/league";
import scheduleRouter from "./routes/schedule";

// import { mockTeam } from "./routes/services/mock-team";

import playersRouter from "./routes/players";
import teamsRouter from "./routes/teams";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

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
app.use("/players", playersRouter);
app.use("/teams", teamsRouter);
app.use("/api", scheduleRouter);
// app.use("/mock-team", mockTeam);

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})

process.on("SIGINT", async () => {
    console.log("🧹 shutting down gracefully SIGINT...");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("🧹 shutting down gracefully SIGterm");
    await prisma.$disconnect();
    process.exit(0);
})