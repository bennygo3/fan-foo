import { useEffect, useState } from "react";
import "./myTeam.css";
import { useParams } from "react-router-dom";
import type { MyTeamApiResponse, RosterSlot, } from "../lib/api";
import { getMyTeam } from "../lib/api";

export default function MyTeamPage() {
    const params = useParams<{ leagueId?: string; teamId?: string }>();

    const leagueId = Number(params.leagueId ?? 1);
    const teamId = Number(params.teamId ?? 6);

    const [data, setData] = useState<MyTeamApiResponse | null>(null);
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
        <div className="">
            <header style={{ marginBottom: "1.5rem" }}>
                <h1 style={{ margin: 0 }}>{team.name}</h1>
                <div style={{ fontSize: "0.9 rem", color: "#555" }}>
                    League: <strong>{team.league.name}</strong>
                    {" • "}
                    Manager:{" "}
                    <strong>{team.manager ? team.manager.username : "Unassigned"}</strong>
                </div>

                <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                    Current Week: <strong>{data.week}</strong>
                </div>
            </header>

            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.75rem" }}>Starters</h2>
                <RosterTable slots={starters} />
            </section>

            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.75rem" }}>Bench</h2>
                <RosterTable slots={bench} />
            </section>
            <section>
                <h2 style={{ marginBottom: "0.75rem" }}>IR</h2>
                <RosterTable slots={ir} />
            </section>
        </div>
    );
};

function RosterTable({ slots }: { slots: RosterSlot[] }) {
    return (
        <table className="my-team-table"
            // style={{
            //     width: "100%",
            //     borderCollapse: "collapse",
            //     fontSize: "0.9rem",
            // }}
        >
            <thead>
                <tr>
                    <th style={thStyle}>Slot</th>
                    <th style={thStyle}>Player</th>
                    <th style={thStyle}>NFL Team</th>
                    <th style={thStyle}>Pos</th>
                    <th style={thStyle}>Opp</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Projected</th>
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

function RosterRow({ slot }: { slot: RosterSlot }) {
    const p = slot.player;
    const hasPlayer = !!p;
    const headshot = p?.headshotUrl ?? null;
    const nflTeam = p?.team?.abbr ?? "-";

    const statusDisplay = "-";
    const opponentDisplay = slot.oppAbv ?? "-";
    const projDisplay = slot.projPts != null ? slot.projPts.toFixed(1) : "-";
    const liveDisplay = slot.livePts != null ? slot.livePts.toFixed(1) : "-";

    return (
        <tr>
            <td style={tdStyle}>{slot.slot}</td>
            <td style={tdStyle}>
                {hasPlayer ? (
                    <span 
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        {headshot && (
                            <img 
                                src={headshot}
                                alt={p!.name}
                                style={{
                                    width: 38,
                                    height: 38,
                                    objectFit: "cover",
                                    flexShrink: 0,
                                    marginRight: "15px",
                                }}
                            />
                        )}
                    
            
                    <span>{p!.name}</span>
                    </span>
                ) : (
                    <span style={{ color: "#999" }}>Empty</span>
                )}
            </td>
            <td style={tdStyle}>{hasPlayer ? nflTeam : "-"}</td>
            <td style={tdStyle}>{hasPlayer ? p!.position : "-"}</td>
            <td style={tdStyle}>{hasPlayer ? opponentDisplay : "-"}</td>
            <td style={tdStyle}>{hasPlayer ? statusDisplay : "-"}</td>
            <td style={tdStyle}>{hasPlayer ? projDisplay: "-"}</td>
            <td style={tdStyle}>{hasPlayer ? liveDisplay: "-"}</td>
        </tr>
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