import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import styles from "./draft.module.css";
import { useDebounced } from "../hooks/useDebounced";
import { useNFLPlayers } from "../hooks/usePlayers";
import {
    getDraft,
    makeDraftPick,
    startDraft,
    undoLastDraftPick,
    updateDraftOrder,
    type DraftPick,
    type DraftStatus,
} from "../lib/api";
import {
    CURRENT_FANTASY_SEASON,
    DEFAULT_LEAGUE_ID,
} from "../config/fantasy";

const POSITIONS = [
    "QB",
    "RB",
    "WR",
    "TE",
    "DST",
    "K",
];

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "Something went wrong";
}

function statusClass(status: DraftStatus): string {
    switch (status) {
        case "IN_PROGRESS":
            return styles.statusLive;
        case "COMPLETED":
            return styles.statusComplete;
        case "PAUSED":
            return styles.statusPaused;
        default: 
            return styles.statusSetup;
    }
}

export default function Draft() {
    const params = useParams();
    const queryClient = useQueryClient();

    const parsedLeagueId = Number(params.leagueId);
    const leagueId =Number.isInteger(parsedLeagueId)
        ? parsedLeagueId
        : DEFAULT_LEAGUE_ID
    ;

    const season = CURRENT_FANTASY_SEASON;

    const [search, setSearch] = useState("");
    const [position, setPosition] = useState("");
    const [page, setPage] = useState(1);
    const [feedback, setFeedback] = useState("");
    const [actionError, setActionError] = useState("");

    const debouncedSearch = useDebounced(search, 300);
    const limit = 25;

    const draftQuery = useQuery({
        queryKey: ["draft", leagueId, season],
        queryFn: () =>
            getDraft({
                leagueId,
                season,
            }),
        staleTime: 0,
        refetchOnWindowFocus: false,
    });

    const playersQuery = useNFLPlayers({
        leagueId,
        season,
        search: debouncedSearch,
        position,
        freeAgents: true,
        page,
        limit,
        sort: "proj",
        staleTime: 0,
    });

    const refreshDraft = async () => {
        await queryClient.invalidateQueries({
            queryKey: ["draft", leagueId, season],
        });
    };

    const refreshDraftAndPlayers = async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: [
                    "draft",
                    leagueId,
                    season,
                ],
            }),
            queryClient.invalidateQueries({
                queryKey: ["nflPlayers"],
            }),
        ]);
    };

    const startMutation = useMutation({
        mutationFn: () => 
            startDraft({
                leagueId,
                season,
            }),
        onSuccess: async (response) => {
            setActionError("");
            setFeedback(response.message);
            await refreshDraft();
        },
        onError: (error) => {
            setFeedback("");
            setActionError(errorMessage(error));
        },
    });

    const pickMutation = useMutation({
        mutationFn: (playerId: number) => 
            makeDraftPick({
                leagueId,
                season,
                playerId,
            }),
        onSuccess: async (response) => {
            setActionError("");
            setFeedback(`${response.pick.player.name} drafted by ${response.pick.fantasyTeamSeason.name}`);
            await refreshDraftAndPlayers();
        },
    });

    const undoMutation = useMutation({
        mutationFn: () => 
            undoLastDraftPick({
                leagueId,
                season,
            }),
        onSuccess: async (response) => {
            setActionError("");
            setFeedback(`Undid ${response.undonePick.player.name}`);
            await refreshDraftAndPlayers();
        },
        onError: (error) => {
            setFeedback("");
            setActionError(errorMessage(error));
        },
    });

    const orderMutation = useMutation({
        mutationFn: (
            fantasyTeamSeasonIds: number[]
        ) => 
            updateDraftOrder({
                leagueId,
                season,
                fantasyTeamSeasonIds,
            }),
        onSuccess: async () => {
            setActionError("");
            setFeedback("Draft order updated");
            await refreshDraft();
        },
        onError: (error) => {
            setFeedback("");
            setActionError(errorMessage(error));
        },
    });

    const draft = draftQuery.data?.draft;
    const players = playersQuery.data?.items ?? [];
    const totalPlayers = playersQuery.data?.total ?? players.length;

    const playerPageCount = Math.max(
        1,
        Math.ceil(totalPlayers / limit)
    );

    const picksByRoundAndTeam = useMemo(() => {
        const map = new Map<string, DraftPick>();

        for (const pick of draft?.picks ?? []) {
            map.set(
                `${pick.round}:${pick.fantasyTeamSeasonId}`,
                pick
            );
        }

        return map;
    }, [draft?.picks]);

    const isBusy = 
        startMutation.isPending ||
        pickMutation.isPending ||
        undoMutation.isPending ||
        orderMutation.isPending
    ;

    const pendingPlayerId = pickMutation.isPending
        ? pickMutation.variables
        : undefined
    ;

    const handlePick = (
        playerId: number,
        playerName: string
    ) => {
        if (!draft?.onClock) return;

        const teamName = draft.onClock.fantasyTeamSeason.name;

        const confirmed = window.confirm(`Draft ${playerName} to ${teamName}?`);

        if (!confirmed) return;

        setFeedback("");
        setActionError("");
        pickMutation.mutate(playerId);
    };

    const handleUndo = () => {
        const lastPick = draft?.picks[draft.picks.length - 1];

        if (!lastPick) return;

        const confirmed = window.confirm(`Undo the selection of ${lastPick.player.name}?`);

        if (!confirmed) return;

        setFeedback("");
        setActionError("");
        undoMutation.mutate();
    };

    const moveParticipant = (
        currentIndex: number,
        direction: -1 | 1
    ) => {
        if (!draft) return;

        const nextIndex = currentIndex + direction;

        if (
            nextIndex < 0 ||
            nextIndex >= draft.participants.length
        ) {
            return;
        }

        const order = draft.participants.map(
            (participant) => participant.fantasyTeamSeasonId
        );

        [order[currentIndex], order[nextIndex]] = [
            order[nextIndex],
            order[currentIndex],
        ];

        setFeedback("");
        setActionError("");
        orderMutation.mutate(order);
    };

    if (draftQuery.isLoading) {
        return (
            <p className={styles.state}>Loading draft...</p>
        );
    }

    if (draftQuery.isError || !draft) {
        return (
            <p className={styles.stateError}>
                Failed to load draft:{" "}
                {errorMessage(draftQuery.error)}
            </p>
        );
    }

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>
                        Forever Unclean · {season}
                    </p>

                    <h1 className={styles.title}>
                        Draft Room
                    </h1>

                    <p className={styles.summary}>
                        Pick {draft.currentOverallPick} of{" "}
                        {draft.totalPicks} ·{" "}
                        {draft.rounds} rounds
                    </p>
                </div>

                <div className={styles.heroActions}>
                    <span 
                        className={`${styles.status} ${statusClass(
                            draft.status
                        )}`}
                    >
                        {draft.status.replace("_", " ")}
                    </span>

                    {draft.status === "SETUP" ? (
                        <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={isBusy}
                            onClick={() => {
                                setFeedback("");
                                setActionError("");
                                startMutation.mutate();
                            }}
                        >
                            {startMutation.isPending
                                ? "Starting..."
                                : "Start Draft"}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={
                            isBusy ||
                            draft.picks.length === 0
                        }
                        onClick={handleUndo}
                    >
                        {undoMutation.isPending
                            ? "Undoing..."
                            : "Undo Last Pick"}
                    </button>
                </div>
            </section>

            {draft.onClock ? (
                <section className={styles.onClock}>
                    <div>
                        <span className={styles.onClockLabel}>
                            On the clock
                        </span>

                        <h2>
                            {
                                draft.onClock.fantasyTeamSeason.name
                            }
                        </h2>

                        <p>
                            {
                                draft.onClock
                                    .fantasyTeamSeason
                                    .manager?.username
                            }{" "}
                            · Round{" "}
                            {draft.onClock.round} · Pick{" "}
                            {draft.onClock.pickInRound}
                        </p>
                    </div>

                    <strong>
                        #{draft.onClock.overallPick}
                    </strong>
                </section>
            ) : (
                <section className={styles.onClock}>
                    <h2>Draft complete</h2>
                </section>
            )}

            {feedback ? (
                <p className={styles.feedback}>
                    {feedback}
                </p>
            ) : null}

            {actionError ? (
                <p className={styles.actionError}>
                    {actionError}
                </p>
            ) : null}

            <section className={styles.section}>
                <div className={styles.sectionHeading}>
                    <div>
                        <p className={styles.eyebrow}>
                            Draft positions
                        </p>
                        <h2>Order</h2>
                    </div>

                    {draft.status === "SETUP" ? (
                        <span className={styles.hint}>
                            Use the arrows to adjust the order
                        </span>
                    ): null}
                </div>

                <ol className={styles.orderGrid}>
                    {draft.participants.map(
                        (participant, index) => {
                            const isCurrent = draft.onClock
                                ?.fantasyTeamSeason.id === 
                            participant
                                .fantasyTeamSeason.id;

                                return (
                                    <li 
                                        key={participant.id}
                                        className={
                                            isCurrent
                                                ? styles.currentOrderCard
                                                : styles.orderCard
                                        }
                                    >
                                        <span 
                                            className={
                                                styles.orderNumber
                                            }
                                        >
                                            { participant.draftPosition }
                                        </span>

                                        <div 
                                            className={styles.orderIdentity}
                                        >
                                            <strong>
                                                {
                                                    participant 
                                                        .fantasyTeamSeason
                                                        .name
                                                }
                                            </strong>
                                            <span>
                                                {
                                                participant
                                                    .fantasyTeamSeason
                                                    .manager
                                                    ?.username
                                                }
                                            </span>
                                        </div>

                                        {draft.status === "SETUP" ? (
                                            <div
                                                className={styles.orderButtons}
                                            >
                                                <button 
                                                    type="button"
                                                    disabled={
                                                        isBusy ||
                                                        index === 0
                                                    }
                                                    onClick={() =>
                                                        moveParticipant(
                                                            index,
                                                            -1
                                                        )
                                                    }
                                                    aria-label="Move earlier"
                                                >
                                                    ↑
                                                </button>

                                                <button 
                                                    type="button"
                                                    disabled={
                                                        isBusy ||
                                                        index ===
                                                            draft
                                                                .participants   
                                                                .length -
                                                                1
                                                    }
                                                    aria-label="Move later"
                                                >
                                                    ↓
                                                </button>
                                            </div>
                                        ) : null}
                                    </li>
                                );
                        }
                    )}
                </ol>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeading}>
                    <div>
                        <p className={styles.eyebrow}>
                            Available players
                        </p>
                        <h2>Player pool</h2>
                    </div>

                    <span className={styles.hint}>
                        {totalPlayers.toLocaleString()}{" "}
                        players
                    </span>
                </div>

                <div className={styles.playerControls}>
                    <input 
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search players..."
                        aria-label="Search players"
                    />

                    <select 
                        value={position}
                        onChange={(event) => {
                            setPosition(event.target.value);
                            setPage(1);
                        }}
                        aria-label="Position"
                    >
                        <option value="">
                            All positions
                        </option>

                        {POSITIONS.map((item) => (
                            <option 
                                key={item}
                                value={item}
                            >
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                {playersQuery.isLoading ? (
                    <p className={styles.state}>
                        Loading players...
                    </p>
                ) : playersQuery.isError ? (
                    <p className={styles.stateError}>
                        {errorMessage(
                            playersQuery.error
                        )}
                    </p>
                ) : (
                    <ul className={styles.playerList}>
                        {players.map((player) => {
                            const canDraft = 
                                draft.status === 
                                    "IN_PROGRESS" && 
                                player.available !== false;

                                return (
                                    <li 
                                        key={player.id}
                                        className={styles.playerRow}
                                    >
                                        <div className={styles.playerIdentity}>
                                            {player.headshot ? (
                                                <img 
                                                    src={player.headshot}
                                                    alt=""
                                                />
                                            ) : (
                                                <span 
                                                    className={styles.playerFallback}
                                                >
                                                    {player.position}
                                                </span>
                                            )}

                                            <div>
                                                <strong>{player.name}</strong>
                                                <span>
                                                    {player.teamAbv ??
                                                        "FA"}{" "}
                                                    ·{" "}
                                                    {player.position}
                                                    
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <span 
                                            className={styles.projection}
                                        >
                                            {typeof player.projPts ===
                                            "number"
                                                ? player.projPts.toFixed(
                                                    1
                                                )
                                                : "-"}
                                        </span>

                                        <button 
                                            type="button"
                                            className={styles.draftButton}
                                            disabled={
                                                !canDraft ||
                                                isBusy
                                            }
                                            onClick={() => 
                                                handlePick(
                                                    player.id,
                                                    player.name
                                                )
                                            }
                                        >
                                            {pendingPlayerId === 
                                            player.id 
                                                ? "Drafting..."
                                                : "Draft"}
                                        </button>

                                    </li>
                                );
                        })}
                    </ul>
                )}

                <div className={styles.pagination}>
                    <button 
                        type="button"
                        disabled={page <= 1}
                        onClick={() => 
                            setPage((current) =>
                                Math.max(
                                    1,
                                    current - 1
                                ) 
                            )
                        }
                    >
                        Previous
                    </button>

                    <span>
                        Page {page} of {playerPageCount}
                    </span>

                    <button 
                        type="button"
                        disabled={
                            page >= playerPageCount
                        }
                        onClick={() => 
                            setPage((current) => 
                                Math.min(
                                    playerPageCount,
                                    current + 1
                                )
                            )
                        }
                    >
                        Next
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeading}>
                    <div>
                        {/* need to make dynamic for different draft types later */}
                        <p className={styles.eyebrow}> 
                            Snake draft
                        </p>
                        <h2>Draft board</h2>
                    </div>
                </div>

                <div className={styles.boardScroll}>
                    <div className={styles.board}>
                        <div className={styles.boardHeader}>
                            <div 
                                className={styles.roundHeading}
                            >
                                Rd
                            </div>

                            {draft.participants.map(
                                (participant) => (
                                    <div 
                                        key={participant.id}
                                        className={styles.teamHeading}
                                    >
                                        <strong>
                                            {
                                                participant
                                                    .draftPosition
                                            }
                                            .{" "}
                                            {
                                                participant
                                                    .fantasyTeamSeason
                                                    .manager
                                                    ?.username
                                            }
                                        </strong>
                                        <span>
                                            {participant.fantasyTeamSeason.name}
                                        </span>
                                    </div>
                                )
                            )}
                        </div>

                        {Array.from(
                            {
                                length: draft.rounds,
                            },
                            (_, roundIndex) => {
                                const round = roundIndex + 1;

                                return (
                                    <div 
                                        className={styles.boardRound}
                                        key={round}
                                    >
                                        <div 
                                            className={styles.roundNumber}
                                        >
                                            {round}
                                        </div>

                                        {draft.participants.map(
                                            (participant) => {
                                                const key = `${round}:${participant.fantasyTeamSeasonId}`;
                                                const pick = picksByRoundAndTeam.get(key);

                                                const isCurrent = 
                                                    draft 
                                                        .onClock
                                                        ?.round ===
                                                        round &&
                                                    draft 
                                                        .onClock
                                                        .fantasyTeamSeason
                                                        .id === 
                                                        participant 
                                                            .fantasyTeamSeason 
                                                            .id 
                                                        ;

                                                return (
                                                    <div 
                                                        key={
                                                            participant.id
                                                        }
                                                        className={
                                                            isCurrent 
                                                                ? styles.currentPickCell
                                                                : styles.pickCell
                                                        }
                                                    > 
                                                        {pick ? (
                                                            <>
                                                                <span 
                                                                    className={styles.pickNumber}
                                                                >
                                                                    #
                                                                    {pick.overallPick}
                                                                </span>
                                                                <strong>
                                                                    {
                                                                        pick
                                                                            .player
                                                                            .name
                                                                    }
                                                                </strong>
                                                                <small>
                                                                    {
                                                                        pick
                                                                            .player
                                                                            .position
                                                                    }{" "}
                                                                    ·{" "}
                                                                    {pick
                                                                        .player
                                                                        .team
                                                                        ?.abbr ??
                                                                        "FA"}
                                                                </small>
                                                            </>
                                                        ) : (
                                                            <span 
                                                                className={
                                                                    styles.emptyPick
                                                                }
                                                            >
                                                                {isCurrent 
                                                                    ? "On clock"
                                                                    : "-"}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                                
                                            }
                                        )}
                                    </div>

                                );
                            }
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}