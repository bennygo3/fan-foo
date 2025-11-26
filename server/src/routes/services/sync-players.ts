import { prisma } from "../../lib/prisma";
import { tankGetPlayersList, tankGetTeamsWithRosters } from "./tank-call";
import {
    mapTanksPlayersListToDTO,
    mapTanksRostersToPlayersDTO,
    type PlayerDTO,
} from "../../mappers/tank-to-domain";

export async function syncTankPlayersToDb(season: string = "2025") {
    let dtos: PlayerDTO[];

    try {
        const raw = await tankGetPlayersList(season);
        dtos = mapTanksPlayersListToDTO(raw);
    } catch {
        const raw = await tankGetTeamsWithRosters(season);
        dtos = mapTanksRostersToPlayersDTO(raw);
    }

    for (const p of dtos) {
        if (!p.id) continue;

        await prisma.player.upsert({
            where: {
                externalSrc_externalId: {
                    externalSrc: "tank",
                    externalId: p.id,
                },
            },
            create: {
                name: p.name,
                position: p.position,
                externalSrc: "tank",
                externalId: p.id,
                projPts: p.projPts ?? null,
                headshotUrl: p.headshot ?? null,
                team: p.teamAbv ? { connect: { abbr: p.teamAbv } } : undefined,
                adp: null,
                lastSyncedAt: new Date(),
            },
            update: {
                name: p.name,
                position: p.position,
                projPts: p.projPts ?? null,
                headshotUrl: p.headshot ?? null,
                lastSyncedAt: new Date(),
            },
        });
    }
}