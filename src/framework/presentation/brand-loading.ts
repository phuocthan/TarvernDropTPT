import "./brand-loading.css";
import type { BrandLoadingConfig } from "../domain/contracts.ts";
import { assetUrl } from "./asset-url.ts";

export interface BrandLoader {
  update(completed: number, total: number): void;
  waitForIntro(): Promise<void>;
  ready(): Promise<void>;
  fail(): void;
}

export function mountBrandLoader(
  root: HTMLElement,
  config: BrandLoadingConfig,
  title: string,
): BrandLoader {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screen = document.createElement("div");
  screen.className = "brand-loading";
  screen.style.backgroundImage = `url("${assetUrl(config.background)}")`;
  screen.setAttribute("aria-label", `Loading ${title}`);

  const logos = document.createElement("div");
  logos.className = "brand-loading-logos";
  const brandIntro = config.brandIntro;
  const directToLanding = brandIntro?.holdUntilReady === true;
  if (!brandIntro || (reducedMotion && !directToLanding)) {
    const brand = new Image();
    brand.className = "brand-loading-studio";
    brand.src = assetUrl(config.brandLogo);
    brand.alt = config.brandName;
    logos.append(brand);
  }
  if (!directToLanding) {
    const game = new Image();
    game.className = "brand-loading-game";
    game.src = assetUrl(config.gameLogo);
    game.alt = title;
    logos.append(game);
  }

  const progress = document.createElement("div");
  progress.className = "brand-loading-progress";
  progress.hidden = true;
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Loading progress");
  const reload = document.createElement("button");
  reload.className = "brand-loading-reload";
  reload.textContent = "Reload game";
  reload.hidden = true;
  reload.onclick = () => location.reload();
  screen.append(logos, progress, reload);
  const wasInert = root.inert;
  root.inert = true;
  root.setAttribute("aria-busy", "true");
  root.after(screen);
  let intro: HTMLElement | undefined;
  let introFinished = Promise.resolve();
  const afterPaint = () => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  if (brandIntro && (!reducedMotion || directToLanding)) {
    const panel = document.createElement("div");
    panel.className = "brand-loading-intro";
    const animation = new Image();
    animation.alt = config.brandName;
    animation.fetchPriority = "high";
    animation.src = assetUrl(reducedMotion ? config.brandLogo : brandIntro.src);
    panel.append(animation);
    screen.append(panel);
    screen.classList.add("brand-loading-with-intro");
    intro = panel;
    introFinished = (async () => {
      try {
        await animation.decode();
        if (!reducedMotion) {
          await new Promise<void>((resolve) => setTimeout(resolve, brandIntro.durationMs));
          // Present the final GIF frame before WebGL initialization can occupy the thread.
          await afterPaint();
        }
      } catch {
        if (directToLanding && !reducedMotion) animation.src = assetUrl(config.brandLogo);
      }
      if (!directToLanding) {
        panel.remove();
        if (reload.hidden) await new Promise<void>((resolve) => setTimeout(resolve, 200));
      }
    })();
  }
  let shown = 0;
  let target = 0;
  let from = 0;
  let started = 0;
  let progressFrame = 0;
  let failed = false;
  let finished = false;
  function display(value: number) {
    shown = value;
    const percent = Math.floor(value);
    progress.textContent = `${percent}%`;
    progress.setAttribute("aria-valuenow", String(percent));
  }
  function animateProgress(now: number) {
    const fraction = Math.max(0, Math.min(1, (now - started) / 300));
    display(from + (target - from) * (1 - (1 - fraction) ** 3));
    progressFrame = fraction < 1 ? requestAnimationFrame(animateProgress) : 0;
  }
  function update(completed: number, total: number) {
    if (failed || finished || total <= 0 || !Number.isFinite(completed / total)) return;
    // Resource downloads alone cannot complete startup: ready() owns the final 100%.
    const next = Math.max(target, Math.min(99, Math.max(0, completed / total * 100)));
    if (next === target) return;
    from = shown;
    target = next;
    started = performance.now();
    if (reducedMotion) display(target);
    else if (!progressFrame) progressFrame = requestAnimationFrame(animateProgress);
  }
  display(0);
  let reveal: Promise<void> | undefined;
  let fade: Animation | undefined;
  return {
    update,
    waitForIntro: () => introFinished,
    ready() {
      return reveal ??= (async () => {
        await introFinished;
        if (!reload.hidden) return;
        finished = true;
        cancelAnimationFrame(progressFrame);
        display(100);
        if (!reducedMotion) {
          await afterPaint();
          if (!reload.hidden) return;
          fade = screen.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 250,
            easing: "ease-out",
            fill: "forwards",
          });
          await fade.finished.catch(() => undefined);
        }
        if (reload.hidden) {
          screen.remove();
          root.inert = wasInert;
          root.removeAttribute("aria-busy");
        }
      })();
    },
    fail() {
      failed = true;
      cancelAnimationFrame(progressFrame);
      root.removeAttribute("aria-busy");
      progress.removeAttribute("role");
      progress.removeAttribute("aria-valuenow");
      progress.textContent = "Could not load the game.";
      progress.hidden = false;
      reload.hidden = false;
      intro?.remove();
      fade?.cancel();
      reload.focus();
    },
  };
}
