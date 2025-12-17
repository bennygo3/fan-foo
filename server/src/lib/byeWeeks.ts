export function normalizeByeWeeksBySeason(raw: any): Record<string, number> | null {
    if (!raw || typeof raw !== "object") return null;

    // Tank shape: { "2025": { "0": "7"}, ... }
    const out: Record<string, number> = {};

    for (const [season, val] of Object.entries(raw)) {
        if (val && typeof val === "object") {
            const maybe = (val as any)["0"];
            const n = Number(maybe);
            if (Number.isFinite(n)) out[String(season)] = n;
        } else {
            // fallback if returned value is { "2025": "7" } or { "2025": 7 }
            const n = Number(val);
            if (Number.isFinite(n)) out[String(season)] = n;
        }
    }

    return Object.keys(out).length ? out : null;
}