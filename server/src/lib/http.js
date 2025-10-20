import fetch from "node-fetch";

export async function http({ url, method = "GET", header = {}, params = {} ReportBody, timeoutMs = 10_000 }) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);    
    }

    const ctrl =  new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const res = await fetch(u.toString(), {
            method,
            headers: {
                "accept": "application/json",
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });

        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!res.ok) {
            const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }

        return data;
    } finally {
        clearTimeout(timeout);
    }
}