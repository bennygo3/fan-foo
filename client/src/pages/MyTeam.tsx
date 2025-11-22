import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type SlotType = "QB" | "RB" | "WR" | "TE" | "FLEX" | "DST" | "K" | "BN" | "IR";

interface NflTeam {
    id: number;
    abbr: string;
    name: string;
}

interface Player {
    id: number;
    name: string;
    position: string;
    team: NflTeam | null;
}

interface RosterSlot {
    id: number;
    leagueId: number;
    teamId: number;
    slot: SlotType;
    playerId: number | null;
    player: Player | null;
}

interface TeamSummary {
    id: number;
    name: string;
    league: { id: number; name: string };
    manager: { id: number; username: string; email: string } | null;
}

interface RosterResponse {
    leagueId: number;
    team: TeamSummary;
    roster: {
        starters: RosterSlot[];
        bench: RosterSlot[];
        ir: RosterSlot[];
    };
}

export default function MyTeamPage() {
    const params = useParams<{ leagueId?: string; teamId?: string }>();

    const leagueId = Number(params.leagueId ?? 1);
    const teamId = Number(params.teamId ?? 6);

    const [data, setData] = useState<RosterResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

                const res = await fetch(
                    `/leagues/${leagueId}/teams/${teamId}/roster`
                );

                if (!res.ok) {
                    throw new Error(`Request failed with status ${res.status}`);
                }

                const json = (await res.json()) as RosterResponse;
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

    const { team, roster } = data;
    const { starters, bench, ir } = roster;

    return (
        <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
            <header style={{ marginBottom: "1.5rem" }}>
                <h1 style={{ margin: 0 }}>{team.name}</h1>
                <div style={{ fontSize: "0.9 rem", color: "#555" }}>
                    League: <strong>{team.league.name}</strong>
                    {" • "}
                    Manager:{" "}
                    <strong>{team.manager ? team.manager.username : "Unassigned"}</strong>
                </div>

                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                    Current Week: <strong>11</strong>
                </div>
            </header>

            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.75rem" }}>Starters</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Slot</th>
                            <th style={thStyle}>Player</th>
                            <th style={thStyle}>NFL Team</th>
                            <th style={thStyle}>Pos</th>
                            <th style={thStyle}>Opponent</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Projected</th>
                        </tr>
                    </thead>
                    <tbody>
                        {starters.map((slot) => (
                            <RosterRow key={slot.id} slot={slot} />
                        ))}
                    </tbody>
                </table>
            </section>

            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.75rem" }}>Bench</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Slot</th>
                            <th style={thStyle}>Player</th>
                            <th style={thStyle}>NFL Team</th>
                            <th style={thStyle}>Pos</th>
                            <th style={thStyle}>Opponent</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Projected</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bench.map((slot) => (
                            <RosterRow key={slot.id} slot={slot} />
                        ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 style={{ marginBottom: "0.75rem" }}>IR</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Slot</th>
                            <th style={thStyle}>Player</th>
                            <th style={thStyle}>NFL Team</th>
                            <th style={thStyle}>Pos</th>
                            <th style={thStyle}>Opponent</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Projected</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ir.map((slot) => (
                            <RosterRow key={slot.id} slot={slot} />
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0.5rem",
    borderBottom: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
    padding: "0.4rem 0.5rem",
    borderBottom: "1px solid #eee",
}

function RosterRow({ slot }: { slot: RosterSlot }) {
    const p = slot.player;

    const hasPlayer = !!p;
    const nflTeam = p?.team?.abbr ?? "-";

    // TODO: wire opponent + game time from Game table
    const opponentDisplay = "-";
    const statusDisplay = "-";
    const projDisplay = "-";

    return (
        <tr>
            <td style={tdStyle}>{slot.slot}</td>
            <td style={tdStyle}>
                {hasPlayer ? (
                    <span>{p!.name}</span>
                ) : (
                    <span style={{ color: "#999" }}>Empty</span>
                )}
            </td>
            <td style={tdStyle}>{hasPlayer ? nflTeam : "-"}</td>
            <td style={tdStyle}>{hasPlayer ? p!.position : "-"}</td>
            <td style={tdStyle}>{opponentDisplay}</td>
            <td style={tdStyle}>{statusDisplay}</td>
            <td style={tdStyle}>{projDisplay}</td>
        </tr>
    )
}