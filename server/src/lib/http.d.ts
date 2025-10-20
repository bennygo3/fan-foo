export function http<T = any>(opts: {
    url: string;
    method?: string;
    headers?: Record<string, string>
    params?: Record<string, string | number | boolean>;
    body?: any;
    timeoutMs?: number;
}): Promise<T>;