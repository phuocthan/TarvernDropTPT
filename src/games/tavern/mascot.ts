import { Application, Assets } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { assetUrl } from "../../framework/presentation/assets.ts";

export async function mountMascot(host: HTMLElement) {
  const app = new Application();
  await app.init({
    width: 280,
    height: 320,
    backgroundAlpha: 0,
    resolution: Math.min(devicePixelRatio, 1.5),
    preference: "webgl",
  });
  try {
    const skeleton = assetUrl("tavern-assets/assets/td_character.skel");
    const atlas = assetUrl("tavern-assets/assets/hd/td_master.atlas");
    await Assets.load([skeleton, atlas]);
    const mascot = Spine.from({ skeleton, atlas, ticker: app.ticker });
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    mascot.state.setAnimation(0, "idle", true);
    mascot.update(0);
    const bounds = mascot.getLocalBounds();
    const scale = Math.min(240 / bounds.width, 268 / bounds.height);
    mascot.scale.set(scale);
    mascot.position.set(
      app.screen.width / 2 - (bounds.x + bounds.width / 2) * scale,
      app.screen.height - 12 - (bounds.y + bounds.height) * scale,
    );
    app.stage.addChild(mascot);
    app.canvas.className = "mascot-animation";
    host.append(app.canvas);
    host.dataset.ready = "true";
    if (reduceMotion) {
      app.render();
      app.stop();
    }
    return () => {
      if (reduceMotion) return;
      mascot.state.setAnimation(0, "win", false);
      mascot.state.addAnimation(0, "idle", true, 0);
    };
  } catch (error) {
    app.destroy(true, { children: true });
    throw error;
  }
}
