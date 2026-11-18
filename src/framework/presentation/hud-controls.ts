export function mountRoundPicker(
  panel: HTMLElement,
  trigger: HTMLButtonElement,
  rounds: number[],
  select: (round: number) => void,
  unlimited = false,
) {
  panel.setAttribute("popover", "auto");
  panel.setAttribute("aria-label", "Autoplay number of rounds");
  trigger.setAttribute("popovertarget", panel.id);
  trigger.setAttribute("aria-expanded", "false");
  const heading = document.createElement("strong");
  heading.textContent = "Autoplay";
  const caption = document.createElement("span");
  caption.textContent = "Number of rounds";
  const choices = document.createElement("div");
  choices.className = "round-picker-options";
  panel.append(heading, caption, choices);
  for (const round of [unlimited ? Infinity : 0, ...rounds]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = round === Infinity ? "∞" : round ? String(round) : "–";
    if (!round) button.setAttribute("aria-label", "Turn autoplay off");
    if (round === Infinity) button.setAttribute("aria-label", "Unlimited autoplay");
    button.dataset.rounds = String(round);
    button.onclick = () => select(round);
    choices.append(button);
  }
  panel.addEventListener("toggle", () => {
    trigger.setAttribute("aria-expanded", String(panel.matches(":popover-open")));
  });
  return {
    isOpen() { return panel.matches(":popover-open"); },
    close() { panel.hidePopover(); },
    setSelected(round: number) {
      choices.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.rounds) === round));
      });
    },
  };
}

export function updateBetTrack(track: HTMLElement, index: number, levels: number) {
  track.setAttribute("aria-valuemax", String(Math.max(0, levels - 1)));
  track.setAttribute("aria-valuenow", String(index));
  track.style.setProperty("--bet-progress", levels > 1 ? `${(100 * index) / (levels - 1)}%` : "100%");
}

export function mountBetPicker(
  panel: HTMLElement,
  trigger: HTMLButtonElement,
  bets: readonly number[],
  format: (bet: number) => string,
  select: (index: number) => void,
  closeDelayMs = 0,
) {
  const choices = panel.querySelector<HTMLElement>(".bet-picker-options")!;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  function close() {
    if (!panel.matches(":popover-open")) return;
    panel.hidePopover();
    trigger.focus();
  }
  const buttons = bets.map((bet, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = format(bet);
    button.onclick = () => {
      select(index);
      clearTimeout(closeTimer);
      if (closeDelayMs) closeTimer = setTimeout(close, closeDelayMs);
      else close();
    };
    return button;
  });
  choices.append(...buttons);
  panel.addEventListener("beforetoggle", (event) => {
    if (event.newState === "closed") clearTimeout(closeTimer);
  });
  panel.addEventListener("toggle", () => {
    const open = panel.matches(":popover-open");
    trigger.setAttribute("aria-expanded", String(open));
    if (open) choices.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  });
  return {
    sync(index: number, locked: boolean) {
      trigger.disabled = locked;
      if (locked) panel.hidePopover();
      for (const [position, button] of buttons.entries()) {
        const label = format(bets[position]);
        if (button.textContent !== label) button.textContent = label;
        button.setAttribute("aria-pressed", String(index === position));
      }
    },
  };
}
