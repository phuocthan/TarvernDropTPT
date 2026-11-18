// Public core surface; rules have no renderer or network dependency.
export { GameController } from "../controller.ts";
export { createSlotSession } from "../session.ts";
export type { Board, Command, Outcome, Snapshot, GameTransport, GameDefinition, FeatureState } from "../domain/contracts.ts";
