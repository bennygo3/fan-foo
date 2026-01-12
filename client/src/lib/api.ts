export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type ManagedBy = {
    managerId: number | null;
    managerTeamName: string;
    managerName: string | null;
} | null;

export type Player = {
    id: number;
    name: string;
    position: string;
    teamAbv: string | null;
    isFA?: boolean;
    jerseyNum?: number | null;
    headshot?: string | null;
    projPts?: number | null;
    oppAbv?: string | null;
    kickoffIso?: string | null;
    managedBy?: ManagedBy;
    available?: boolean;
};

export type Paginated<T> = {
    items: T[];
    total?: number;
    page?: number;
    limit?: number;
    week?: number;
    season?: number;
}

export type SlotType = 
| "QB"
| "RB"
| "WR"
| "TE"
| "FLEX"
| "DST"
| "K"
| "BN"
| "IR";

export type RosterSlot = {
    id: number;
    leagueId: number;
    teamId: number;
    slot: SlotType;
    playerId: number | null;
    player?: {
        id: number;
        name: string;
        position: string;
        headshotUrl?: string | null;
        team?: { 
            abbr: string; 
            name: string;
            logoUrl?: string | null;
        };
    } | null;
    oppAbv?: string | null;
    kickoffIso?: string | null;
    isHome?: boolean | null;
    projPts?: number | null;
    livePts?: number | null;
};

// backend add/drop return
export type RosterMutationResponse = {
    message: string;
    slot: RosterSlot;
}

// My Team types - helper
export type TeamSummary = {
    id: number;
    name: string;
    league: { id: number; name: string; };
    manager: { id: number; username: string; email: string } | null;
};

export type MyTeamApiResponse = {
    leagueId: number;
    team: TeamSummary;
    week: number;
    season: number;
    roster: {
        starters: RosterSlot[];
        bench: RosterSlot[];
        ir: RosterSlot[];
    };
};

export async function getMyTeam(opts: {
    leagueId: number | string;
    teamId: number | string;
    season?: number | string;
    week?: number | string;
}) {
    const { leagueId, teamId, season, week } = opts;
    const url = new URL(
        `${API_BASE_URL}/leagues/${leagueId}/teams/${teamId}/roster`
    );

    if (season) url.searchParams.set("season", season);
    if (week !== undefined && week !== "") {
        url.searchParams.set("week", String(week));
    }

    const res = await fetch(url.toString(), { credentials: "include" });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(
            `GET /leagues/${leagueId}/teams/${teamId}/roster failed: ${res.status} ${text}`
        );
    }

    return (await res.json()) as MyTeamApiResponse;
}
    
// Player FA pool
export async function getPlayerPool(opts: {
    leagueId: number | string;
    season?: string;
    week?: number | string;
    search?: string;
    position?: string;
    teamAbv?: string;
    freeAgents?: boolean;
    page?: number;
    limit?: number; 
    sort?: "name" | "position" | "team" | "proj";
}) {
    const { 
        leagueId, 
        season,
        week,
        search,
        position,
        teamAbv,
        freeAgents,
        page,
        limit,
        sort,
    } = opts;

    const url = new URL(`${API_BASE_URL}/leagues/${leagueId}/player-pool`);

    if (season) url.searchParams.set("season", season);
    if (week !== undefined && week !== "") url.searchParams.set("week", String(week));
    if (search) url.searchParams.set("search", search);
    if (position) url.searchParams.set("position", position);
    if (teamAbv) url.searchParams.set("teamAbv", teamAbv);
    if (freeAgents) url.searchParams.set("freeAgents", "true");
    if (page) url.searchParams.set("page", String(page));
    if (limit) url.searchParams.set("limit", String(limit));
    if (sort) url.searchParams.set("sort", sort);

    const res = await fetch(url.toString(), { credentials: "include" });

    if (!res.ok) {
        throw new Error(`GET /leagues/${leagueId}/player-pool failed: ${res.status}`);
    }

    return (await res.json()) as Paginated<Player>;
}

