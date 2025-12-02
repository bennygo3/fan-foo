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
    yardsAgainst?: number;
    twoPtReturns?: number;
    onePtSafeties?: number;
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
    const ya = row.yardsAgainst ?? null;
    const twoPt = row.twoPtReturns ?? 0;
    const onePtSafe = row.onePtSafeties ?? 0;

    // Points allowed tiers
    let paPts = 0;
    if (pa === 0) paPts = 5;
    else if (pa <= 6) paPts = 4;
    else if (pa <= 13) paPts = 3;
    else if (pa <= 17) paPts = 1;
    else if (pa >= 28 && pa <= 34) paPts = -1;
    else if (pa >= 35 && pa <= 45) paPts = -3;
    else if (pa >= 46) paPts = -5;

    // Yards allowed tiers
    let yaPts = 0;
    if (ya != null) {
        if (ya < 100) yaPts = 5;
        else if (ya <= 199) yaPts = 3;
        else if (ya <= 299) yaPts = 2
        // 300-349 -> 0pts (implicitly)
        else if (ya >= 350 && ya <= 399) yaPts = -1;
        else if (ya >= 400 && ya <= 449) yaPts = -3;
        else if (ya >= 450 && ya <= 499) yaPts = -5;
        else if (ya >= 500 && ya <= 549) yaPts = -6;
        else if (ya >= 550) yaPts = -7;
    }

    return (
        sacks * 1 +
        ints * 2 +
        fr * 2 +
        safeties * 2 +
        (defTD + retTD) * 6 +
        blocks * 2 +
        paPts +
        yaPts +
        twoPt * 2 +
        onePtSafe * 1
    );
}