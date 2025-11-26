export type PlayerDTO = {
    id: string;
    name: string;
    position: "QB" | "RB" | "WR" | "TE" | "FB" | "K";
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

const OFFENSE = new Set(["QB", "RB", "WR", "TE", "FB", "K"]);

// Tank's booleans are string "True"/"False"
const toBool = (v: any) => String(v).toLowerCase() === "true";
const toNum = (v: any) => (v == null || v === "" ? null : Number(v));

// From a flat players list
export function mapTanksPlayersListToDTO(api: any): PlayerDTO[] {
    const rows: any[] = api?.body ?? api ?? [];
    return rows
        .filter((p) => {
            const rawPos = p?.pos ?? p?.position;
            const pos = String(rawPos ?? "").toUpperCase();
            return OFFENSE.has(pos);
        })
        .map((p) => {
            const rawPos = p?.pos ?? p?.position;
            const pos = String(rawPos ?? "").toUpperCase() as PlayerDTO["position"];

            const teamAbvRaw = p?.teamAbbr ?? p?.team ?? null;
            const teamAbv = teamAbvRaw ? String(teamAbvRaw) : null;

            const headshot =
                p?.headshot ??
                p?.espnHeadshot ??
                null;

            return {
                id: String(p?.playerID ?? p?.espnID ?? p?.id ?? ""),
                name: p?.displayName ?? p?.longName ?? p?.cbsLongName ?? p?.espnName ?? "",
                position: pos,
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
        });
}

export function mapTanksRostersToPlayersDTO(api: any): PlayerDTO[] {
    const teams: any[] = api?.body ?? api ?? [];
    const out: PlayerDTO[] = [];
    
    for (const t of teams) {
        const teamAbv = t?.teamAbv ? String(t.teamAbv) : null;
        const roster: any[] = t?.roster ?? [];
        
        for (const p of roster) {
            const rawPos = p?.position ?? p?.pos;
            const pos = String(rawPos ?? "").toUpperCase();

            if (!OFFENSE.has(pos)) continue;

            const headshot =
            p?.headshot ??
            p?.espnHeadshot ??
            null;

            out.push({
                id: String(p?.playerID ?? p?.id ?? p?.espnID ?? ""),
                name: p?.displayName ?? p?.longName ?? p?.name ?? "",
                position: pos as PlayerDTO["position"],
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