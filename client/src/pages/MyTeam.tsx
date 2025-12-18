import { useEffect, useState } from "react";
import "./myTeam.css";
import { useParams } from "react-router-dom";
import type { MyTeamApiResponse, RosterSlot } from "../lib/api";
import { getMyTeam } from "../lib/api";

export default function MyTeamPage() {
    const params = useParams<{ leagueId?: string; teamId?: string }>();

    const leagueId = Number(params.leagueId ?? 1);
    const teamId = Number(params.teamId ?? 6);

    const [data, setData] = useState<MyTeamApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

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

    function isGameLocked(kickoffIso?: string | null) {
        if (!kickoffIso) return false;
        const t = Date.parse(kickoffIso);
        if (!Number.isFinite(t)) return false;
        return t <= Date.now();    
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

    if (!data) {
        return <div style={{ padding: "1rem" }}> No roster data.</div>;
    }

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

            <section className="myteam-section">
                <h2 className="myteam-section-title">Starters</h2>
                <RosterTable slots={starters} />
            </section>

            <section className="myteam-section">
                <h2 className="myteam-section-title">Bench</h2>
                <RosterTable slots={bench} />
            </section>
            <section className="myteam-section">
                <h2 className="myteam-section-title">IR</h2>
                <RosterTable slots={ir} />
            </section>
        </div>
    );
}

function RosterTable({ slots }: { slots: RosterSlot[] }) {
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
                    <RosterRow key={slot.id} slot={slot} />
                ))}
            </tbody>
        </table>
    );
}

function dSTLabel(slot: RosterSlot["slot"]): string {
    if (slot === "DST") return "D/ST";
    return slot;
}

function RosterRow({ slot }: { slot: RosterSlot }) {
    const p = slot.player;
    const hasPlayer = !!p;
    const headshot = p?.headshotUrl ?? null;

    const team = p?.team;
    const nflTeamAbbr = team?.abbr ?? "-";
    const teamName = team?.name ?? "";
    const logoUrl = team?.logoUrl ?? null;

    const isDst = p?.position === "DST" || p?.position === "D/ST" || p?.position === "DEF";

    const statusDisplay = "-";
    const opponentDisplay = slot.oppAbv ?? "-";
    const projDisplay = slot.projPts != null ? slot.projPts.toFixed(1) : "-";
    const liveDisplay = slot.livePts != null ? slot.livePts.toFixed(1) : "-";

    return (
        <tr className="myteam-row">
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




