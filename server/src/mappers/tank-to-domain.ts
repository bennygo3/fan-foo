export type PlayerDTO = {
    id: string;
    name: string;
    position: string;
    jersey?: string | null;
    teamAbv: string;
};

export type TeamRosterDTO = {
    teamAbv: string;
    teamCity: string;
    teamName: string;
    players: PlayerDTO[];
};

const OFFENSE = new Set(["QB", "RB", "WR", "TE", "FB", "K"]);

export function mapTankRostersToOffense(api: any): TeamRosterDTO[] {
    const teams: any[] = api?.body ?? api  ?? [];
    return teams.map((t) => {
        const roster: any[] = t?.roster ?? [];
        const offenseOnly = roster.filter((p) => 
        OFFENSE.has((p?.position ?? "").toUpperCase())
    );
    const players = offenseOnly.map((p) => ({
        id: String(p?.playerID ?? p?.id ?? ""),
        name: p?.longName ?? p?.displayName ?? p?.name ?? "",
        position: (p?.position ?? "").toUpperCase(),
        jersey: p?.jersey ?? null,
        teamAbv: t?.teamAbv,
    }));
    return {
        teamAbv: t?.teamAbv,
        teamCity: t?.teamCity,
        teamName: t?.teamName,
        players,
    };
  });
}

export function pickTeamRoster(dtoList: TeamRosterDTO[], teamAbv: string): TeamRosterDTO | null {
    const abv = teamAbv.toUpperCase();
    return dtoList.find((x) => x.teamAbv?.toUpperCase() === abv) ?? null;
}