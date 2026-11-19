import { Application } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import { gameRuntime } from "../../../src/framework/app/game-runtime.ts";
import { tavern } from "../../../src/games/tavern/definition.ts";
import { mountTavernEffects } from "../../../src/games/tavern/effects.ts";
import { loadTavernBitmapFonts } from "../../../src/games/tavern/typography.ts";
import "../../../src/games/tavern/theme.css";

export async function mountWinScreen(withBoard = false) {
  const resources = gameRuntime(tavern).resources;
  await Promise.all([resources.loadBundle("scene"), loadTavernBitmapFonts(resources)]);
  const stage = document.createElement("div"), frame = document.createElement("div");
  stage.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
  frame.style.cssText = "position:absolute;left:20%;top:10%;width:50%;height:60%";
  stage.append(frame); document.body.append(stage);
  const boardApp = new Application();
  if (withBoard) {
    await boardApp.init({ width: 550, height: 730, autoStart: false, preference: "webgl" });
    frame.append(boardApp.canvas);
  }
  const original = Application.prototype.init;
  let app!: Application;
  Application.prototype.init = async function (...args: Parameters<typeof original>) {
    await original.apply(this, args); app = this;
  };
  let effects: Awaited<ReturnType<typeof mountTavernEffects>>;
  try { effects = await mountTavernEffects(stage, frame, frame, stage, tavern.presentation.scene, () => {}, resources, boardApp); }
  finally { Application.prototype.init = original; }
  const overlay = document.createElement("div"); overlay.className = "win-celebration";
  const art = document.createElement("div"); art.className = "tavern-screen-art";
  overlay.append(art); document.body.append(overlay);
  const screens = app.stage.children.find((child) => child instanceof Spine && !!child.skeleton.data.findAnimation("maxwin")) as Spine;
  return {
    async checkChestClips() {
      const closed = {
        mode: "drop" as const, remaining: 2, played: 0, accumulated: 0,
        chests: Array.from({ length: 5 }, () => ({ rows: [] as number[], unlocked: false, multiplier: null })),
      };
      effects.restoreFeature(closed);
      const unlocked = structuredClone(closed);
      unlocked.chests[0] = { rows: [0, 1, 2, 3, 4], unlocked: true, multiplier: null };
      effects.sync(unlocked);
      const reelhouse = app.stage.children.find((child) => child instanceof Spine &&
        child.skeleton.data.findAnimation("30_reel_0_chest_activate")) as Spine;
      const current = (track: number) => reelhouse.state.getCurrent(track)?.animation?.name;
      const activating = current(30);
      const foreground = boardApp.stage.children.find((child) => child instanceof Spine) as Spine;
      const hasActivationSlots = await new Promise<boolean>((resolve) => {
        // Inspect a rendered pose during activation, before the looping idle begins.
        const inspect = () => {
          if (current(30) !== activating) {
            app.ticker.remove(inspect);
            resolve(false);
          } else if (foreground.skeleton.drawOrder.some((slot) =>
            !slot.data.name.startsWith("reel_chest_") && slot.getAttachment() && slot.color.a > 0)) {
            app.ticker.remove(inspect);
            resolve(true);
          }
        };
        app.ticker.add(inspect, undefined, -11);
      });
      await effects.waitForChestActivations();
      const nextFrame = () => new Promise<void>((resolve) => app.ticker.addOnce(() => resolve(), undefined, -11));
      await nextFrame();
      const idle = current(30);
      await effects.revealChests("₩1,000");
      const opening = effects.openChest(0, 5);
      const open = current(50);
      await opening;
      await nextFrame();
      const openIdle = current(50);
      return { activating, hasActivationSlots, idle, open, openIdle };
    },
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
