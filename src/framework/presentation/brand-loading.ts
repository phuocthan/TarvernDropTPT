import "./brand-loading.css";
import type { BrandLoadingConfig } from "../domain/contracts.ts";
import { assetUrl } from "./asset-url.ts";

export interface BrandLoader {
  update(completed: number, total: number): void;
  ready(): void;
  fail(): void;
}

export function mountBrandLoader(
  root: HTMLElement,
  config: BrandLoadingConfig,
  title: string,
): BrandLoader {
  const screen = document.createElement("div");
  screen.className = "brand-loading";
  screen.style.backgroundImage = `url("${assetUrl(config.background)}")`;
  screen.setAttribute("aria-label", `Loading ${title}`);

  const logos = document.createElement("div");
  logos.className = "brand-loading-logos";
  const brand = new Image();
  brand.className = "brand-loading-studio";
  brand.src = assetUrl(config.brandLogo);
  brand.alt = config.brandName;
  const game = new Image();
  game.className = "brand-loading-game";
  game.src = assetUrl(config.gameLogo);
  game.alt = title;
  logos.append(brand, game);

  const progress = document.createElement("div");
  progress.className = "brand-loading-progress";
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
  function update(completed: number, total: number) {
    const percent = Math.round(
      Math.max(0, Math.min(1, completed / total)) * 100,
    );
    progress.textContent = `${percent}%`;
    progress.setAttribute("aria-valuenow", String(percent));
  }
  update(0, 1);
  return {
    update,
    ready() {
      update(1, 1);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          screen.remove();
          root.inert = wasInert;
          root.removeAttribute("aria-busy");
        }),
      );
    },
    fail() {
      root.removeAttribute("aria-busy");
      progress.removeAttribute("role");
      progress.removeAttribute("aria-valuenow");
      progress.textContent = "Could not load the game.";
      reload.hidden = false;
      reload.focus();
    },
  };
}
