import type {
  Command,
  GameTransport,
  Outcome,
  Snapshot,
} from "../domain/contracts.ts";
import { JsonClient } from "../network/json-client.ts";
export { ApiError } from "../network/json-client.ts";
export class HttpTransport implements GameTransport {
  private readonly basePath: string;
  private client = new JsonClient();
  constructor(basePath = "/api") { this.basePath = basePath; }
  async session(): Promise<Snapshot> {
    return this.request(this.basePath + "/session");
  }
  async execute(command: Command): Promise<Outcome> {
    return this.request(this.basePath + "/command", command);
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    return this.client.request<T>(path, body);
  }
}
