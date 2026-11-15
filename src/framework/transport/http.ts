import type {
  Command,
  GameTransport,
  Outcome,
  Snapshot,
} from "../domain/contracts.ts";
export class ApiError extends Error {
  code: string;
  rejected: boolean;
  constructor(code: string, status = 409) {
    super(code);
    this.code = code;
    this.rejected = status >= 400 && status < 500;
  }
}
export class HttpTransport implements GameTransport {
  constructor(private readonly basePath = "/api") {}
  async session(): Promise<Snapshot> {
    return this.request(this.basePath + "/session");
  }
  async execute(command: Command): Promise<Outcome> {
    return this.request(this.basePath + "/command", command);
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    const value = await response.json();
    if (!response.ok)
      throw new ApiError(value.error || "SERVER_ERROR", response.status);
    return value;
  }
}
