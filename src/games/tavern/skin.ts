import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { ResourceManager } from "../../framework/resources/resource-manager.ts";
import { Spine, type Animation, type TrackEntry } from "@esotericsoftware/spine-pixi-v8";
import type { SymbolFactory, SymbolPhase } from "../../framework/presentation/board.ts";
import { textureRegion } from "./art.ts";
import symbolVerticalBounds from "./symbol-vertical-bounds.json";

// The four skeletons use the same authored origin and units. At a 110px reel
// pitch this scale matches the visible symbol sizes on the reference board.
const spineScale = 0.18;
// Rendered silhouette at the authored scale, sampled at 30 fps at alpha >= 96/255.
const boundsByClip: Record<string, number[][]> = symbolVerticalBounds;
const symbols = [
  ["A", "l1", 490, 384, 393, 576],
  ["K", "l2", 473, 402, 426, 535],
  ["Q", "l3", 504, 383, 365, 578],
  ["J", "l4", 503, 414, 366, 516],
  ["10", "l5", 447, 420, 478, 504],
  ["ale", "h4", 420, 400, 541, 531],
  ["barrel", "h2", 468, 423, 478, 537],
  ["coin", "h3", 517, 389, 429, 534],
  ["crown", "h1", 387, 353, 625, 584],
  ["wild", "wild", 359, 345, 666, 754],
  ["bonus", "bonus", 351, 285, 680, 789],
] as const;

export function paytableIcon(id: string) {
  const [, file, x, y, width, height] = symbols.find(
    ([symbol]) => symbol === id,
  )!;
  return textureRegion(
    file + "_static.webp",
    "paytable-icon",
    [1400, 1400],
    [x, y, width, height],
  );
}

export async function loadTavernSymbols(resources: ResourceManager): Promise<SymbolFactory> {
  const textures = new Map<string, Texture>();
  const atlas = resources.url("atlas");
  const groups = { l: "low", h: "high", w: "wild", b: "bonus" } as const;
  const skeletons = new Map(
    Object.entries(groups).map(([prefix, group]) => [
      prefix,
      resources.url(`symbols.${group}`),
    ]),
  );
  const clipsReady =
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    (await resources.loadBundle("symbol-spines").then(
      () => true,
      (error) => {
        console.warn("Tavern symbol animations unavailable", error);
        return false;
      },
    ));
  if (!clipsReady) {
    await resources.loadBundle("symbols-static");
    for (const [id, , x, y, width, height] of symbols) {
      const texture = resources.get<Texture>(`symbol.${id}`);
      textures.set(id, new Texture({
        source: texture.source,
        frame: new Rectangle(x, y, width, height),
      }));
    }
  }
  const clips = new Map<string, string>(symbols.map(([id, name]) => [id, name]));
  return (cellSizePx, ticker) => {
    const cellCenter = cellSizePx / 2;
    const sizing = cellSizePx / 102;
    const view = new Container();
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    sprite.position.set(cellCenter);
    sprite.scale.set(0.15 * sizing);
    view.addChild(sprite);
    let id = "";
    let phase: SymbolPhase = "idle";
    let active: Spine | undefined;
    const instances = new Map<string, Spine>();

    function play(next: SymbolPhase, restart = false): Promise<void> | void {
      phase = next;
      const name = clips.get(id);
      if (!clipsReady || !name) return;
      const family = name[0];
      let spine = instances.get(family);
      if (!spine) {
        spine = Spine.from({
          skeleton: skeletons.get(family)!,
          atlas,
          ticker,
          autoUpdate: false,
        });
        spine.position.set(cellCenter);
        spine.scale.set(spineScale * sizing);
        instances.set(family, spine);
        view.addChild(spine);
      }
      if (active && active !== spine) {
        active.autoUpdate = false;
        active.visible = false;
      }
      active = spine;
      spine.visible = true;
      sprite.visible = false;

      const idle = spine.skeleton.data.findAnimation(`${name}_static`)!;
      const clip = spine.skeleton.data.findAnimation(`${name}_${next}`) ?? idle;
      const current = spine.state.getCurrent(0);
      if (!restart && current?.animation === clip) return;

      // Finish an authored landing before a winning symbol changes pose.
      if (
        !restart && next === "win" && clip !== idle &&
        current?.animation?.name === `${name}_land` &&
        current.trackTime < current.animationEnd
      ) {
        spine.state.clearNext(current);
        const win = spine.state.addAnimation(0, clip.name, false);
        queueIdle(spine, idle);
        return winFinished(win);
      }

      spine.state.clearTracks();
      spine.skeleton.setToSetupPose();
      const entry = spine.state.setAnimation(0, clip.name, clip === idle && idle.duration > 0);
      if (clip !== idle && clip.duration > 0) queueIdle(spine, idle);
      spine.update(0);
      spine.autoUpdate = clip.duration > 0;
      if ((next === "win" || next === "land") && clip !== idle && clip.duration > 0)
        return winFinished(entry);
    }

    function winFinished(entry: TrackEntry) {
      return new Promise<void>((resolve) => {
        const finish = () => resolve();
        entry.listener = { complete: finish, dispose: finish };
      });
    }

    function queueIdle(spine: Spine, idle: Animation) {
      const entry = spine.state.addAnimation(0, idle.name, idle.duration > 0);
      if (idle.duration === 0) {
        entry.listener = {
          start: () => { spine.autoUpdate = false; },
        };
      }
    }

    return {
      view,
      set(nextId: string) {
        if (id === nextId) return;
        id = nextId;
        if (!clipsReady) sprite.texture = textures.get(id)!;
        play(phase, true);
      },
      effect: play,
      verticalBounds() {
        if (!clipsReady && sprite.texture !== Texture.EMPTY) {
          return { top: cellCenter - sprite.height / 2, bottom: cellCenter + sprite.height / 2 };
        }
        const entry = active?.state.getCurrent(0);
        const clip = entry?.animation;
        const frames = clip && boundsByClip[clip.name];
        if (!entry || !clip || !frames) return;
        const last = frames.length - 1;
        const t = clip.duration
          ? Math.max(0, Math.min(1, entry.getAnimationTime() / clip.duration)) * last
          : 0;
        const index = Math.floor(t);
        const [top, bottom] = frames[index];
        const [nextTop, nextBottom] = frames[Math.min(index + 1, last)];
        return {
          top: cellCenter + (top + (nextTop - top) * (t - index)) * sizing,
          bottom: cellCenter + (bottom + (nextBottom - bottom) * (t - index)) * sizing,
        };
      },
    };
  };
}
