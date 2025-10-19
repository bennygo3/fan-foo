import { http } from "../lib/http.js";

const HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const HEADERS = {
    "x-rapidapi-key": process.env.FANTASTYDATA_KEY,
    "x-rapidapi-host": HOST,
};

// leaner call for /nfl/teams (standings)
export async function tankGetTeams(season = "2025") {
    return http<any>({
        url: `https://${HOST}/getNFLTeams`,
        params: {
            sortBy: "standings",
            rosters: "false",
            schedules: "false",
            topPerformers: "false",
            teamStats: "true",
            teamStatsSeason: season,
        },
        headers: HEADERS,
        timeoutMs: 10_000,
    });
}

// Heavier call, includes rosters with payload
export async function tankGetsTeamsWithRosters(season = "2025") {
    return http<any>({
    url: `https://${HOST}/getNFLTeams`,
    params: {
        sortBy: "division",
        rosters: "true",
        schedules: "false",
        topPerformers: "false",
        teamStats: "false",
        teamStatsSeason: season,
    },
    headers: HEADERS,
    timeoutMs: 10_000,
});
}

