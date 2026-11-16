export function mountRoundPicker(
  panel: HTMLElement,
  trigger: HTMLButtonElement,
  rounds: number[],
  select: (round: number) => void,
) {
  panel.setAttribute("popover", "auto");
  panel.setAttribute("aria-label", "Autoplay number of rounds");
  const heading = document.createElement("strong");
  heading.textContent = "Autoplay";
  const caption = document.createElement("span");
  caption.textContent = "Number of rounds";
  const choices = document.createElement("div");
  choices.className = "round-picker-options";
  panel.append(heading, caption, choices);
  for (const round of [0, ...rounds]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = round ? String(round) : "–";
    if (!round) button.setAttribute("aria-label", "Turn autoplay off");
    button.dataset.rounds = String(round);
    button.onclick = () => {
      panel.hidePopover();
      select(round);
    };
    choices.append(button);
  }
  panel.addEventListener("toggle", () => {
    trigger.setAttribute("aria-expanded", String(panel.matches(":popover-open")));
  });
  return {
    close() { panel.hidePopover(); },
    toggle(round: number) {
      choices.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.rounds) === round));
      });
      panel.togglePopover();
    },
  };
}

export function updateBetTrack(track: HTMLElement, index: number, levels: number) {
  track.setAttribute("aria-valuemax", String(Math.max(0, levels - 1)));
  track.setAttribute("aria-valuenow", String(index));
  track.style.setProperty("--bet-progress", levels > 1 ? `${(100 * index) / (levels - 1)}%` : "100%");
}
