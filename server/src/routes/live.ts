import express from "express";

export const live = express.Router();

live.get("/", async (_req, res) => {
    res.json({ message: "Live endpoint ready (no external fetch yet" });
});