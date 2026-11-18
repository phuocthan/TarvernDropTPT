import type { Graphics } from "pixi.js";

export function applySceneLayers(
  host: HTMLElement,
  layers: Record<string, number>,
) {
  for (const [layer, order] of Object.entries(layers))
    host.style.setProperty(`--scene-layer-${layer}`, String(order));
}

export interface SceneAnchor {
  x: number;
  y: number;
  scale: number;
}

export async function waitForContinue(surface: HTMLElement, button: HTMLButtonElement, ready?: Promise<unknown>) {
  if (ready) {
    button.hidden = true;
    button.disabled = true;
    await ready;
    button.hidden = false;
    button.disabled = false;
  }
  return new Promise<void>((resolve) => {
    const accept = () => {
      if (button.hidden || button.disabled) return;
      surface.removeEventListener("click", accept);
      button.disabled = true;
      resolve();
    };
    surface.addEventListener("click", accept);
  });
}

export function zoomScene(
  host: HTMLElement,
  { scale, originY, durationMs }: { scale: number; originY: number; durationMs: number },
) {
  const transformOrigin = `50% ${100 * originY}%`;
  return host.animate([
    { scale: "1", transformOrigin },
    { scale: String(scale), transformOrigin },
  ], { duration: durationMs, easing: "ease-out", fill: "forwards" });
}
export function drawDimmer(
  layer: Graphics,
  width: number,
  height: number,
  opacity: number,
) {
  layer
    .clear()
    .rect(0, 0, width, height)
    .fill({ color: 0x000000, alpha: opacity });
}

export function revealScene(
  { durationMs, symbolDelayMs }: { durationMs: number; symbolDelayMs: number },
  dimmerOpacity: number,
  update: (brightness: number, symbolOpacity: number, elapsedMs: number) => void,
) {
  const start = performance.now();
  update(1 - dimmerOpacity, 0, 0);
  return new Promise<void>((resolve) => {
    function frame(now: number) {
      const elapsed = Math.min(durationMs, Math.max(0, now - start));
      const remaining = 1 - elapsed / durationMs;
      const symbols = Math.max(0, (elapsed - symbolDelayMs) / (durationMs - symbolDelayMs));
      update(1 - dimmerOpacity * remaining ** 2, symbols * symbols * (3 - 2 * symbols), elapsed);
      if (elapsed === durationMs) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
