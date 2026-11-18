import type {
  Command,
  GameTransport,
  Outcome,
  Snapshot,
} from "./domain/contracts.ts";
import { ApiError } from "./transport/http.ts";
export type Phase = "loading" | "ready" | "pending" | "presenting" | "recovery";
export class GameController {
  state: Snapshot | null = null;
  phase: Phase = "loading";
  pending: Command | null = null;
  private transport: GameTransport;
  private storage: Storage;
  private storageKey: string;
  constructor(
    transport: GameTransport,
    storage: Storage,
    storageKey = "slot.pending",
  ) {
    this.transport = transport;
    this.storage = storage;
    this.storageKey = storageKey;
  }
  async boot(initialState?: Snapshot) {
    this.state = initialState ?? await this.transport.session();
    const saved = this.storage.getItem(this.storageKey);
    try {
      this.pending = saved ? JSON.parse(saved) : null;
    } catch {
      this.storage.removeItem(this.storageKey);
      this.pending = null;
    }
    this.phase = this.pending || this.transport.hasResume ? "recovery" : "ready";
  }
  async execute(
    input: Omit<Command, "requestId" | "expectedVersion">,
  ): Promise<Outcome> {
    if (this.phase !== "ready" || !this.state) throw Error("ROUND_BUSY");
    this.pending = {
      ...input,
      requestId: crypto.randomUUID(),
      expectedVersion: this.state.version,
    };
    this.storage.setItem(this.storageKey, JSON.stringify(this.pending));
    return this.send();
  }
  async recover(refresh = true) {
    if ((!this.pending || (!refresh && this.state?.resume)) && this.transport.resume) {
      this.phase = "pending";
      try {
        const outcome = await this.transport.resume(refresh || !this.state?.resume);
        this.state = outcome.state;
        this.pending = null;
        this.storage.removeItem(this.storageKey);
        this.phase = "presenting";
        return outcome;
      } catch (error) { this.phase = "recovery"; throw error; }
    }
    if (!this.pending) throw Error("NO_PENDING_ROUND");
    return this.send();
  }
  private async send() {
    this.phase = "pending";
    try {
      const outcome = await this.transport.execute(this.pending!);
      this.state = outcome.state;
      this.pending = null;
      this.storage.removeItem(this.storageKey);
      this.phase = "presenting";
      return outcome;
    } catch (error) {
      if (error instanceof ApiError && error.rejected) {
        // A structured rejection confirms this command was not accepted. Reconcile the snapshot.
        this.pending = null;
        this.storage.removeItem(this.storageKey);
        this.state = await this.transport.session();
        this.phase = "ready";
      } else this.phase = "recovery";
      throw error;
    }
  }
  async completePresentation() {
    if (this.phase !== "presenting") return;
    try {
      if (this.transport.completePresentation) this.state = await this.transport.completePresentation();
      this.phase = "ready";
    } catch (error) { this.phase = "recovery"; throw error; }
  }
  nextPresentation() {
    const outcome = this.transport.nextPresentation?.();
    if (!outcome) return null;
    this.state = outcome.state;
    this.phase = "presenting";
    return outcome;
  }
}
