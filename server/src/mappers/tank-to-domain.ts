export type PlayerDTO = {
    id: string;
    name: string;
    position: "QB"|"RB"|"WR"|"TE"|"FB"|"K";
    teamAbv: string | null;
    isFA: boolean;
    jerseyNum?: number | null;
    age?: number | null;
    headshot?: string | null;
    projPts?: number;
    ext?: {
        espnID?: string;
        sleeperBotID?: string;
        yahooPlayerId?: string;
    };
};

const OFFENSE = new Set(["QB","RB","WR","TE","FB","K"]);

// Tank's booleans are string "True"/"False"
const toBool = (v: any) => String(v).toLowerCase() === "true";
const toNum = (v: any) => (v == null || v === "" ? null : Number(v));

// From a flat players list
export function mapTanksPlayersListToDTO(api: any): PlayerDTO[] {
    const rows: any[] = api?.body ?? api ?? [];
    return rows
        .filter((p) => OFFENSE.has(String(p?.pos ?? "").toUpperCase()))
        .map((p) => {
            const teamAbv = p?.team ? String(p.team) : null;
            return {
                id: String(p?.playerID ?? p?.espnID ?? ""),
                name: p?.longName ?? p?.cbsLongName ?? p?.espnName ?? "",
                position: String(p?.pos ?? "").toUpperCase() as PlayerDTO["position"],
                teamAbv: teamAbv && teamAbv !== "FA" ? teamAbv: null,
                isFA: toBool(p?.isFreeAgent) || (!teamAbv || teamAbv === "FA"),
                jerseyNum: toNum(p?.jerseyNum),
                age: toNum(p?.age),
                headshot: p?.espnHeadshot ?? null,
                ext: {
                    espnID: p?.espnID,
                    sleeperBotID: p?.sleeperBotID,
                    yahooPlayerID: p?.yahooPlayerID,
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
            const pos = String(p?.position ?? "").toUpperCase();
            if (!OFFENSE.has(pos)) continue;
            out.push({
                id: String(p?.playerID ?? p?.id ?? ""),
                name: p?.longName ?? p?.displayName ?? p?.name ?? "",
                position: pos as PlayerDTO["position"],
                teamAbv: teamAbv || null,
                isFA: !teamAbv,
                jerseyNum: toNum(p?.jersey ?? p?.jerseyNum),
                age: toNum(p?.age),
                headshot: p?.headshot ?? p?.espnHeadshot ?? null,
                ext: { 
                    espnID: p?.espnID, 
                    sleeperBotID: p?.sleeperBotID,
                    // yahooPlayerID: p?.yahooPlayerID,
                },
            });
        }
    }
    return out;
}


// export type TeamRosterDTO = {
//     teamAbv: string;
//     teamCity: string;
//     teamName: string;
//     players: PlayerDTO[];
// };

// const OFFENSE = new Set(["QB", "RB", "WR", "TE", "FB", "K"]);

// export function mapTankRostersToOffense(api: any): TeamRosterDTO[] {
//     const teams: any[] = api?.body ?? api  ?? [];
//     return teams.map((t) => {
//         const roster: any[] = t?.roster ?? [];
//         const offenseOnly = roster.filter((p) => 
//         OFFENSE.has((p?.position ?? "").toUpperCase())
//     );
//     const players = offenseOnly.map((p) => ({
//         id: String(p?.playerID ?? p?.id ?? ""),
//         name: p?.longName ?? p?.displayName ?? p?.name ?? "",
//         position: (p?.position ?? "").toUpperCase(),
//         jersey: p?.jersey ?? null,
//         teamAbv: t?.teamAbv,
//     }));
//     return {
//         teamAbv: t?.teamAbv,
//         teamCity: t?.teamCity,
//         teamName: t?.teamName,
//         players,
//     };
//   });
// }

// export function pickTeamRoster(dtoList: TeamRosterDTO[], teamAbv: string): TeamRosterDTO | null {
//     const abv = teamAbv.toUpperCase();
//     return dtoList.find((x) => x.teamAbv?.toUpperCase() === abv) ?? null;
// }