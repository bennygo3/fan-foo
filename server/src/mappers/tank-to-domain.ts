export type PlayerDTO = {
    id: string;
    name: string;
    position: "QB" | "RB" | "WR" | "TE" | "DST" | "K" | "FB";
    teamAbv: string | null;
    isFA: boolean;
    jerseyNum?: number | null;
    age?: number | null;
    headshot?: string | null;
    projPts?: number;
    ext?: {
        espnID?: string;
        sleeperBotID?: string;
        yahooPlayerID?: string;
    };
};

// Positions expected from Tank's player feeds
const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "FB"] as const;
type OffensivePosition = (typeof OFFENSE_POSITIONS)[number];

// changed from new Set<PlayerDTO["position"]>(["QB", "RB", "WR", "TE", "K", "FB",]) so that we can call has(pos) to appease TS
const OFFENSE = new Set<string>(OFFENSE_POSITIONS);

// Tank's booleans are string "True"/"False"
const toBool = (v: any) => String(v).toLowerCase() === "true";
const toNum = (v: any) => (v == null || v === "" ? null : Number(v));

//Normalize tank's raw position into a PlayerDTO["position"] or null: uppercases, maps pk to k, filters out non-offense positions
function normalizeTankPos(raw: any): PlayerDTO["position"] | null {
    const upper = String(raw ?? "").toUpperCase();
    const pos = upper === "PK" ? "K" : upper;

    if (!OFFENSE.has(pos)) return null;
    return pos as OffensivePosition; // OFFENSE only holds offensive positions
}

// this function is set up to handle frank's data for the raw player list call and player projection list call
export function mapTanksPlayersListToDTO(api: any): PlayerDTO[] {
    const rows: any[] = api?.body ?? api ?? [];
    
    return rows.map((p) => {
        const typedPos = normalizeTankPos(p?.pos ?? p?.position);
        if (!typedPos) return null;

        const teamAbvRaw = p?.teamAbbr ?? p?.team ?? null;
        const teamAbv = teamAbvRaw ? String(teamAbvRaw) : null;

        const headshot =
            p?.headshot ??
            p?.espnHeadshot ??
        null;

        const dto: PlayerDTO = {
        id: String(p?.playerID ?? p?.espnID ?? p?.id ?? ""),
        name: p?.displayName ?? p?.longName ?? p?.cbsLongName ?? p?.espnName ?? "",
        position: typedPos,
        teamAbv: teamAbv && teamAbv !== "FA" ? teamAbv : null,
        isFA: toBool(p?.isFreeAgent) || !teamAbv || teamAbv === "FA",
        jerseyNum: toNum(p.jersey ?? p?.jerseyNum),
        age: toNum(p?.age),
        headshot,
        ext: {
            espnID: p?.espnID,
            sleeperBotID: p?.sleeperBotID,
            yahooPlayerID: p?.yahooPlayerID ?? p?.yahooPlayerId,
        },
    };
        return dto;
    })
    .filter((p): p is PlayerDTO => p !== null);
}

// this function is for the mapping of incoming tank nfl teams -> roster list
export function mapTanksRostersToPlayersDTO(api: any): PlayerDTO[] {
    const teams: any[] = api?.body ?? api ?? [];
    const out: PlayerDTO[] = [];
    
    for (const t of teams) {
        const teamAbv = t?.teamAbv ? String(t.teamAbv) : null;
        const roster: any[] = t?.roster ?? [];
        
        for (const p of roster) {
            const typedPos = normalizeTankPos(p?.pos ?? p?.position);
            if (!typedPos) continue;

            const headshot =
                p?.headshot ??
                p?.espnHeadshot ??
            null;

            out.push({
                id: String(p?.playerID ?? p?.id ?? p?.espnID ?? ""),
                name: p?.displayName ?? p?.longName ?? p?.name ?? "",
                position: typedPos,
                teamAbv: teamAbv || null,
                isFA: !teamAbv,
                jerseyNum: toNum(p?.jersey ?? p?.jerseyNum),
                age: toNum(p?.age),
                headshot,
                ext: {
                    espnID: p?.espnID,
                    sleeperBotID: p?.sleeperBotID,
                    yahooPlayerID: p?.yahooPlayerID ?? p?.yahooPlayerId,
                },
            });
        }
    }
    return out;
}


// export function mapTanksRostersToPlayersDTO(api: any): PlayerDTO[] {
//     const teams: any[] = api?.body ?? api ?? [];
//     const out: PlayerDTO[] = [];
    
//     for (const t of teams) {
//         const teamAbv = t?.teamAbv ? String(t.teamAbv) : null;
//         const roster: any[] = t?.roster ?? [];
        
//         for (const p of roster) {
//             const rawPos = p?.position ?? p?.pos;
//             let pos = String(rawPos ?? "").toUpperCase();

//             if (pos === "PK") pos = "K";
//             if (!OFFENSE.has(pos)) continue;

//             const headshot =
//             p?.headshot ??
//             p?.espnHeadshot ??
//             null;

//             out.push({
//                 id: String(p?.playerID ?? p?.id ?? p?.espnID ?? ""),
//                 name: p?.displayName ?? p?.longName ?? p?.name ?? "",
//                 position: pos as PlayerDTO["position"],
//                 teamAbv: teamAbv || null,
//                 isFA: !teamAbv,
//                 jerseyNum: toNum(p?.jersey ?? p?.jerseyNum),
//                 age: toNum(p?.age),
//                 headshot,
//                 ext: {
//                     espnID: p?.espnID,
//                     sleeperBotID: p?.sleeperBotID,
//                     yahooPlayerID: p?.yahooPlayerID ?? p?.yahooPlayerId,
//                 },
//             });
//         }
//     }
//     return out;
// }