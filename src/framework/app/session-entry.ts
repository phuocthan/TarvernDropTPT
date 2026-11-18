import type { Snapshot } from "../domain/contracts.ts";

/** Intro is presented from base; later feature checkpoints restore the bonus scene directly. */
export function resolveSessionEntry(state: Snapshot) {
  const featureMode = state.resume?.featureMode ?? state.feature?.mode ?? null;
  const scene = state.resume?.kind === "final_summary" ? "result" : state.resume?.curStep === "intro" ? "base" : featureMode ? "feature" : "base";
  return { scene, featureMode, resumeStep: state.resume?.curStep ?? null, requiresResume: !!state.resume || !!state.feature } as const;
}
