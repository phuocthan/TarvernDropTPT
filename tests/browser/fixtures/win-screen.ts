import { Application } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { gameRuntime } from "../../../src/framework/app/game-runtime.ts";
import { tavern } from "../../../src/games/tavern/definition.ts";
import { mountTavernEffects } from "../../../src/games/tavern/effects.ts";
import { loadTavernBitmapFonts } from "../../../src/games/tavern/typography.ts";
import "../../../src/games/tavern/theme.css";

export async function mountWinScreen() {
  const resources = gameRuntime(tavern).resources;
  await Promise.all([resources.loadBundle("scene"), loadTavernBitmapFonts(resources)]);
  const stage = document.createElement("div"), frame = document.createElement("div");
  stage.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
  frame.style.cssText = "position:absolute;left:20%;top:10%;width:50%;height:60%";
  stage.append(frame); document.body.append(stage);
  const original = Application.prototype.init;
  let app!: Application;
  Application.prototype.init = async function (...args: Parameters<typeof original>) {
    await original.apply(this, args); app = this;
  };
  let effects: Awaited<ReturnType<typeof mountTavernEffects>>;
  try { effects = await mountTavernEffects(stage, frame, frame, stage, tavern.presentation.scene, () => {}, resources); }
  finally { Application.prototype.init = original; }
  const overlay = document.createElement("div"); overlay.className = "win-celebration";
  const art = document.createElement("div"); art.className = "tavern-screen-art";
  overlay.append(art); document.body.append(overlay);
  const screens = app.stage.children.find((child) => child instanceof Spine && !!child.skeleton.data.findAnimation("maxwin")) as Spine;
  return {
    async show(clip: string, amount: string) {
      void effects!.showScreen(art, clip, { amount });
      app.stop(); screens.autoUpdate = false;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      app.stop();
    },
    seek(clip: string, time: number) {
      screens.state.setAnimation(0, clip, false).trackTime = time;
      screens.update(0); app.render();
      const slot = screens.getSlotObject("slot_win")!;
      const amount = slot.getBounds();
      const canvas = app.canvas.getBoundingClientRect();
      return { visible: slot.visible && slot.alpha > 0.01, amount: { x: amount.x, y: amount.y, width: amount.width, height: amount.height }, canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height }, duration: screens.skeleton.data.findAnimation(clip)!.duration };
    },
  };
}