export async function moveRosterSlot(opts: {
    leagueId: number;
    teamId: number;
    fromRosterSlotId: number;
    toRosterSlotId: number;
    season?: number | string;
    week?: number | string;
}) {
    const url = new URL(`${API_BASE_URL}/leagues/${opts.leagueId}/teams/${opts.teamId}/roster/move`);
    if (opts.season !== undefined && opts.season !== "") url.searchParams.set("season", String(opts.season));
    if (opts.week !== undefined && opts.week !== "") url.searchParams.set("week", String(opts.week));

    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fromRosterSlotId: opts.fromRosterSlotId,
            toRosterSlotId: opts.toRosterSlotId,
        }),
    });

    const text = await res.text();
    let payload: any = null;
    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        // keep payload null; html/plaintext
    }

    if (!res.ok) {
        throw new Error(payload?.error ?? `Move failed (${res.status})`);
    }

    return payload as {
        message: string;
        fromRosterSlotId: number;
        toRosterSlotId: number;
        swapped: boolean;
        season: number;
        week: number;
    }
}

export async function addPlayerToRoster(opts: {
    leagueId: number;
    teamId: number;
    playerId: number;
    slot?: SlotType;
}) {
    const payload: any = {
        teamId: opts.teamId,
        playerId: opts.playerId,
    };

    if (opts.slot) {
        payload.slot = opts.slot;
    }

    const res = await fetch(
        `${API_BASE_URL}/leagues/${opts.leagueId}/teams/${opts.teamId}/roster/add`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(
            `POST .../${opts.leagueId}/teams/${opts.teamId}/roster/add failed: ${res.status} ${text}`
        );
    }

    return (await res.json()) as RosterMutationResponse;
}

export async function dropPlayerFromRoster(opts: {
    leagueId: number;
    teamId: number;
    rosterSlotId: number;
}) {
    const res = await fetch(
        `${API_BASE_URL}/leagues/${opts.leagueId}/teams/${opts.teamId}/roster/drop`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rosterSlotId: opts.rosterSlotId,
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(
            `POST /leagues/${opts.leagueId}/teams/${opts.teamId}/roster/drop failed ${text}`
        );
    }

    return (await res.json()) as RosterMutationResponse;
}

export type DSTProjections = {
    teamAbv: string;
    projPts: number;
    sacks: number;
    interceptions: number;
    fumbleRecoveries: number;
    safeties: number;
    defTD: number;
    returnTD: number;
    blockKick: number;
    ptsAgainst: number;
};

export async function getDSTProjections(params: {
    season?: string;
    week?: number | string;
    sort?: "proj" | "team";
    teamAbv?: string;
}) {
    const url = new URL(`${API_BASE_URL}/nfl/dst`);

    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), { credentials: "include" });

    if (!res.ok) {
        throw new Error(`GET /nfl/dst failed: ${res.status}`);
    }

    return (await res.json()) as {
        items: DSTProjections[];
        total?: number;
        week?: number;
        season?: string;
    };
}

export type NflTeam = {
    id: number;
    abbr: string;
    name: string;
    logoUrl: string | null;
    byeWeeksBySeason?: Record<string, number> | null;
};

export async function getNflTeams(): Promise<{ items: NflTeam[] }> {
    const res = await fetch(`${API_BASE_URL}/teams`, { credentials: "include" });
    if (!res.ok) { throw new Error(`GET /teams failed: ${res.status} ${await res.text()}`); }
    return (await res.json()) as { items: NflTeam[] };
}

export type Game = {
    week: number;
    season: number;
    startTime: string | null;
    homeTeam: { abbr: string };
    awayTeam: { abbr: string };
}

export async function getSchedule(params: { week?: number | string }) {
    const url = new URL(`${API_BASE_URL}/nfl/schedule`);
    if (params.week !== undefined && params.week !== "") url.searchParams.set("week", String(params.week));

    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error(`GET /nfl/schedule failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as Game[];
}

// export async function getNflTeams(): Promise<NflTeam[]> {
//     const res = await fetch(`${API_BASE_URL}/teams`, {
//         credentials: "include",
//     });

//     if (!res.ok) {
//         const text = await res.text();
//         throw new Error(`GET /teams failed: ${res.status} ${text}`);
//     }

//     // return (await res.json()) as { items: NflTeam[] };
//     const data = await res.json();

//     // support both shapes `[{...}, ...]` or `{ items: [{...}, ...]}`
//     if (Array.isArray(data)) {
//         return data as NflTeam[];
//     }

//     if (Array.isArray(data?.items)) {
//         return data.items as NflTeam[];
//     }

//     console.warn("unexpected /teams payload:", data);
//     return [];
// }
    