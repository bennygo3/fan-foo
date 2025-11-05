import { useState } from "react";
import { useNFLPlayers } from "../hooks/usePlayers";
import { useDebounced } from "../hooks/useDebounced";

const POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];

export default function Players() {
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [page, setPage] = useState(1);
    const [week, setWeek] = useState(8);
    const limit = 40;

    // prevents creating a unique cache entry per keystroke
    const debouncedSearch = useDebounced(search, 300);

    const { data, isLoading, isError, error, isFetching, refetch } =
    useNFLPlayers({ 
        season: "2025", 
        search: debouncedSearch, 
        position, 
        page, 
        limit, 
        sort: "proj" ,
        week
    
    });

    if (isLoading) return <p>Loading players...</p>;
    if (isError) return <p>Failed to load: {(error as Error).message}</p>;

    const items = data?.items ?? [];
    const total = data?.total ?? items.length;
    const pageCount = Math.max(1, Math.ceil(total/limit));

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <h2>Players {isFetching ? "(refreshing...)" : ""}</h2>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search players..."
                    aria-label="Search players"
                />
                <select
                    value={position}
                    onChange={(e) => { setPosition(e.target.value); setPage(1); }}
                    aria-label="Filter by position"
                >
                    <option value="">All</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                    type="number"
                    min="1"
                    max="18"
                    value={week}
                    onChange={(e) => { setWeek(Number(e.target.value)); setPage(1); }}
                    style={{ width: 60 }}
                    aria-label="NFL week number"
                />

                <button onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? "Refreshing..." : "Search"}
                </button>
            </div>

            <div style={{ opacity: isFetching ? 0.6 : 1 }}>
                {items.length === 0 ? (
                    <p>🧐 No players found.</p>
                ) : (
                    <ul>
                        {items.map(p => (
                            <li key={p.id}>
                                <strong>{p.name}</strong> - {p.position} - {p.projPts} 
                                {p.headshot && <img src={p.headshot} alt={p.name} width={32} style={{ borderRadius: "50%", marginRight: 8 }} />}
                                {" • "}
                                {p.teamAbv ?? "FA"}
                                {p.projPts !== undefined && (
                                    <>{" • "}
                                    <span style={{ color: "#7fffd4" }}>
                                        {p.projPts.toFixed(1)} pts
                                    </span>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page <= 1}>Prev</button>
                <span>Page {page} / {pageCount}</span>
                <button onClick={() => setPage(x => Math.min(pageCount, x + 1))} disabled={page >= pageCount}>Next</button>
            </div>
        </div>
    )

}
