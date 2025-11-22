import { Router } from "express";
import { prisma } from "../prisma";

export const rostersRouter = Router();

rostersRouter.post("/:leagueId/rosters/add", async (req, res) => {
    const leagueId = Number(req.params.leagueId);
    const { teamId, playerId, slot } = req.body;

    if (!leagueId || !teamId || !playerId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const slotEntry = await prisma.rosterSlot.create({
            data: {
                leagueId,
                teamId,
                playerId,
                slot,
            },
            include: {
                team: true,
                player: true,
            },
        });

        res.json(slotEntry);
    } catch (e) {
        console.error("ADD roster error", e);
        res.status(500).json({ error: "Failed to add player" });
    }
});