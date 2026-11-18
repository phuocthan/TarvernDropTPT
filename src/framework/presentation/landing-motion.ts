export interface LandingMotion {
  compressMs: number;
  stretchMs: number;
  settleMs: number;
  leadMs: number;
  squashX: number;
  squashY: number;
  stretchX: number;
  stretchY: number;
}
export const landingDuration = (config?: LandingMotion) => config ? config.compressMs + config.stretchMs + config.settleMs : 0;
export function landingScale(elapsedMs: number, config?: LandingMotion) {
  if (!config || elapsedMs <= 0 || elapsedMs >= landingDuration(config)) return { x: 1, y: 1 };
  let from = { x: 1, y: 1 }, to = { x: config.squashX, y: config.squashY };
  let t: number;
  if (elapsedMs < config.compressMs) {
    t = (elapsedMs / config.compressMs) ** 3;
  } else if (elapsedMs < config.compressMs + config.stretchMs) {
    from = to; to = { x: config.stretchX, y: config.stretchY };
    t = 1 - (1 - (elapsedMs - config.compressMs) / config.stretchMs) ** 3;
  } else {
    from = { x: config.stretchX, y: config.stretchY }; to = { x: 1, y: 1 };
    const progress = (elapsedMs - config.compressMs - config.stretchMs) / config.settleMs;
    t = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
  }
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
/** Positive impact, a smaller counter-motion, then exact rest. */
export function landingOffset(progress: number, amplitude: number) {
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(progress * Math.PI * 2) * (1 - progress) * amplitude;
}
