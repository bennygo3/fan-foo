import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

import { nfl } from "./routes/nfl.js";
import playersRouter from "./routes/players.js";
import teamsRouter from "./routes/teams.js";

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

// Get all users
app.get("/users", async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users);
});

app.use("/nfl", nfl);
app.use("/players", playersRouter);
app.use("/teams", teamsRouter);

// Create a new user
app.post("/users", async (req, res) => {
    const { email, usernam } = req.body;
    try {
        const newUser = await prisma.user.create({
            data: { email, username },
        });
        res.status(201).json(newUser);
    } catch (err) {
        console.error(err `index js server create new user`)
        res.status(500).json({ error: "Failed to create a new user" });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})