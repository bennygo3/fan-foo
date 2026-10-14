import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getNflTeams, getSchedule, type Game, } from "../lib/api";
import { CURRENT_FANTASY_SEASON } from "../config/fantasy";
import styles from "./nflschedule.module.css";

const WEEKS = Array.from(
    { length: 18 },
    (_, index) => index + 1
);

const kickoffFormatter = new Intl.DateTimeFormat(
    undefined,
    {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }
);

function formatKickoff(
    startTime: string | null
): string {
    if (!startTime) return "TBD";

    const date = new Date(startTime);

    if (Number.isNaN(date.getTime())) {
        return "TBD";
    }

    return kickoffFormatter.format(date);
}

function formatStatus(status: string): string {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        );
}

export default function NflSchedule() {
    const [requestedTeamAbv, setRequestedTeamAbv] = useState("");

    const teamsQuery = useQuery({
        queryKey: ["nflTeams"],
        queryFn: getNflTeams,
        staleTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const teams = useMemo(
        () =>
            [...(teamsQuery.data?.items ?? [])].sort(
                (a, b) =>
                    a.name.localeCompare(b.name)
            ),
        [teamsQuery.data]
    );

    const selectedTeamAbv =
        requestedTeamAbv ||
        teams[0]?.abbr ||
        "";

    const selectedTeam = teams.find(
        (team) => team.abbr === selectedTeamAbv
    );

    const scheduleQuery = useQuery({
        queryKey: [
            "nflSchedule",
            CURRENT_FANTASY_SEASON,
            selectedTeamAbv,
        ],
        queryFn: () => 
            getSchedule({
                season: CURRENT_FANTASY_SEASON,
                teamAbv: selectedTeamAbv,
            }),
        enabled: Boolean(selectedTeamAbv),
        staleTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const games = useMemo(
        () => 
        [...(scheduleQuery.data ?? [])].sort(
            (a, b) => 
                a.week - b.week ||
            (a.startTime ?? "").localeCompare(
                b.startTime ?? ""
            )
        ),
        [scheduleQuery.data]
    );

    const gamesByWeek = useMemo(
        () => 
            new Map<number, Game>(
                games.map((game) => [
                    game.week,
                    game,
                ])
            ),
        [games]
    );

    const byeWeek = WEEKS.find(
        (week) => !gamesByWeek.has(week)
    );

    const isLoading = 
        teamsQuery.isLoading ||
        (Boolean(selectedTeamAbv) && scheduleQuery.isLoading);

    const queryError = 
        teamsQuery.error ??
        scheduleQuery.error;

    if (isLoading) {
        return (
            <p className={styles.state}>
                Loading NFL teams schedules
            </p>
        );
    }

    if (
        teamsQuery.isError ||
        scheduleQuery.isError
    ) {
        return (
            <div 
                className={styles.state}
                role="alert"
            >
                <p>
                    Could not load the schedule:{" "}
                    {queryError instanceof Error
                        ? queryError.message
                        : "Unknown error"
                    }
                </p>

                <button
                    type="button"
                    onClick={() => {
                        void teamsQuery.refetch();

                        if (selectedTeamAbv) {
                            void scheduleQuery.refetch();
                        }
                    }}
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <main 
            className={styles.page}
            aria-busy={scheduleQuery.isFetching}
        >
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>
                        {CURRENT_FANTASY_SEASON} NFL
                    </p>

                    <h1>Team Schedule</h1>

                    {selectedTeam ? (
                        <p className={styles.summary}>
                            {games.length} games
                            {byeWeek 
                                ? ` • Bye: Week ${byeWeek}`
                                : ""
                            }
                        </p>
                    ) : null}
                </div>

                <div className={styles.teamPicker}>
                    <label htmlFor="schedule-team">
                        NFL Team
                    </label>

                    <select 
                        id="schedule-team"
                        value={selectedTeamAbv}
                        onChange={(event) => 
                            setRequestedTeamAbv(
                                event.target.value
                            )
                        }
                    >
                        {teams.map((team) => (
                            <option
                                key={team.id}
                                value={team.abbr}
                            >
                                {team.name} (
                                    {team.abbr}
                                )
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {selectedTeam ? (
                <section className={styles.teamHeading}>
                    {selectedTeam.logoUrl ? (
                        <img 
                            src={selectedTeam.logoUrl}
                            alt=""
                            aria-hidden="true"
                        />
                    ) : null}

                    <div>
                        <h2>{selectedTeam.name}</h2>
                        <span>{selectedTeam.abbr}</span>
                    </div>
                </section>
            ) : null}

            {games.length === 0 ? (
                <p className={styles.state}>
                    No schedule was found for this team.
                </p>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col">
                                    Week
                                </th>
                                <th scope="col">
                                    Location
                                </th>
                                <th scope="col">
                                    Opponent
                                </th>
                                <th scope="col">
                                    Kickoff
                                </th>
                                <th scope="col">
                                    Status
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {WEEKS.map((week) => {
                                const game =
                                    gamesByWeek.get(
                                        week
                                    );

                                if (!game) {
                                    return (
                                        <tr 
                                            key={week}
                                            className={styles.byeRow}
                                        >
                                            <th scope="row">
                                                {week}
                                            </th>
                                            <td colSpan={4}>
                                                Bye Week
                                            </td>
                                        </tr>
                                    );
                                }

                                const isHome =
                                    game.homeTeam 
                                        .abbr ===
                                    selectedTeamAbv;

                                const opponent =
                                    isHome 
                                        ? game.awayTeam
                                        : game.homeTeam;

                                return (
                                    <tr key={game.id}>
                                        <th scope="row">
                                            {game.week}
                                        </th>

                                        <td>
                                            {isHome 
                                                ? "Home"
                                                : "Away"
                                            }
                                        </td>

                                        <td>
                                            <div className={styles.opponent}>
                                                {opponent.logoUrl ? (
                                                    <img 
                                                        src={opponent.logoUrl}
                                                        alt=""
                                                        aria-hidden="true"
                                                    />
                                                ) : null}

                                                <span>
                                                    {isHome 
                                                        ? "vs"
                                                        : "@"}{" "}
                                                    {
                                                        opponent.name
                                                    }{" "}
                                                    <small>
                                                        (
                                                        {
                                                            opponent.abbr
                                                        }
                                                        )
                                                    </small>
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            {formatKickoff(
                                                game.startTime
                                            )}
                                        </td>

                                        <td>
                                            {formatStatus(
                                                game.status
                                            )}

                                            {game.isFlexed 
                                                ? " • Flexed"
                                                : ""
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );    
}