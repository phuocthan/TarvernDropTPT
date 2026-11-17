import { Application, Assets, BitmapText, Graphics, Text } from "pixi.js";
import {
  RegionAttachment,
  AttachmentTimeline,
  Spine,
  type Skeleton,
  type Slot,
} from "@esotericsoftware/spine-pixi-v8";
import type { FeatureState, ReelPresentation, SymbolLandingEffects } from "../../framework/domain/contracts.ts";
import { drawDimmer, zoomScene, type SceneAnchor } from "../../framework/presentation/scene.ts";
import { tavernAsset } from "./art.ts";
import { hasTavernBitmapFont } from "./typography.ts";
import { createMascot, loadMascot, playMascotWin } from "./mascot.ts";
import { animationBounds } from "./spine-bounds.ts";

const atlas = tavernAsset("hd/td_master.atlas");
const backgroundUrl = tavernAsset("td_backgrounds.skel");
const reelhouseUrl = tavernAsset("td_reelhouse.skel");
const screensUrl = tavernAsset("td_screens.skel");
const cameraEffects = new Set(["fade", "fx_light"]);
const introArtSlots = new Set(["bonus_title", "bonus_img", "bonus_desc", "fs"]);

export function createReelhouse(app: Application, autoUpdate = false) {
  return Spine.from({
    skeleton: reelhouseUrl,
    atlas,
    ticker: app.ticker,
    autoUpdate,
  });
}

export async function loadReelhouse() {
  await Assets.load([atlas, reelhouseUrl]);
}

export function playClip(spine: Spine, track: number, name: string) {
  const entry = spine.state.setAnimation(track, name, false);
  if (!entry.animation?.duration) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => resolve();
    entry.listener = { complete: finish, dispose: finish };
  });
}

function screenBounds(
  data: Skeleton["data"],
  animations: string[],
  artSlots?: ReadonlySet<string>,
) {
  return animationBounds(data, animations, (slot) =>
    !cameraEffects.has(slot.data.name) && (!artSlots || artSlots.has(slot.data.name)),
  ) ?? { x: -3000, y: -2000, width: 6000, height: 4000 };
}

