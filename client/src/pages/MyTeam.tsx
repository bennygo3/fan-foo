import { useEffect, useMemo, useState } from "react";
import "./myTeam.css";
import { useParams } from "react-router-dom";
import type { MyTeamApiResponse, RosterSlot } from "../lib/api";
import { getMyTeam, moveRosterSlot } from "../lib/api";

function isGameLocked(kickoffIso?: string | null) {
    if (!kickoffIso) return false;
    const t = Date.parse(kickoffIso);
    if (!Number.isFinite(t)) return false;
    return t <= Date.now();
}

function canSlotAcceptPlayer(slotType: RosterSlot["slot"], playerPos: string) {
    if (slotType === "BN") return true;
    if (slotType === "IR") return false;
    if (slotType === "FLEX") return playerPos === "RB" || playerPos === "WR" || playerPos === "TE";
    return slotType === (playerPos as any);
}

function sum(nums: Array<number | null | undefined>) {
    return nums.reduce<number>((acc, n) => acc + (typeof n === "number" ? n : 0), 0);
}

function dSTLabel(slot: RosterSlot["slot"]): string {
    if (slot === "DST") return "D/ST";
    return slot;
}

export default function MyTeamPage() {
    const params = useParams<{ leagueId?: string; teamId?: string }>();

    const leagueId = Number(params.leagueId ?? 1);
    const teamId = Number(params.teamId ?? 6);

    const [data, setData] = useState<MyTeamApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
    const [moveError, setMoveError] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);

    async function refreshLineup() {
        if (!data) return;
        const json = await getMyTeam({ leagueId, teamId, season: data.season, week: data.week,  });
        setData(json);
    }

    useEffect(() => {
        if (!Number.isFinite(leagueId) || !Number.isFinite(teamId)) {
            setError("Invalid league or team id");
            setLoading(false);
            return;
        }

        let isCancelled = false;

        async function fetchRoster() {
            try {
                setLoading(true);
                setError(null);
                const json = await getMyTeam({ leagueId, teamId });
                if (!isCancelled) setData(json);
            } catch (err: any) {
                if (!isCancelled) {
                    console.error("Failed to fetch roster:", err);
                    setError("Failed to load team roster");
                }
            } finally {
                if (!isCancelled) setLoading(false);
            }
        }

        fetchRoster();

        return () => {
            isCancelled = true;
        };
    }, [leagueId, teamId]);

    const allSlots = useMemo(() => {
        if (!data) return [];
        return [...data.roster.starters, ...data.roster.bench, ...data.roster.ir];
    }, [data]);

    const byId = useMemo(() => {
        const m = new Map<number, RosterSlot>();
        for (const s of allSlots) m.set(s.id, s);
        return m;
    }, [allSlots]);

    async function onClickSlot(slot: RosterSlot) {
        setMoveError(null);

        // 1. no selecttion yet->allow select if this slot has a player and is not locked
        if (selectedSlotId == null) {
            if (!slot.playerId || !slot.player) return;

            if (isGameLocked(slot.kickoffIso)) {
                setMoveError("Player is locked. Game has already started");
                return;
            }

            setSelectedSlotId(slot.id);
            return;
        }

        // re-clicking the selected player->cancel action
        if (selectedSlotId === slot.id) {
            setSelectedSlotId(null);
            return;
        }

        // attempt move/swap
        const fromSlot = byId.get(selectedSlotId) ?? null;

        if (!fromSlot || !fromSlot.playerId || !fromSlot.player) {
            setSelectedSlotId(null);
            return;
        }

        // UI lock check - server enforces too
        if (isGameLocked(fromSlot.kickoffIso) || isGameLocked(slot.kickoffIso)) {
            setMoveError("Lineup is locked. Game has already started");
            setSelectedSlotId(null);
            return;
        }

        // UI moving validation
        const movingPlayer = fromSlot.player.position;

        if (!canSlotAcceptPlayer(slot.slot, movingPlayer)) {
            setMoveError(`Illegal move: ${movingPlayer} cannot go into ${slot.slot}`);
            setSelectedSlotId(null);
            return;
        }

        if (slot.player && !canSlotAcceptPlayer(fromSlot.slot, slot.player.position)) {
            setMoveError(`Illegal swap: ${slot.player.position} cannot go into ${fromSlot.slot}`);
            setSelectedSlotId(null);
            return;
        }

        if (!data) {
            setMoveError("Roster not loaded yet");
            setSelectedSlotId(null);
            return;
        }

        try {
            setMoving(true);

            await moveRosterSlot({
                leagueId,
                teamId,
                fromRosterSlotId: fromSlot.id,
                toRosterSlotId: slot.id,
                season: data.season,
                week: data.week,
            });

            await refreshLineup();
        } catch (e: any) {
            setMoveError(e?.message ?? "Move failed");
        } finally {
            setMoving(false);
            setSelectedSlotId(null);
        }
    }

    if (loading) {
        return <div style={{ padding: "1rem" }}>Loading roster...</div>
    }

    if (error) {
        return (
            <div style={{ padding: "1rem", color: "red" }}>
                Error: {error}
            </div>
        );
    }

    if (!data) return <div style={{ padding: "1rem" }}> No roster data.</div>; 

    const { team, roster, week } = data;
    const { starters, bench, ir } = roster;

    return (
        <div className="myteam-page">
            <header className="myteam-header">
                <h1 className="myteam-title">{team.name}</h1>

                <div className="myteam-meta">
                    League: <strong>{team.league.name}</strong>
                    {" • "}
                    Manager:{" "}
                    <strong>{team.manager ? team.manager.username : "Unassigned"}</strong>
                </div>

                <div className="myteam-week">
                    Current Week: <strong>{week}</strong>
                </div>
            </header>

            {moveError ? (
                <div style={{ padding: "0 1rem", marginBottom: 8, color: "salmon" }}>
                    {moveError}
                </div>
            ) : null}

            {moving ? (
                <div style={{ padding: "0 1rem", marginBottom: 8, color: "#aaa" }}>
                    Moving...
                </div>
            ) : null}

            <section className="myteam-section">
                <h2 className="myteam-section-title">Starters</h2>
                <RosterTable 
                    slots={starters}
                    selectedSlotId={selectedSlotId}
                    onClickSlot={onClickSlot}
                    showTotals
                />
            </section>

            <section className="myteam-section">
                <h2 className="myteam-section-title">Bench</h2>
                <RosterTable 
                    slots={bench} 
                    selectedSlotId={selectedSlotId}
                    onClickSlot={onClickSlot}
                />
            </section>

            <section className="myteam-section">
                <h2 className="myteam-section-title">IR</h2>
                <RosterTable 
                    slots={ir} 
                    selectedSlotId={selectedSlotId}
                    onClickSlot={onClickSlot}
                />
            </section>
        </div>
    );
}

