interface HoldShortcut {
  code: string;
  holdMs: number;
  enabled: (event: KeyboardEvent) => boolean;
  press: () => void;
  hold: (active: boolean) => void;
}

export function bindHoldShortcut(target: Window, options: HoldShortcut) {
  let down = false;
  let holding = false;
  let timer = 0;

  const release = () => {
    down = false;
    target.clearTimeout(timer);
    if (!holding) return;
    holding = false;
    options.hold(false);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.code !== options.code || !options.enabled(event)) return;
    event.preventDefault();
    if (event.repeat || down) return;
    down = true;
    options.press();
    timer = target.setTimeout(() => {
      holding = true;
      options.hold(true);
    }, options.holdMs);
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.code === options.code) release();
  };
  target.addEventListener("keydown", keyDown);
  target.addEventListener("keyup", keyUp);
  target.addEventListener("blur", release);
  // A hidden page loses key-up events: treat it like losing focus.
  const hidden = () => { if (target.document?.visibilityState === "hidden") release(); };
  target.document?.addEventListener("visibilitychange", hidden);
  return () => {
    release();
    target.document?.removeEventListener("visibilitychange", hidden);
    target.removeEventListener("keydown", keyDown);
    target.removeEventListener("keyup", keyUp);
    target.removeEventListener("blur", release);
  };
}
