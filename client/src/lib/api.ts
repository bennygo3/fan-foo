export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type ManagedBy = {
    managerId: number;
    managerTeamName: string;
    managerName: string;
} | null;

export type Player = {
    id: number;
    name: string;
    position: string;
    teamAbv: string | null;
    isFA: boolean;
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
    season?: string;
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
        team?: { abbr: string; name: string };
    } | null;
};

export type MyTeamResponse = {
    leagueId: number;
    teamId: number;
    teamName: string;
    managerName: string;
    week: number;
    starters: RosterSlot[];
    bench: RosterSlot[];
    ir: RosterSlot[];
};



// Player FA pool
export async function getPlayerPool(opts: {
    leagueId: number | string;
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
        search,
        position,
        teamAbv,
        freeAgents,
        page,
        limit,
        sort,
    } = opts;

    const url = new URL(`${API_BASE_URL}/leagues/${leagueId}/player-pool`);

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

export async function addPlayerToRoster(opts: {
    leagueId: number;
    teamId: number;
    playerId: number;
    slot?: SlotType;
}) {
    const res = await fetch(
        `${API_BASE_URL}/leagues/${opts.leagueId}/rosters/add`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teamId: opts.teamId,
                playerId: opts.playerId,
                slot: opts.slot,
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(
            `POST .../${opts.leagueId}/rosters/add failed: ${res.status} ${text}`
        );
    }

    return (await res.json()) as MyTeamResponse;
}

export type DSTProjections = {
    teamAbv: string;
    projPts: number;
    sacks: number;
    interceptions: number;
    fumbleRecoveries: number;
    safeties: number;
    defTd: number;
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

export async function dropPlayerFromRoster(opts: {
    leagueId: number;
    rosterSlotId: number;
}) {
    const res = await fetch(
        `${API_BASE_URL}/leagues/${opts.leagueId}/rosters/drop`,
        {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "applications/json" },
            body: JSON.stringify({
                rosterSlotId: opts.rosterSlotId,
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(
            `POST /leagues/${opts.leagueId}/rosters/drop failed ${text}`
        );
    }

    return (await res.json()) as MyTeamResponse;
}
    