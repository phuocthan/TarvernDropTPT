export class ApiError extends Error {
  code: string;
  rejected: boolean;
  constructor(code: string, status = 409) {
    super(code); this.code = code; this.rejected = status >= 400 && status < 500;
  }
}

/** HTTP mechanics only. Protocol adapters own auth, payloads and safe retry policy. */
export class JsonClient {
  private fetcher: typeof fetch;
  constructor(fetcher: typeof fetch = fetch, privateTimeoutMs = 12000) {
    this.fetcher = fetcher.bind(globalThis); this.timeoutMs = privateTimeoutMs;
  }
  private timeoutMs: number;
  async request<T>(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const response = await this.fetcher(path, {
      method: body === undefined ? "GET" : "POST", credentials: "same-origin",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs),
    });
    const value = await response.json();
    if (!response.ok) throw new ApiError(value.error || "SERVER_ERROR", response.status);
    return value as T;
  }
}
