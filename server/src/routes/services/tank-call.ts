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

// Non-PPR weights
export const NON_PPR_SCORING = {
    // universal
    twoPointConversions: 2,

    // passing 
    passYards: 0.04,
    passTD: 4,
    passInterceptions: -2,
    passCompletions: 0,
    passAttempts: 0,

    // rushing
    carries: 0,
    rushingYards : 0.1,
    rushTD: 6,

    // receiving
    pointsPerReception: 0,
    targets: 0,
    receivingYards: 0.1,
    receivingTD: 6,

    // kickers
    fgMade: 3,
    fgMissed: -1,
    xpMade: 1,
    xpMissed: -1,
};

// call for all nfl players (standings)
export async function tankGetPlayersList(season = "2025") {
    return http<any>({
        url: `https://${RAPID_HOST}/getNFLPlayerList`,
        params: { season },
        headers: HEADERS as any,
        timeoutMs: 15_000,
    });
}

export async function tankGetProjections(opts: {
    week: number | string;
})

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
        headers: HEADERS as any,
        timeoutMs: 15_000,
    });
}



