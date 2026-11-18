import type { GameDefinition } from "../domain/contracts.ts";
import { mountBrandLoader, type BrandLoader } from "./brand-loading.ts";

export async function launchGame(
  root: HTMLElement,
  game: GameDefinition,
  mount: (loader?: BrandLoader) => Promise<unknown>,
) {
  document.title = game.title;
  const loader = game.presentation.loadingScreen
    ? mountBrandLoader(root, game.presentation.loadingScreen, game.title)
    : undefined;
  try {
    await mount(loader);
  } catch (error) {
    if (!loader) throw error;
    loader.fail();
    console.error(error);
  }
}
