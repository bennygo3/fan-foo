import { useMemo, useState, useEffect } from "react";
import styles from './players.module.css';
import { useNFLPlayers } from "../hooks/usePlayers";
import { getNflTeams, type NflTeam } from "../lib/api";
import { useDebounced } from "../hooks/useDebounced";
import { addPlayerToRoster } from "../lib/api";

const LEAGUE_ID = 1; // can adjust later if app expands to designate actual league id number
const TEAM_ID = 6; // TODO: make dynamic
const POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function Players() {
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [byAbbr, setByAbbr] = useState<Map<string, NflTeam>>(new Map());
    const [page, setPage] = useState(1);
    const [week, setWeek] = useState<number | string>("");

    const limit = 50;
    const debouncedSearch = useDebounced(search, 300);  // prevents creating a unique cache entry per keystroke

    // Load nfl teams once so logos can be used for d/st
    useEffect(() => {
        (async () => {
            try {
                const resp = await getNflTeams();
                const allTeams: NflTeam[] = resp.items ?? [];
                setByAbbr(new Map(allTeams.map((t: NflTeam) => [t.abbr.toUpperCase(), t])));
            } catch (e) {
                console.error("Failed to load NFL teams", e);
            }
        })();
    }, []);

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

    // function fmtKickoff(iso?: string | null) {
    //     if (!iso) return "TBD";
    //     try {
    //         const d = new Date(iso);
    //         // need to refine later for timezones
    //         return d.toLocaleString(undefined, {
    //             weekday: "short",
    //             month: "short",
    //             day: "numeric",
    //             hour: "numeric",
    //             minute: "2-digit",
    //         });
    //     } catch {
    //         return iso;
    //     }
    // }

    const onAdd = async (playerId: number) => {
        try {
            await addPlayerToRoster({
                leagueId: LEAGUE_ID,
                teamId: TEAM_ID,
                playerId,
            });
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
                        {POSITIONS.map((p) => (
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
                    <div className={styles.colOpp}>Opp</div>
                    <div className={`${styles.colProj} ${styles.right}`}>Proj</div>
                    <div className={`${styles.colAction} ${styles.center}`}>Action</div>
                </div>

                {items.length === 0 ? (
                    <div className={styles.playersState}>🧐 No players found</div>
                ) : (
                    <ul className={styles.tbody}>
                        {items.map((p) => {
                            const teamMeta = p.teamAbv 
                            ? byAbbr.get(p.teamAbv.toUpperCase())
                            : undefined;
                            
                            const isDst =
                            p.position === "DST" ||
                            p.position === "D/ST" ||
                            p.position === "DEF";

                            const logoUrl = isDst ? teamMeta?.logoUrl ?? null : null;

                            // player column label
                            const primaryName = isDst
                            ? `${teamMeta?.name ?? p.teamAbv ?? "D/ST"} D/ST`
                            : p.name;

                            // subline under player or team name
                            const subline = teamMeta 
                            ? `${teamMeta.name} • ${isDst ? "D/ST" : p.position}`
                            : `${p.teamAbv ?? ""} ${isDst ? "D/ST" : p.position}`;

                            // opponent column
                            let oppLine1 = "-";
                            let oppLine2 = "";

                            if (p.oppAbv && p.kickoffIso) {
                                const d = new Date(p.kickoffIso);

                                oppLine1 = `vs ${p.oppAbv} • ${d.toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                })}`;

                                oppLine2 = d.toLocaleTimeString(undefined, {
                                    hour: "numeric",
                                    minute: "2-digit"
                                });
                            }
                            // const oppDetail = p.oppAbv 
                            // ? `vs ${p.oppAbv} · ${fmtKickoff(p.kickoffIso)}`
                            // : "-";


                            return (
                                <li key={p.id} className={styles.row}>
                                    <div className={styles.playerCell}>
                                        {logoUrl && isDst ? (
                                            <img
                                                src={logoUrl}
                                                alt={primaryName}
                                                className={styles.teamLogo}
                                            />
                                        ) : p.headshot ? (
                                            <img
                                                src={p.headshot}
                                                alt={p.name}
                                                width={50}
                                                height={50}
                                                className={styles.headshot}
                                            />
                                        ) : (
                                            <div className={styles.headshotFallback}>
                                                {p.position}
                                            </div>
                                        )}

                                        <div>
                                            <div className={styles.name}>
                                                {primaryName}
                                            </div>
                                            <div className={styles.subline}>
                                                {subline}
                                            </div>
                                            {!p.available && p.managedBy ? (
                                                <div className={styles.claimNote}>
                                                    {p.managedBy.managerTeamName} (
                                                    {p.managedBy.managerName})
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    
                                    {/* Opponent column */}
                                    <div className={styles.colOppValue}>
                                        <div className={styles.oppLine1}>{oppLine1}</div>
                                        {oppLine2 && <div className={styles.oppLine2}>{oppLine2}</div>}
                                    </div>
                                    {/* <div className={styles.colOppValue}>{oppDetail}</div> */}
                                    
                                    {/* Projected points column */}
                                    <div className={`${styles.colProj} ${styles.right}`}>
                                        {typeof p.projPts === "number" ? p.projPts.toFixed(1) : "-"}
                                    </div>

                                    {/* Action: add */}
                                    <div className={styles.playersBtn}>
                                        <button
                                            className={styles.addBtn}
                                            disabled={p.available === false}
                                            onClick={() => onAdd(p.id)}
                                            title={p.available === true ? "Add" : "N/A"}
                                        >
                                            +
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
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
