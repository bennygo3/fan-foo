import { http } from "../../lib/http.js";

const HOST = process.env.RAPIDAPI_HOST;
const HEADERS = {
    "x-rapidapi-key": process.env.FANTASYDATA_KEY,
    "x-rapidapi-host": HOST,
};

// leaner call for /nfl/teams (standings)
export async function tankGetPlayersList(season = "2025") {
    return http<any>({
        url: `https://${HOST}/getNFLPlayerList`,
        params: { season },
        headers: HEADERS,
        timeoutMs: 15_000,
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

