// this is not being used to preserve external calls...
// - but is fully functional and avaialble

// export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

// export type ManagedBy = {
//     managerId: number;
//     managerTeamName: string;
//     managerName: string;
// } | null; 

// export type Player = {
//     id: string; 
//     name: string; 
//     position: string;
//     teamAbv: string | null; 
//     isFA: boolean;
//     jerseyNum?: number | null; 
//     headshot?: string | null;
//     projPts?: number;
//     oppAbv?: string | null;
//     kickoffIso?: string | null;
//     managedBy?: ManagedBy;
//     available?: boolean;
// };

// export type Paginated<T> = { 
//     items: T[]; 
//     total?: number; 
//     page?: number; 
//     limit?: number;
//     week?: number;
//     season?: string;
// };

// export async function getNFLPlayers(params: {
//     leagueId?: number | string;
//     season?: string;
//     week?: number | string;   // only needed when sorted by "proj"
//     search?: string;
//     position?: string;
//     teamAbv?: string;
//     freeAgents?: boolean;
//     page?: number;
//     limit?: number;
//     sort?: "name" | "position" | "team" | "proj";
// }) {
//     const url = new URL(`${API_BASE_URL}/nfl/players`);
//     for (const [k, v] of Object.entries(params)) {
//         if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
//     }
//     const res = await fetch(url.toString(), { credentials: "include" });
//     if (!res.ok) throw new Error(`GET /nfl/players failed: ${res.status}`);
//     return (await res.json()) as Paginated<Player>;
// }

// export type DSTProjection = {
//     teamAbv: string;
//     projPts: number;
//     sacks: number;
//     interceptions: number;
//     fumbleRecoveries: number;
//     safeties: number;
//     defTD: number;
//     returnTD: number;
//     blockKick: number;
//     ptsAgainst: number;
// };

// export async function getDSTProjections(params: { 
//     season?: string; 
//     week?: number | string; 
//     sort?: "proj"|"team"; 
//     teamAbv?: string 
// }) {
//     const url = new URL(`${API_BASE_URL}/nfl/dst`);
//     for (const [k, v] of Object.entries(params)) {
//         if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
//     }
//     const res = await fetch(url.toString(), { credentials: "include" });
//     if (!res.ok) throw new Error(`GET /nfl/dst failed ${res.status}`);
//     return await res.json() as { items: DSTProjection[]; total?: number; week?: number; season?: string };
// }