export async function mountTavernEffects(
  stage: HTMLElement,
  frame: HTMLElement,
  reelHost: HTMLElement,
  foreground: HTMLElement,
  sceneLayout: ReelPresentation["scene"],
  placeMascot: (anchor?: SceneAnchor | null) => void,
) {
  const slots = sceneLayout?.slots ?? {};
  const camera = sceneLayout?.backgroundCamera;
  await Assets.load([atlas, backgroundUrl, reelhouseUrl, screensUrl]);
  const mascotLoaded = await loadMascot().then(() => true, () => false);
  const app = new Application();
  await app.init({
    width: stage.clientWidth,
    height: stage.clientHeight,
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(devicePixelRatio, 1.5),
    preference: "webgl",
  });
  app.ticker.maxFPS = 30;
  app.ticker.minFPS = 0;

  const background = Spine.from({
    skeleton: backgroundUrl,
    atlas,
    ticker: app.ticker,
    autoUpdate: false,
  });
  const reelhouse = createReelhouse(app, true);
  const chestTotal = new BitmapText({ style: { fontFamily: "td_gold", fontSize: 480 } });
  chestTotal.anchor.set(0.5);
  chestTotal.visible = false;
  reelhouse.addSlotObject("slot_finalwin", chestTotal, { followSlotColor: true });
  const chestMultipliers = Array.from({ length: 5 }, (_, reel) => {
    const text = new BitmapText({ style: { fontFamily: "td_gold", fontSize: 260 } });
    text.anchor.set(0.5);
    text.visible = false;
    reelhouse.addSlotObject(`slot_reel_mult_${reel}`, text, { followSlotColor: true });
    return text;
  });
  let chestZoom: Animation | undefined;
  let reelExit: Animation | undefined;
  const openingDimmer = new Graphics();
  openingDimmer.visible = false;
  const tables = [
    [background.skeleton.findSlot(slots.baseTable ?? ""), foreground.querySelector<HTMLElement>(".base-art")],
    [background.skeleton.findSlot(slots.bonusTable ?? ""), foreground.querySelector<HTMLElement>(".bonus-art")],
  ] as const;
  const foregroundAlpha = new Map<Slot, number>();
  const vertices = new Float32Array(8);
  background.afterUpdateWorldTransforms = () => {
    const opening = stage.parentElement?.hasAttribute("data-opening");
    for (const [slot, table] of tables) {
      if (!slot || !table) continue;
      if (opening) {
        table.style.opacity = "0";
        continue;
      }
      const attachment = slot.getAttachment();
      table.style.opacity = attachment ? String(slot.color.a) : "0";
      if (attachment instanceof RegionAttachment) {
        foreground.dataset.anchored = "true";
        attachment.computeWorldVertices(slot, vertices, 0, 2);
        const [blX, blY, tlX, tlY, trX, trY] = vertices;
        const scale = background.scale.x;
        const ux = (trX - tlX) * scale, uy = (trY - tlY) * scale;
        const vx = (blX - tlX) * scale, vy = (blY - tlY) * scale;
        const width = Math.hypot(ux, uy), height = Math.hypot(vx, vy);
        if (width > 0 && height > 0) {
          table.style.width = `${width}px`;
          table.style.height = `${height}px`;
          table.style.transform = `matrix(${ux / width},${uy / width},${vx / height},${vy / height},${background.x + tlX * scale},${background.y + tlY * scale})`;
        }
      }
      foregroundAlpha.set(slot, slot.color.a);
      slot.color.a = 0;
    }
  };
  const screens = Spine.from({
    skeleton: screensUrl,
    atlas,
    ticker: app.ticker,
    autoUpdate: false,
  });
  const payout = new BitmapText({
    style: { fontFamily: "td_gold", fontSize: 480 },
  });
  payout.anchor.set(0.5);
  screens.addSlotObject("slot_win", payout, { followSlotColor: true });
  const spinCount = new Text({
    style: {
      fontFamily: "Outfit",
      fontWeight: "800",
      fontSize: 310,
      fill: 0xffd35a,
      stroke: { color: 0x3f200e, width: 30, join: "round" },
    },
  });
  spinCount.anchor.set(0.5);
  screens.addSlotObject("fs", spinCount, { followSlotColor: true });
  screens.afterUpdateWorldTransforms = ({ skeleton }) => {
    // The dialog backdrop already dims the whole viewport.
    skeleton.findSlot("fade")?.setAttachment(null);
    // Only the exact count of ten can use the authored text sprite.
    if (spinCount.text) skeleton.findSlot("fs")?.setAttachment(null);
  };
  screens.visible = false;
  app.stage.addChild(background, openingDimmer, reelhouse, screens);
  const portraitMascot = mascotLoaded ? createMascot(app) : undefined;
  if (portraitMascot) {
    portraitMascot.visible = portraitMascot.autoUpdate = false;
    app.stage.addChildAt(portraitMascot, app.stage.getChildIndex(reelhouse));
  }
  app.canvas.className = "tavern-spine-canvas";
  app.canvas.setAttribute("aria-hidden", "true");
  const scene = document.createElement("div");
  scene.className = "tavern-spine-scene";
  const frozenScene = document.createElement("canvas");
  frozenScene.className = "tavern-spine-canvas";
  frozenScene.setAttribute("aria-hidden", "true");
  stage.prepend(scene);
  scene.append(app.canvas);
  let host: HTMLElement = scene;
  let mode: "base" | "bonus" | undefined;
  let previousFeature: FeatureState | null = null;
  let portrait = stage.clientHeight > stage.clientWidth;
  let baseExited = false;
  let bonusExited = false;
  let bounds = screenBounds(screens.skeleton.data, []);
  const viewports = new Map<string, typeof bounds>();

  function updateBackground(time: number) {
    for (const [slot, alpha] of foregroundAlpha) slot.color.a = alpha;
    background.update(time);
    const source = portrait ? reelhouse : background;
    const anchor = source.skeleton.findSlot((portrait ? slots.portraitMascot : slots.landscapeMascot) ?? "")?.bone;
    const inlineMascot = portrait && !!anchor && !!portraitMascot;
    stage.toggleAttribute("data-mascot-behind-board", inlineMascot);
    if (portraitMascot) {
      portraitMascot.visible = portraitMascot.autoUpdate =
        inlineMascot && !stage.parentElement?.hasAttribute("data-opening");
    }
    if (!anchor) {
      placeMascot();
      return;
    }
    const position = {
      x: source.x + anchor.worldX * source.scale.x,
      y: source.y + anchor.worldY * source.scale.y,
      scale: Math.hypot(anchor.a, anchor.c) * source.scale.x,
    };
    if (inlineMascot && portraitMascot) {
      portraitMascot.position.set(position.x, position.y);
      portraitMascot.scale.set(position.scale);
      placeMascot(null);
    } else placeMascot(position);
  }
  app.ticker.add((tick) => {
    if (host === scene) updateBackground(tick.deltaMS / 1000);
  }, undefined, -10);

  function layout() {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    if (app.screen.width !== width || app.screen.height !== height)
      app.renderer.resize(width, height);
    if (openingDimmer.visible)
      drawDimmer(openingDimmer, width, height, sceneLayout?.openingDimmerOpacity ?? 0);
    if (host !== scene) {
      const scale =
        Math.min(width / bounds.width, height / bounds.height) *
        (host.closest(".win-celebration") ? 1.55 : 0.94);
      screens.scale.set(scale);
      screens.position.set(
        width / 2 - (bounds.x + bounds.width / 2) * scale,
        height / 2 - (bounds.y + bounds.height / 2) * scale,
      );
      return;
    }
    const nextPortrait = height > width;
    if (nextPortrait !== portrait) {
      portrait = nextPortrait;
      applyOrientation();
    }
    const sceneRect = scene.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const bottom = (portrait ? camera?.portraitBottom : camera?.landscapeBottom) ?? 1940;
    const backgroundScale = Math.max(
      width / (camera?.width ?? 6000),
      height / ((camera?.top ?? 2060) + bottom),
    );
    background.scale.set(backgroundScale);
    background.position.set(
      width / 2 + (camera?.centerOffsetX ?? 80) * backgroundScale,
      height - bottom * backgroundScale,
    );
    const sceneScale = sceneRect.width / scene.clientWidth || 1;
    const reelScale = frameRect.width / sceneScale / 3976;
    reelhouse.scale.set(reelScale);
    // The source bonus pose lifts the frame by 221 Spine units.
    reelhouse.position.set(
      (frameRect.left - sceneRect.left) / sceneScale + 1991 * reelScale,
      (frameRect.top - sceneRect.top) / sceneScale +
        (mode === "bonus" ? 2001 : 1780) * reelScale,
    );
    updateBackground(0);
  }
  const observer = new ResizeObserver(layout);
  observer.observe(stage);
  observer.observe(frame);
  layout();

  function applyOrientation() {
    if (portrait) {
      reelhouse.state.setAnimation(0, "0_mobile", false);
      background.state.setAnimation(4, "4_mobile", false);
    } else {
      reelhouse.state.clearTrack(0);
      background.state.clearTrack(4);
    }
  }

  function setMode(next: "base" | "bonus") {
    if (next === mode) return;
    if (next === "base") {
      chestZoom?.cancel();
      reelExit?.cancel();
    }
    const was = mode;
    mode = next;
    chestTotal.text = "";
    chestTotal.visible = false;
    for (const text of chestMultipliers) {
      text.text = "";
      text.visible = false;
    }
    delete stage.dataset.chestReveal;
    previousFeature = null;
    background.state.clearTracks();
    reelhouse.state.clearTracks();
    foregroundAlpha.clear();
    background.skeleton.setToSetupPose();
    reelhouse.skeleton.setToSetupPose();
    applyOrientation();
    if (was || next === "base") {
      background.state.setAnimation(0, `0_${next}_enter`, false);
      background.state.addAnimation(0, `0_${next}_idle`, true, 0);
    } else {
      background.state.setAnimation(0, "0_bonus_idle", true);
    }
    if (!was && next === "base") {
      reelhouse.state.setAnimation(
        1,
        portrait ? "1_game_enter_mobile" : "1_game_enter",
        false,
      );
      reelhouse.state.addAnimation(1, "1_idle", true, 0);
    } else if (was) {
      if ((baseExited && next === "bonus") || (bonusExited && next === "base")) {
        reelhouse.state.setAnimation(2, `2_${next}_enter`, false);
      } else {
        reelhouse.state.setAnimation(2, `2_${was}_exit`, false);
        reelhouse.state.addAnimation(2, `2_${next}_enter`, false, 0);
      }
      background.state.setAnimation(1, "1_zoom_out", false);
      if (next === "base") reelhouse.state.addAnimation(2, "1_idle", true, 0);
    } else {
      const entry = reelhouse.state.setAnimation(2, "2_bonus_enter", false);
      entry.trackTime = entry.animation!.duration;
    }
    baseExited = false;
    bonusExited = false;
    reelhouse.update(0);
    layout();
  }

  function syncFeature(feature: FeatureState | null) {
    if (!feature) return;
    feature.chests.forEach((chest, reel) => {
      const previous = previousFeature?.chests[reel];
      for (const row of chest.rows) {
        if (previous?.rows.includes(row)) continue;
        const index = reel * 5 + row;
        const entry = reelhouse.state.setAnimation(
          5 + index,
          `${5 + index}_activate_${reel}_${row}`,
          false,
        );
        if (!previousFeature) entry.trackTime = entry.animation!.duration;
      }
      if (chest.unlocked && !previous?.unlocked) {
        const prefix = `${30 + reel * 2}_reel_${reel}_chest_`;
        if (previousFeature) {
          reelhouse.state.setAnimation(30 + reel, prefix + "activate", false);
          reelhouse.state.addAnimation(30 + reel, prefix + "idle", true, 0);
        } else {
          reelhouse.state.setAnimation(30 + reel, prefix + "idle", true);
        }
      }
    });
    previousFeature = feature;
  }

  function hideScreen() {
    if (host === scene) return;
    observer.unobserve(host);
    host.removeAttribute("data-spine-ready");
    host.removeAttribute("data-spine-amount");
    host.removeAttribute("data-spine-count");
    host = scene;
    screens.state.clearTracks();
    screens.visible = false;
    screens.autoUpdate = false;
    reelhouse.visible = background.visible = true;
    reelhouse.autoUpdate = true;
    frozenScene.remove();
    scene.append(app.canvas);
    stage.dataset.spineScene = "true";
    layout();
  }

  function mountOverlay(target: HTMLElement) {
    if (host !== scene && host !== target) hideScreen();
    if (host === scene) {
      frozenScene.width = app.canvas.width;
      frozenScene.height = app.canvas.height;
      app.render();
      frozenScene.getContext("2d")?.drawImage(app.canvas, 0, 0);
      scene.append(frozenScene);
    }
    host = target;
    target.dataset.spineReady = "true";
    target.append(app.canvas);
    observer.observe(target);
    reelhouse.visible = background.visible = false;
    reelhouse.autoUpdate = false;
    if (portraitMascot) portraitMascot.visible = portraitMascot.autoUpdate = false;
  }

  function playSceneEffects(clips: SymbolLandingEffects) {
    for (const [layer, spine] of Object.entries({ background, reelhouse })) {
      const clip = clips[layer];
      if (!clip || !spine.skeleton.data.findAnimation(clip)) continue;
      void playClip(spine, 3, clip);
      spine.state.addEmptyAnimation(3, 0);
    }
  }

  return {
    celebrateMascot() {
      if (portraitMascot?.visible) playMascotWin(portraitMascot);
    },
    showOpening() {
      setMode("base");
      openingDimmer.visible = true;
      layout();
      stage.dataset.spineScene = "true";
      background.state.setAnimation(1, "1_zoom_in", false);
      reelhouse.state.setAnimation(
        1,
        portrait ? "1_splash_intro_mobile" : "1_splash_intro",
        false,
      );
    },
    async enterGame() {
      openingDimmer.visible = false;
      background.state.setAnimation(1, "1_zoom_out", false);
      const done = playClip(
        reelhouse,
        1,
        portrait ? "1_game_enter_mobile" : "1_game_enter",
      );
      reelhouse.state.addAnimation(1, "1_idle", true, 0);
      await done;
    },
    sync(feature: FeatureState | null) {
      setMode(feature ? "bonus" : "base");
      syncFeature(feature);
      if (host === scene) stage.dataset.spineScene = "true";
    },
    spin() {
      void playClip(reelhouse, 3, "3_spin_start");
      reelhouse.state.addEmptyAnimation(3, 0);
    },
    skip() {
      void playClip(reelhouse, 3, "3_skip");
      reelhouse.state.addEmptyAnimation(3, 0);
    },
    playSceneEffects,
    shake() {
      playSceneEffects({ background: "3_shake", reelhouse: "3_shake" });
    },
    async prepareBonusIntro() {
      baseExited = true;
      background.state.setAnimation(1, "1_zoom_in", false);
      reelhouse.state.setAnimation(2, "2_base_exit", false);
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    },
    async revealChests(amount: string) {
      chestTotal.text = amount;
      chestTotal.visible = true;
      stage.dataset.chestReveal = "true";
      if (sceneLayout?.chestCamera)
        chestZoom = zoomScene(stage, sceneLayout.chestCamera);
      await Promise.all([chestZoom?.finished, playClip(reelhouse, 4, "4_finalwin")]);
    },
    async prepareTotalWin() {
      bonusExited = true;
      chestZoom?.cancel();
      layout();
      background.state.setAnimation(1, "1_zoom_in", false);
      const exit = reelhouse.skeleton.data.findAnimation("2_bonus_exit")!;
      const reelBone = reelhouse.skeleton.findSlot("slot_symbols")?.bone
        ?? reelhouse.skeleton.findBone("slot_symbols");
      const distance = stage.clientHeight - frame.offsetTop;
      const duration = exit.duration * 1000;
      const firstY = reelBone?.worldY ?? 0;
      const finished = playClip(reelhouse, 90, exit.name);
      reelhouse.state.setAnimation(91, "41_fade_extras", false);
      const followReels = () => {
        if (reelBone) {
          const y = (reelBone.worldY - firstY) * reelhouse.scale.y;
          reelHost.style.translate = `0 ${y}px`;
        }
      };
      if (reelBone) app.ticker.add(followReels, undefined, -10);
      else reelExit = reelHost.animate(
        [{ translate: "0 0" }, { translate: `0 ${distance}px` }],
        { duration, fill: "forwards", easing: "ease-in" },
      );
      await finished;
      app.ticker.remove(followReels);
      reelHost.style.removeProperty("translate");
      chestTotal.text = "";
      for (const text of chestMultipliers) text.text = "";
      reelhouse.update(0);
    },
    async showScreen(
      target: HTMLElement,
      name: string,
      {
        idle,
        outro,
        amount,
        count,
      }: {
        idle?: string;
        outro?: string;
        amount?: string;
        count?: number;
      } = {},
    ) {
      mountOverlay(target);
      screens.visible = true;
      screens.autoUpdate = true;
      payout.text = amount && hasTavernBitmapFont("td_gold") ? amount : "";
      payout.scale.set(1);
      if (payout.width > 3000) payout.scale.set(3000 / payout.width);
      spinCount.text =
        count === undefined || count === 10 ? "" : `${count} FREE SPINS`;
      target.toggleAttribute("data-spine-count", count !== undefined);
      target.toggleAttribute("data-spine-amount", !!payout.text);
      const key = [name, idle, outro].join(":");
      const intro = name === "bonus_intro" || name === "super_intro";
      bounds =
        viewports.get(key) ??
        screenBounds(
          screens.skeleton.data,
          intro
            ? [name]
            : [name, ...[idle, outro].filter((clip): clip is string => !!clip)],
          intro ? introArtSlots : undefined,
        );
      viewports.set(key, bounds);
      target.dataset.spineClip = name;
      layout();
      screens.state.clearTracks();
      screens.skeleton.setToSetupPose();
      const done = playClip(screens, 0, name);
      if (idle) screens.state.addAnimation(0, idle, true, 0);
      screens.update(0);
      await done;
    },
    setScreenAmount(amount: string) {
      payout.text = hasTavernBitmapFont("td_gold") ? amount : "";
      payout.scale.set(1);
      if (payout.width > 3000) payout.scale.set(3000 / payout.width);
    },
    winScreenTiming(name: string) {
      const animation = screens.skeleton.data.findAnimation(name);
      const times: Record<string, number> = {};
      for (const timeline of animation?.timelines ?? []) {
        if (!(timeline instanceof AttachmentTimeline)) continue;
        const slot = screens.skeleton.data.slots[timeline.slotIndex]?.name;
        if (slot && ["big_win_text", "super_win_text", "mega_win_text", "epic_win_text", "max_win_text"].includes(slot))
          times[slot] = timeline.frames[0];
      }
      return { duration: animation?.duration ?? 1.5, times };
    },
    screenTime() {
      return screens.state.getCurrent(0)?.trackTime ?? 0;
    },
    async openChest(reel: number, multiplier: number) {
      stage.dataset.chestOpening = String(reel);
      const text = chestMultipliers[reel];
      text.text = `x${multiplier}`;
      text.visible = true;
      const prefix = `${30 + reel * 2}_reel_${reel}_chest_`;
      const done = playClip(reelhouse, 50 + reel, prefix + "open");
      reelhouse.state.addAnimation(50 + reel, prefix + "open_idle", true, 0);
      await done;
      stage.dataset.chestOpened = String(reel);
    },
    finishChest(reel: number) {
      const name = `${31 + reel * 2}_reel_${reel}_chest_finalwin`;
      return playClip(reelhouse, 60 + reel, name);
    },
    setChestAmount(amount: string) {
      chestTotal.text = amount;
    },
    async endScreen(name?: string) {
      if (host === scene) return;
      if (name) {
        await playClip(screens, 0, name);
        background.state.setAnimation(1, "1_zoom_out", false);
      }
      hideScreen();
    },
  };
}
