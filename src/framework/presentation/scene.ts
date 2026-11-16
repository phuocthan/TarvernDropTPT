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
