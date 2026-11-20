/**
 * Layout mode shared by fw-pixi games.
 *
 * The rule is the one used by the Tavern Drop reference client (v13): the size of the game
 * viewport element (ResizeObserver `contentRect`) selects one of three layouts.
 *
 *   width === 0 && height === 0                                   → desktop
 *   (height < mobileHeight || (width < mobileWidth && width > height)) && width > height
 *                                                                 → landscape
 *   width < mobileWidth                                           → portrait
 *   otherwise                                                     → desktop
 *
 * The reference thresholds are mobileWidth 661 and mobileHeight 449 (CSS px).
 */
export type LayoutMode = "desktop" | "landscape" | "portrait";

export interface LayoutModeConfig {
  /** Widths below this value are mobile (reference: 661). */
  mobileWidth: number;
  /** Landscape viewports below this height are mobile landscape (reference: 449). */
  mobileHeight: number;
}

export function layoutModeFor(width: number, height: number, config: LayoutModeConfig): LayoutMode {
  if (width === 0 && height === 0) return "desktop";
  if ((height < config.mobileHeight || (width < config.mobileWidth && width > height)) && width > height)
    return "landscape";
  return width < config.mobileWidth ? "portrait" : "desktop";
}

export interface LayoutModeWatcher {
  /** Current mode. */
  readonly mode: LayoutMode;
  /** Called after every mode change (not on resizes that keep the mode). Returns an unsubscribe. */
  subscribe(listener: (mode: LayoutMode) => void): () => void;
  dispose(): void;
}

/** Content-box size, the same box a ResizeObserver reports as `contentRect`. */
function contentSize(element: HTMLElement) {
  const style = getComputedStyle(element);
  const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return {
    width: Math.max(0, element.clientWidth - (horizontal || 0)),
    height: Math.max(0, element.clientHeight - (vertical || 0)),
  };
}

/**
 * Watch `element` and publish its layout mode as `data-layout` on every target (the element
 * itself by default). The first mode is applied synchronously, before the first paint.
 */
export function observeLayoutMode(
  element: HTMLElement,
  config: LayoutModeConfig,
  targets: HTMLElement[] = [element],
): LayoutModeWatcher {
  const listeners = new Set<(mode: LayoutMode) => void>();
  const initial = contentSize(element);
  let mode = layoutModeFor(initial.width, initial.height, config);
  const publish = () => {
    for (const target of targets) target.dataset.layout = mode;
  };
  publish();
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    const next = layoutModeFor(entry.contentRect.width, entry.contentRect.height, config);
    if (next === mode) return;
    mode = next;
    publish();
    for (const listener of listeners) listener(mode);
  });
  observer.observe(element);
  return {
    get mode() {
      return mode;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      observer.disconnect();
      listeners.clear();
      for (const target of targets) delete target.dataset.layout;
    },
  };
}
