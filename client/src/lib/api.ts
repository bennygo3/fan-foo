export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export type Team = { id: number; abbr: string; name: string };
export type Player = {
    id: number; name: string; position: string;
    teamId: number | null; team?: Team | null;
    projPts?: number | null; adp?: number | null;
};

export type Paginated<T> = { items: T[]; total?: number; page?: number; limit?: number };

export async function getPlayers(params?: { search?: string; position?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search)    qs.set("search", params.search);
    if (params?.position)  qs.set("position", params.position);
    if (params?.page)      qs.set("page", String(params.page));
    if (params?.limit)     qs.set("limit", String(params.limit));

    const res = await fetch(`${API_BASE_URL}/players${qs.size ? `?${qs}` : ""}`, {
        credentials: "include",
    });
    if (!res.ok) throw new Error(`Get /players failed: ${res.status}`);
    return (await res.json()) as Paginated<Player>;
}