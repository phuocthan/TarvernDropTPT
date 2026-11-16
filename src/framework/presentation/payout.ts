export async function flyPayout(source: HTMLElement, target: HTMLElement, duration: number) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const copy = source.cloneNode(true) as HTMLElement;
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "fixed", inset: "auto", left: `${from.left}px`, top: `${from.top}px`,
    width: `${from.width}px`, height: `${from.height}px`, margin: "0",
    pointerEvents: "none", zIndex: "10", fontSize: getComputedStyle(source).fontSize,
    transform: "none",
  });
  (source.closest("dialog") ?? document.body).append(copy);
  const x = to.left + (to.width - from.width) / 2 - from.left;
  const y = to.top + (to.height - from.height) / 2 - from.top;
  try {
    await copy.animate([
      { transform: "translate(0, 0)" },
      { transform: `translate(${x}px, ${y}px) scale(0.75)`, opacity: 0 },
    ], { duration, easing: "ease-in" }).finished;
  } finally {
    copy.remove();
  }
}

export async function countPayout(
  from: number, to: number, duration: number, update: (value: number) => void,
) {
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update(to);
    return;
  }
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - start) / duration));
      update(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}
