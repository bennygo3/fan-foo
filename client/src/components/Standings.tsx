import { Link } from "react-router-dom";
import { useStandings } from "../hooks/useStandings";
import {
    CURRENT_FANTASY_SEASON,
    DEFAULT_LEAGUE_ID,
} from "../config/fantasy";
import styles from "./Standings.module.css";

type StandingsProps = {
    week?: number;
};

export default function Standings({
    week = 1,
}: StandingsProps) {
    const {
        data,
        isLoading,
        isError,
        error,
    } = useStandings({
        leagueId: DEFAULT_LEAGUE_ID,
        season: CURRENT_FANTASY_SEASON,
        week,
    });

    if (isLoading) {
        return <p>Loading standings....</p>;
    }

    if (isError) {
        return (
            <p>
                Failed to load standings:{" "}
                {(error as Error).message}
            </p>
        );
    }

    const standings = data?.items ?? [];

    return (
        <section className={styles.standings}>
            <h2 className={styles.table}>Standings</h2>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Team</th>
                        <th>W-L</th>
                        <th>PF</th>
                        <th>PA</th>
                        <th>Current Matchup</th>
                    </tr>
                </thead>

                <tbody>
                    {standings.map((team) => {
                        const matchup = team.currentMatchup;

                        return (
                            <tr key={team.teamSeasonId}>
                                <td className={styles.teamCell}>
                                    <Link 
                                        className={styles.teamName} 
                                        to={`/league/${DEFAULT_LEAGUE_ID}/team/${team.fantasyTeamId}`}
                                    >
                                        {team.teamName}
                                    </Link>

                                    {team.manager && (
                                        <div className={styles.manager}>
                                            {team.manager.username}
                                        </div>
                                    )}
                                </td>

                                <td className={styles.record}>
                                    {team.wins} - {team.losses}
                                </td>

                                <td className={styles.points}>
                                    {team.pointsFor.toFixed(2)}
                                </td>

                                <td className={styles.points}>
                                    {team.pointsAgainst.toFixed(2)}
                                </td>

                                <td className={styles.matchupCell}>
                                    {matchup ? (
                                        <>
                                            <Link 
                                                className={styles.opponent} 
                                                to={`/league/${DEFAULT_LEAGUE_ID}/team/${matchup.opponentFantasyTeamId}`}>
                                                vs {matchup.opponentTeamName}
                                            </Link>

                                            {matchup.teamScore !== null && 
                                            matchup.opponentScore !== null ? (
                                                <div className={styles.score}>
                                                    {matchup.teamScore.toFixed(2)}
                                                    {" - "}
                                                    {matchup.opponentScore.toFixed(2)}
                                                </div>
                                            ) : (
                                                <div className={styles.matchupStatus}>
                                                    {matchup.status}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        "-"
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}