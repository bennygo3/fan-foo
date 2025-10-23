import { useState } from "react";
import { useNFLPlayers } from "../hooks/usePlayers";
import { useDebounced } from "../hooks/useDebounced";

const POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];

export default function Players() {
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [page, setPage] = useState(1);
    const limit = 40;

    // prevents creating a unique cache entry per keystroke
    const debouncedSearch = useDebounced(search, 300);

    const { data, isLoading, isError, error, isFetching, refetch } =
    useNFLPlayers({ search: debouncedSearch, position, page, limit });

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
                                {p.headshot && <img src={p.headshot} alt={p.name} width={32} style={{ borderRadius: "50%", marginRight: 8 }} />}
                                <strong>{p.name}</strong> - {p.position} 
                                {" • "}
                                {p.teamAbv ?? "FA"}
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

// import { useQuery } from "@tanstack/react-query";

// type Player = { id: string; name: string; position: string; team: string  };

// export default function Players() {
//     const { data, isLoading, error } = useQuery({
//         queryKey: ["players"],
//         queryFn: async() => {
//             const res = await fetch("/players.json");
//             if (!res.ok) throw new Error("Failed to fetch in players .tsx");
//             return (await res.json()) as Player[];
//         },
        
//     });

//     if (isLoading) return <p>Loading players...</p>;
//     if (error) return <p>Could not load players players tsx</p>;

//     return (
//         <div>
//             <h1>Players</h1>
//             <ul>
//                 {data!.map(p => (
//                     <li key={p.id}>{p.name} | {p.position} | {p.team}</li>
//                 ))}
//             </ul>
//         </div>
//     );
// }