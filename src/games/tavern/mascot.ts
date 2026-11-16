import { Application, Assets } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { assetUrl } from "../../framework/presentation/assets.ts";
import type { SceneAnchor } from "../../framework/presentation/scene.ts";
import { animationBounds } from "./spine-bounds.ts";

const skeleton = assetUrl("tavern-assets/assets/td_character.skel");
const atlas = assetUrl("tavern-assets/assets/hd/td_master.atlas");

export const loadMascot = () => Assets.load([skeleton, atlas]);

export function createMascot(app: Application) {
  const mascot = Spine.from({ skeleton, atlas, ticker: app.ticker });
  mascot.state.setAnimation(0, "idle", true);
  mascot.update(0);
  return mascot;
}

export function playMascotWin(mascot: Spine) {
  mascot.state.setAnimation(0, "win", false);
  mascot.state.addAnimation(0, "idle", true, 0);
}

export async function mountMascot(host: HTMLElement) {
  const app = new Application();
  await app.init({
    width: 1,
    height: 1,
    backgroundAlpha: 0,
    autoStart: false,
    antialias: true,
    preference: "webgl",
  });
  app.ticker.maxFPS = 30;
  try {
    await loadMascot();
    const mascot = createMascot(app);
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bounds = animationBounds(mascot.skeleton.data, ["idle", "win"]) ?? mascot.getLocalBounds();
    const scale = 360 / Math.max(bounds.width, bounds.height);
    const padding = 8;
    const bufferWidth = Math.ceil(bounds.width * scale) + padding * 2;
    const bufferHeight = Math.ceil(bounds.height * scale) + padding * 2;
    mascot.scale.set(scale);
    mascot.position.set(
      padding - bounds.x * scale,
      padding - bounds.y * scale,
    );
    app.renderer.resize(bufferWidth, bufferHeight);
    app.stage.addChild(mascot);
    app.canvas.className = "mascot-animation";
    host.append(app.canvas);
    host.dataset.ready = "true";
    if (reduceMotion) {
      app.render();
      app.stop();
    }
    return {
      setActive(active: boolean) {
        if (active && !reduceMotion) app.start();
        else app.stop();
      },
      place({ x, y, scale: worldScale }: SceneAnchor) {
        const ratio = worldScale / scale;
        const displayRatio = Math.min(devicePixelRatio, 2) * ratio;
        const resolution = Math.max(1, Math.min(4, Math.ceil(displayRatio * 8) / 8));
        if (app.renderer.resolution !== resolution)
          app.renderer.resize(bufferWidth, bufferHeight, resolution);
        host.dataset.anchored = "true";
        const left = `${x - mascot.x * ratio}px`;
        const top = `${y - mascot.y * ratio}px`;
        const width = `${app.screen.width * ratio}px`;
        if (host.style.left !== left) host.style.left = left;
        if (host.style.top !== top) host.style.top = top;
        if (host.style.width !== width) host.style.width = width;
      },
      win() {
        if (reduceMotion) return;
        playMascotWin(mascot);
      },
    };
  } catch (error) {
    app.destroy(true, { children: true });
    throw error;
  }
}
