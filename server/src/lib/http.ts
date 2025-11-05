export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpParams = Record<string, string | number | boolean>;
export type HttpHeaders = Record<string, string>;

export interface HttpOptions<TBody = unknown> {
    url: string;
    method?: HttpMethod;
    headers?: HttpHeaders;
    params?: HttpParams;
    body?: TBody;
    timeoutMs?: number;
}

export async function http<TResp = unknown, TBody = unknown>({
    url, 
    method = "GET",
    headers = {},
    params = {},
    body,
    timeoutMs = 10_000,


} : HttpOptions<TBody>): Promise <TResp> {
    //build url + query
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
            u.searchParams.set(k, String(v));
        }
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const res = await fetch(u.toString(), {
            method,
            headers: { accept: "application/json", ...headers },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });

        const text = await res.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!res.ok) {
            const err: any = new Error(`HTTP ${res.status} : ${res.statusText}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }

        return data as TResp;
    } finally {
        clearTimeout(timeout);
    }

}

