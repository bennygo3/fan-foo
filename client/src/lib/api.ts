export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type Player = {
    id: string; 
    name: string; 
    position: string;
    teamAbv: string | null; 
    isFA: boolean;
    jerseyNum?: number | null; 
    headshot?: string | null;
};

export type Paginated<T> = { 
    items: T[]; 
    total?: number; 
    page?: number; 
    limit?: number 
};

export async function getNFLPlayers(params: {
    season?: string;
    search?: string;
    position?: string;
    teamAbv?: string;
    freeAgents?: boolean;
    page?: number;
    limit?: number;
    sort?: "name" | "position" | "team";
}) {
    const url = new URL(`${API_BASE_URL}/nfl/players`);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error(`GET /nfl/players failed: ${res.status}`);
    return (await res.json()) as Paginated<Player>;
}