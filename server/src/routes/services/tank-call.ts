import { http } from "../../lib/http"

type Props = {}

const tank-call = (props: Props) => {
  return (
    <div>tank-call</div>
  )
}";

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

// Non-PPR scoring
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
    receivingYards: 0.1,
    receivingTD: 6,
    pointsPerReception: 0,
    targets: 0,

    // kickers
    fgMade: 3,
    fgMissed: -1,
    xpMade: 1,
    xpMissed: -1,

    defTd: 6,
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

export async function tankGetWeeklySchedule(week: string | number, season: string) {
    return http<any>({
        url: `https://${RAPID_HOST}/getWeeklyNFLSchedule`,
        params: { week: String(week), season: season },
        headers: HEADERS as any,
        timeoutMs: 10_000,
    });
}

export async function tankGetBoxScore(gameID: string, scoring: Record<string, number> = NON_PPR_SCORING) {
   return http<any>({
    url: `https://${RAPID_HOST}/getNFLBoxScore`,
    params: {
        gameID,
        playByPlay: "false",
        fantasyPoints: "true",
        itemFormat: "list",
        ...scoring,
    },
    headers: HEADERS as any,
    timeoutMs: 12_000,
   }); 
}


export async function tankGetProjections(opts: {
    week: number | string;
    season: string;
    scoring?: Partial<typeof NON_PPR_SCORING>;
}) {
    const {week, season, scoring = {} } = opts;
    return http<any>({
        url: `https://${RAPID_HOST}/getNFLProjections`,
        params: {
            week: String(week),
            archiveSeason: season,
            itemFormat: "list",
            ...NON_PPR_SCORING,
            ...scoring,
        },
        headers: HEADERS as any,
        timeoutMs: 15_000,
    });
}

export function extractPlayerProjections(resp: any): any[] {
    const body = resp?.body ?? resp ?? {};
    if (Array.isArray(body.playerProjections)) return body.playerProjections;
    if (Array.isArray(body)) return body;
    return [];
}

export function extractDSTProjections(resp:any): any[] {
    const body = resp?.body ?? resp ?? {};
    if (Array.isArray(body.teamDefenseProjections)) return body.teamDefenseProjections;
    if (Array.isArray(body)) return body;
    return [];
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
        headers: HEADERS as any,
        timeoutMs: 15_000,
    });
}



