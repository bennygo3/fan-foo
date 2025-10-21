import { http } from "../../lib/http.js";

function reqEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env: ${name}`);
    return v;
}

const RAPID_KEY = reqEnv("RAPIDAPI_KEY");
const RAPID_HOST = reqEnv("RAPIDAPI_HOST");

const HEADERS = {
    "x-rapidapi-key": RAPID_KEY,
    "x-rapidapi-host": RAPID_HOST,
} satisfies Record<string, string>;

// leaner call for /nfl/teams (standings)
export async function tankGetPlayersList(season = "2025") {
    return http<any>({
        url: `https://${RAPID_HOST}/getNFLPlayerList`,
        params: { season },
        headers: HEADERS,
        timeoutMs: 15_000,
    });
}

// Heavier call, includes rosters with payload
export async function tankGetTeamsWithRosters(season = "2025") {
    return http<any>({
        url: `https://${RAPID_HOST}/getNFLTeams`,
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

