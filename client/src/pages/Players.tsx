import { useMemo, useState } from "react";
import styles from './players.module.css';
import { useNFLPlayers } from "../hooks/usePlayers";
import { useDebounced } from "../hooks/useDebounced";

const LEAGUE_ID = 1; // can adjust later if app expands to designate actual league id number
const TEAM_ID = 1; // TODO: make dynamic
const POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function Players() {
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [page, setPage] = useState(1);
    const [week, setWeek] = useState<number | string>("");

    const limit = 50;
    const debouncedSearch = useDebounced(search, 300);  // prevents creating a unique cache entry per keystroke

    const { data, isLoading, isError, error, isFetching, refetch } =
        useNFLPlayers({
            season: "2025",
            week,
            search: debouncedSearch,
            position,
            page,
            limit,
            sort: "proj",
            leagueId: LEAGUE_ID,
            staleTime: 60 * 60 * 1000, // 1h cache while building
        });

    const items = data?.items ?? [];
    const total = data?.total ?? items.length;
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const serverWeek = (data as any)?.week;
    const serverSeason = (data as any)?.season;

    const headerNote = useMemo(() => (isFetching ? "(refreshing...)" : ""), [isFetching]);

    function fmtKickoff(iso?: string | null) {
        if (!iso) return "TBD";
        try {
            const d = new Date(iso);
            // need to refine later for timezones
            return d.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch {
            return iso;
        }
    }

    const onAdd = async (playerId: string) => {
        try {
            // TODO: make TEAM_ID dynamic (user's chosen team)
            const res = await fetch(`/leagues/${LEAGUE_ID}/teams/${TEAM_ID}/roster`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ playerId, slot: "BN" }),
                credentials: "include",
            });
            if (!res.ok) throw new Error(await res.text());
            refetch();
        } catch (e) {
            console.error("Add failed", e);
            alert("Could not add player.");
        }
    };

    if (isLoading) return <p className={styles.state}>Loading players...</p>;
    if (isError) return <p className={styles.state}>Failed to load: {(error as Error).message}</p>;

    return (
        <div className={styles.playersContainer}>
            <div className={styles.playersHeaderRow}>
                <h2 className={styles.playersHeader}>
                    Players {headerNote}{" "}
                    {serverWeek ? <span className={styles.subtle}>• Week {serverWeek}</span> : null}
                    {serverSeason ? <span className={styles.subtle}> • {serverSeason}</span> : null}
                </h2>

                {/* Filters / search bar */}
                <div className={styles.playersControls}>
                    <input
                        className={styles.playersSearchInput}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search for a player..."
                        aria-label="Search players"
                    />

                    <select
                        className={styles.playersSelectPosition}
                        value={position}
                        onChange={(e) => {
                            setPosition(e.target.value);
                            setPage(1);
                        }}
                        aria-label="Filter by position"
                    >
                        <option value="">All</option>
                        {POSITIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        className={styles.playersSelectWeek}
                        value={String(week)}
                        onChange={(e) => {
                            setWeek(e.target.value === "" ? "" : Number(e.target.value));
                            setPage(1);
                        }}
                        aria-label="NFL week"
                    >
                        <option value="">Current Week</option>
                        {WEEKS.map((w) => (
                            <option key={w} value={w}>{`Week ${w}`}</option>
                        ))}
                    </select>

                    <button onClick={() => refetch()} disabled={isFetching} className={styles.playersSearchButton}>
                        {isFetching ? "Play call incoming..." : "Search"}
                    </button>
                </div>
            </div>

            <div className={styles.playersMetaRow}>
                <span>Total: {total.toLocaleString()}</span>
                <span>Page {page} / {pageCount}</span>
            </div>

            {/* Table view with Header Row */}
            <div className={styles.table}>
                <div className={styles.thead}>
                    <div className={styles.colPlayer}>Player</div>
                    <div className={styles.colPos}>Pos</div>
                    <div className={styles.colTeam}>Team</div>
                    <div className={styles.colOpp}>Opp</div>
                    <div className={`${styles.colProj} ${styles.right}`}>Proj</div>
                    <div className={`${styles.colAction} ${styles.center}`}>Action</div>
                </div>

                {items.length === 0 ? (
                    <div className={styles.playersState}>🧐 No players found</div>
                ) : (
                    <ul className={styles.tbody}>
                        {items.map((p) => (
                            <li key={p.id} className={styles.row}>
                                <div className={styles.playerCell}>
                                    {p.headshot ? (
                                        <img src={p.headshot} alt={p.name} width={50} height={50} className={styles.headshot} />
                                    ) : (
                                        <div className={styles.headshotFallback}>{p.position}</div>
                                    )}
                                    <div>
                                        <div className={styles.name}>{p.name}</div>
                                        <div className={styles.subline}>
                                            {p.oppAbv ? `vs ${p.oppAbv}` : "-"} · {fmtKickoff(p.kickoffIso)}
                                        </div>
                                        {!p.available && p.managedBy ? (
                                            <div className={styles.claimNote}>
                                                {p.managedBy.managerTeamName} ({p.managedBy.managerName})
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div>{p.position}</div>
                                <div>{p.teamAbv ?? "FA"}</div>
                                <div>{p.oppAbv ?? "-"}</div>

                                <div className={styles.right}>
                                    {typeof p.projPts === "number" ? p.projPts.toFixed(1) : "-"}
                                </div>

                                {/* Action: add */}
                                <div className={styles.center}>
                                    <button
                                        className={styles.addBtn}
                                        disabled={!p.available}
                                        onClick={() => onAdd(p.id)}
                                        title={p.available ? "Add" : "Already owned"}
                                    >
                                        +
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Pagination */}
            <div className={styles.playersPager}>
                <button
                    className={styles.playersPageButton}
                    onClick={() => setPage((x) => Math.max(1, x - 1))}
                    disabled={page <= 1}
                >
                    Prev
                </button>
                <span className={styles.playerPageInfo}>Page {page} / {pageCount}</span>
                <button
                    className={styles.playersPageBtn}
                    onClick={() => setPage((x) => Math.min(pageCount, x + 1))}
                    disabled={page >= pageCount}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