function RosterTable({ 
    slots, 
    selectedSlotId, 
    onClickSlot, 
    showTotals, 
} : { 
    slots: RosterSlot[]; 
    selectedSlotId: number | null;
    onClickSlot: (slot: RosterSlot) => void;
    showTotals?: boolean;
}) {
    const totalLive = sum(slots.map((s) => s.livePts));
    const totalProj = sum(slots.map((s) => s.projPts));

    return (
        <table className="myteam-table">
            <thead>
                <tr>
                    <th className="myteam-th slot">Slot</th>
                    <th className="myteam-th">Player</th>
                    <th className="myteam-th livescore">Live</th>
                    <th className="myteam-th">Opp</th>
                    <th className="myteam-th">Status</th>
                    <th className="myteam-th">Projected</th>
                </tr>
            </thead>
            <tbody>
                {slots.map((slot) => (
                    <RosterRow 
                        key={slot.id} 
                        slot={slot} 
                        selected={selectedSlotId === slot.id}
                        locked={isGameLocked(slot.kickoffIso)}
                        onClick={() => onClickSlot(slot)}
                    />
                ))}

                {showTotals ? (
                    <tr className="myteam-row">
                        <td className="myteam-td slot" />
                        <td className="myteam-td" style={{ fontWeight: 700 }}>
                            TOTAL
                        </td>
                        <td className="myteam-td" style={{ fontWeight: 700 }}>
                            {Number.isFinite(totalLive) ? totalLive.toFixed(1) : "-"}
                        </td>
                        <td className="myteam-td" />
                        <td className="myteam-td" />
                        <td className="myteam-td" style={{ fontWeight: 700 }}>
                            {Number.isFinite(totalProj) ? totalProj.toFixed(1) : "-"}
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>
    );
}


function RosterRow({ 
    slot,
    selected,
    locked,
    onClick,
}: { 
    slot: RosterSlot ;
    selected: boolean;
    locked: boolean;
    onClick: () => void;
}) {
    const p = slot.player;
    const hasPlayer = !!p;
    const headshot = p?.headshotUrl ?? null;

    const team = p?.team;
    const nflTeamAbbr = team?.abbr ?? "-";
    const teamName = team?.name ?? "";
    const logoUrl = team?.logoUrl ?? null;

    const isDst = p?.position === "DST" || p?.position === "D/ST" || p?.position === "DEF";

    const opponentDisplay = slot.oppAbv ?? "-";
    const projDisplay = slot.projPts != null ? slot.projPts.toFixed(1) : "-";
    const liveDisplay = slot.livePts != null ? slot.livePts.toFixed(1) : "-";
    const statusDisplay = hasPlayer ? (locked ? "LOCKED" : "-") : "-";

    return (
        <tr 
            className="myteam-row"
            onClick={onClick}
            style={{
                cursor: "pointer",
                outline: selected ? "2px solid #7fbfff" : "none",
                opacity: locked ? 0.75 : 1,
            }}
            title={
                locked 
                ? "Locked (game started)"
                : hasPlayer
                    ? "Click to select / move"
                    : "Click to move into this slot"
            }
        >
            <td className="myteam-td slot">{dSTLabel(slot.slot)}</td>
            <td className="myteam-td">
                {!hasPlayer ? (
                    <span className="myteam-empty">Empty</span>
                ) : (
                    <div className="myteam-playerbox">
                        <div className="myteam-avatar">
                            {!isDst && headshot && (
                                <img
                                    className="myteam-headshot"
                                    src={headshot}
                                    alt={p!.name}
                                />
                            )}

                            {isDst && logoUrl && (
                                <img
                                    className="myteam-dst-logo"
                                    src={logoUrl}
                                    alt={teamName || nflTeamAbbr}
                                />
                            )}
                        </div>

                        <div className="myteam-playertext">
                            <span className="myteam-playername">
                                {isDst && teamName ? teamName : p!.name}
                            </span>

                            <span className="myteam-subtext">
                                {isDst
                                    ? `${nflTeamAbbr} D/ST`
                                    : `${nflTeamAbbr !== "-" ? nflTeamAbbr : ""}${nflTeamAbbr !== "-" ? " • " : ""}${p!.position}`
                                }
                            </span>
                        </div>
                    </div>
                )}
            </td>
            {/* <td className="myteam-td">{hasPlayer ? nflTeamAbbr : "-"}</td> */}
            {/* <td className="myteam-td">{hasPlayer ? (isDst ? "D/ST" : p!.position) : "-"}</td> */}
            <td className="myteam-td">{hasPlayer ? liveDisplay : "-"}</td>
            <td className="myteam-td">{hasPlayer ? opponentDisplay : "-"}</td>
            <td className="myteam-td">{hasPlayer ? statusDisplay : "-"}</td>
            <td className="myteam-td">{hasPlayer ? projDisplay : "-"}</td>

        </tr>
    );
}
