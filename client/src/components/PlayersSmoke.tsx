import { useEffect, useState } from "react";

type Team = { id: number; abbr: string; name: string };
type Player = { id: number; name: string; position: string; team?: Team | null };
type ApiResponse = { items: Player[]; total?: number; page?: number; limit?: number };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PlayersSmoke() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/players`, { credentials: "include" });
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
                const json = (await res.json()) as ApiResponse;
                console.log("GET /players response:", json);
                setData(json);
            } catch (e: any) {
                console.error("smoke fetch failed:", e);
                setErr(e.message ?? String(e));
            }
        })();
    }, []);

    if (err) return <div>❌ Fetch error: {err}</div>;
    if (!data) return <div>Loading players...</div>;

    return (
        <div>
            <div>✅ Loaded {data.items.length} players</div>
            <ul>
                {data.items.slice(0, 5).map(p => (
                    <li key={p.id}>
                        <strong>{p.name}</strong> - {p.position} {p.team ? `• ${p.team.abbr}` : ""}
                    </li>
                ))}
            </ul>
        </div>
    );
}
