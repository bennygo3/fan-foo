
export type DSTRow = {
    teamAbv: string;
    sacks?: number;
    interceptions?: number;
    fumbleRecoveries?: number;
    safeties?: number;
    defTD?: number;
    returnTD?: number;
    blockKick?: number;
    ptsAgainst?: number;
};

export function scoreDST(row: DSTRow): number {
    const sacks = row.sacks ?? 0;
    const ints = row.interceptions ?? 0;
    const fr = row.fumbleRecoveries ?? 0;
    const safeties = row.safeties ?? 0;
    const defTD = row.defTD ?? 0;
    const retTD = row.returnTD ?? 0;
    const blocks = row.blockKick ?? 0;
    const pa = row.ptsAgainst ?? 999;

    // Points allowed tiers
    let paPts = 0;
    if (pa === 0) paPts = 5;
    else if (pa <= 6) paPts = 4;
    else if (pa <= 13) paPts = 3;
    else if (pa <= 17) paPts = 1;
    else if (pa >= 28 && pa <= 34) paPts = -1;
    else if (pa >= 35 && pa <= 45) paPts = -3;
    else if (pa >= 46) paPts = -5;

    return (
        sacks * 1 +
        ints * 2 +
        fr * 2 +
        safeties * 2 +
        (defTD + retTD) * 6 +
        blocks * 2 +
        paPts
    );

}