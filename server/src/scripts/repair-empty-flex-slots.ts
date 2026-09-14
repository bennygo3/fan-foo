import { prisma } from "../lib/prisma";

const LEAGUE_ID = 1;
const SEASON = 2026;
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

async function main() {
    const leagueSeason = await prisma.leagueSeason.findFirst({
        where: {
            leagueId: LEAGUE_ID,
            season: SEASON,
        },
    });

    if (!leagueSeason) {
        throw new Error(
            `League ${LEAGUE_ID} season ${SEASON} was not found`
        );
    }

    const emptyFlexSlots = await prisma.rosterSlot.findMany({
        where: {
            leagueSeasonId: leagueSeason.id,
            slot: "FLEX",
            playerId: null,
        },
        select: {
            id: true,
            fantasyTeamSeasonId: true,
        },
        orderBy: {
            fantasyTeamSeasonId: "asc",
        },
    });

    let repaired = 0;

    for (const flexSlot of emptyFlexSlots) {
        const benchSlots = await prisma.rosterSlot.findMany({
            where: {
                leagueSeasonId: leagueSeason.id,
                fantasyTeamSeasonId: flexSlot.fantasyTeamSeasonId,
                slot: "BN",
                playerId: {
                    not: null,
                },
            },
            select: {
                id: true,
                playerId: true,
                player: {
                    select: {
                        name: true,
                        position: true,
                    },
                },
            },
            orderBy: {
                id: "asc",
            },
        });

        const sourceSlot = benchSlots.find(
            (slot) =>
                slot.player !== null &&
                FLEX_POSITIONS.has(slot.player.position.toUpperCase())
        );

        if (!sourceSlot || sourceSlot.playerId === null) {
            console.log(
                `No FLEX eligible bench player found for team/season ${flexSlot.fantasyTeamSeasonId}`
            );
            continue;
        }

        const playerId = sourceSlot.playerId;

        await prisma.$transaction([
            prisma.rosterSlot.update({
                where: {
                    id: sourceSlot.id,
                },
                data: {
                    playerId: null,
                },
            }),
            prisma.rosterSlot.update({
                where: {
                    id: flexSlot.id,
                },
                data: {
                    playerId,
                },
            }),
        ]);

        repaired++;

        console.log(`Moved ${sourceSlot.player?.name} from BN to FLEX for team ${flexSlot.fantasyTeamSeasonId}`);
    }

    console.log(`Repaired ${repaired} FLEX slot(s)`);
}
main()
    .catch((error) => {
        console.error("Failed to fill FLEX slots:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    })
