import { useMemo, useState } from "react";
import styles from './players.module.css';
import { useNFLPlayers } from "../hooks/usePlayers";
import { useDebounced } from "../hooks/useDebounced";

const LEAGUE_ID = 1; // can adjust later if app expands to designate actual league id number
const TEAM_ID = 1;
const POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function Players() {
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [page, setPage] = useState(1);
    const [week, setWeek] = useState<number | string>("");
    
    const limit = 50;
    // prevents creating a unique cache entry per keystroke
    const debouncedSearch = useDebounced(search, 300);

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
    const serverWeek = data?.week;
    const serverSeason = data?.season;

    const headerNote = useMemo(
        () => (isFetching ? "(refreshing...)" : ""),
        [isFetching]
    );

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
                        onChange={(e) => { setPosition(e.target.value); setPage(1); }}
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
                        onChange={(e) => { setWeek(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}
                        aria-label="NFL week"
                    >
                        <option value="">Current Week</option>
                        {WEEKS.map((w) => (
                            <option key={w} value={w}>{`Week ${w}`}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className={styles.playersSearchButton}
                    >
                        {isFetching ? "Play call incoming..." : "Search"}
                    </button>
                </div>
            </div>

            <div className={styles.playersMetaRow}>
                <span>Total: {total.toLocaleString()}</span>
                <span>Page {page} / {pageCount}</span>
            </div>

            {items.length === 0 ? (
                <p className={styles.playersState}>🧐 No players found</p>
            ) : (
                <ul className={styles.playersGrid}>
                    {items.map((p) => (
                        <li key={p.id} className={styles.playersCard}>
                            <div className={styles.playersCardTop}>
                                {p.headshot ? (
                                    <img className={styles.headshot} src={p.headshot} alt={p.name} />
                                ) : (
                                    <div className={styles.headshotFallback}>{p.position}</div>
                                )}
                                <div className={styles.playersIndent}>
                                    <div className={styles.playersNameRow}>
                                        <strong className={styles.playersName}>{p.name}</strong>
                                        <span className={styles.posTeam}>
                                            {p.position} • {p.teamAbv ?? "FA"}
                                        </span>
                                    </div>
                                    <div className={styles.playersOppRow}>
                                        <span className={styles.playersOppBadge}>
                                            {p.oppAbv ? `vs ${p.oppAbv}` : "--"}
                                        </span>
                                        <span className={styles.playersKickoff}>
                                            {fmtKickoff(p.kickoffIso)}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.playersProj}>
                                    {typeof p.projPts === "number" ? (
                                    <span className={styles.playerProjPts}>{p.projPts.toFixed(1)} pts</span>
                                    ) : (
                                    <span className={styles.playersProjNA}>-</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className={styles.playersCardBottom}>
                                {p.managedBy ? (
                                    <span className={styles.playersOwnedBadge}>
                                        {p.managedBy.managerTeamName}
                                        <span className={styles.managerNote}>({p.managedBy.managerName})</span>
                                    </span>
                                ) : p.available ? (
                                    <button
                                        className={styles.addBtn}
                                        onClick={(() => onAdd(p.id))}
                                        title="Add to my team"
                                    > + </button>
                                ) : (
                                    <span className={styles.faNote}>Unavailable</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
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
