import { useState } from "react";
import styles from './players.module.css';
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
            sort: "proj",
            week

        });

    if (isLoading) return <p>Loading players...</p>;
    if (isError) return <p>Failed to load: {(error as Error).message}</p>;

    const items = data?.items ?? [];
    const total = data?.total ?? items.length;
    const pageCount = Math.max(1, Math.ceil(total / limit));

    return (
        <div className={styles.playersContainer}>
            <h2 className={styles.header}>
                Players {isFetching ? "(refreshing...)" : ""}
            </h2>

            {/* Filters / search bar */}
            <div className={styles.filterBar}>
                <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search for a player..."
                    aria-label="Search players"
                    className={styles.searchInput}
                />
                <select
                    value={position}
                    onChange={(e) => { setPosition(e.target.value); setPage(1); }}
                    aria-label="Filter by position"
                    className={styles.selectInput}
                >
                    <option value="">All</option>
                    {POSITIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                
            </div>
        </div>
    )

}
