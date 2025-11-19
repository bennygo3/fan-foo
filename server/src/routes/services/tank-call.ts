import { http } from "../../lib/http";

function reqEnv(name: string): string {
    const v = process.env[name];
    if (!v || !v.trim()) throw new Error(`Missing required env: ${name}`);
    return v;
}

const RAPID_KEY = reqEnv("RAPIDAPI_KEY");
const RAPID_HOST = reqEnv("RAPIDAPI_HOST");

const BASE_HEADERS = {
    "x-rapidapi-key": RAPID_KEY,
    "x-rapidapi-host": RAPID_HOST,
} as const;

// Scoring presets
export type ScoringKeys =
   | "twoPointConversions"
   | "passYards"
   | "passTD"
   | "passInterceptions"
   | "passCompletions"
   | "passAttempts"
   | "carries"
   | "rushingYards"
   | "rushTD"
   | "receivingYards"
   | "receivingTD"
   | "pointsPerReception"
   | "targets"
   | "fgMade"
   | "fgMissed"
   | "xpMade"
   | "xpMissed"
   | "defTd"
;

export type ScoringConfig = Partial<Record<ScoringKeys, number>>;

export const NON_PPR_SCORING: ScoringConfig = {
    twoPointConversions: 2,

    passYards: 0.04,
    passTD: 4,
    passInterceptions: -2,
    passCompletions: 0,

    passAttempts: 0,
    carries: 0,
    rushingYards: 0.1,
    rushTD: 6,

    receivingYards: 0.1,
    receivingTD: 6,
    pointsPerReception: 0,
    targets: 0,

    fgMade: 3,
    fgMissed: -1,
    xpMade: 1,
    xpMissed: -1,
    // defTd: 6,
};

export const HALF_PPR_SCORING: ScoringConfig = {
    ...NON_PPR_SCORING,
    pointsPerReception: 0.5,
};

export const PPR_SCORING: ScoringConfig = {
    ...NON_PPR_SCORING,
    pointsPerReception: 1,
}

function buildScoringParams(scoring: ScoringConfig): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(scoring)) {
        if (typeof v === "number" && Number.isFinite(v) && v !== 0) {
            out[k] = String(v);
        }
    }
    return out;
}

type HttpOpts = {
    url: string;
    params?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
};

async function tankHttp<T = any>(opts: HttpOpts): Promise<T> {
    const { retries = 1, retryDelayMs = 350, headers = {}, ...rest } = opts;
    const mergedHeaders = { ...BASE_HEADERS, ...headers } as Record<string, string>;

    let lastErr: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await http<T>({ ...rest, headers: mergedHeaders });
        } catch (err: any) {
            lastErr = err;
            const status = err?.status ?? err?.response?.status;
            const isRetryable = status === 429 || (typeof status === "number" && status >= 500 && status < 600);
            if (!isRetryable || attempt === retries) break;
            await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
        }
    }
    throw lastErr;
}

export async function tankGetPlayersList(season: string = "2025") {
    return tankHttp<any>({
        url: `https://${RAPID_HOST}/getNFLPlayerList`,
        params: { season },
        timeoutMs: 15_000,
    });
}

// toying with using our own seeded schedule to deal with unnecessary ext calls
export async function tankGetWeeklySchedule(week: string | number, season: string) {
    return tankHttp<any>({
        url: `https://${RAPID_HOST}/getWeeklyNFLSchedule`,
        params: { week: String(week), season },
        timeoutMs: 10_000,
    });
}

export async function tankGetBoxScore(
    gameID: string,
    scoring: Record<string, number> = NON_PPR_SCORING,
) {
    return tankHttp<any>({
        url: `https://${RAPID_HOST}/getNFLBoxScore`,
        params: {
            gameID,
            playByPlay: "false",
            fantasyPoints: "true",
            itemFormat: "list",
            ...buildScoringParams({ ...NON_PPR_SCORING, ...scoring }),
        },
        timeoutMs: 12_000,
    });
}

export async function tankGetProjections(opts: {
    week: number | string;
    season: string;
    scoring?: ScoringConfig;
}) {
    const { week, season, scoring = {} } = opts;
    return tankHttp<any>({
        url: `https://${RAPID_HOST}/getNFLProjections`,
        params: {
            week: String(week),
            archiveSeason: season,
            itemFormat: "list",
            ...buildScoringParams({ ...NON_PPR_SCORING, ...scoring })
        },
        timeoutMs: 15_000,
    });
}

export function extractPlayerProjections(resp: any): any[] {
    const body = resp?.body ?? resp ?? {};
    if (Array.isArray(body.playerProjections)) return body.playerProjections;
    if (Array.isArray(body)) return body;
    return [];
}

export function extractDSTProjections(resp: any): any[] {
    const body = resp?.body ?? resp ?? {};
    if (Array.isArray(body.teamDefenseProjections)) return body.teamDefenseProjections;
    if (Array.isArray(body)) return body;
    return [];
}

// // Heavier call, includes teams + rosters with payload
export async function tankGetTeamsWithRosters(season = "2025") {
    return tankHttp<any>({
        url: `https://${RAPID_HOST}/getNFLTeams`,
        params: {
            sortBy: "division",
            rosters: "true",
            schedules: "false",
            topPerformers: "false",
            teamStats: "false",
            teamStatsSeason: season,
        },
        timeoutMs: 15_000,
    });
}



