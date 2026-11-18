import { Application, Assets, BitmapText, Graphics, Text } from "pixi.js";
import {
  RegionAttachment,
  AttachmentTimeline,
  Spine,
  type Skeleton,
  type Slot,
  type TrackEntry,
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

export function playClip(spine: Spine, track: number, name: string, playbackRate = 1) {
  const entry = spine.state.setAnimation(track, name, false);
  entry.timeScale = playbackRate;
  return waitForClip(entry);
}

function waitForClip(entry: TrackEntry) {
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
  const [, mascotLoaded] = await Promise.all([
    Assets.load([atlas, backgroundUrl, reelhouseUrl, screensUrl]),
    loadMascot().then(() => true, () => false),
  ]);
  const app = new Application();
  await app.init({
    width: stage.clientWidth,
    height: stage.clientHeight,
    autoStart: false,
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(devicePixelRatio, 1.25),
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
  const reelhouse = createReelhouse(app);
  const symbolAnchor = reelhouse.skeleton.findSlot("slot_symbols")?.bone
    ?? reelhouse.skeleton.findBone("slot_symbols");
  let baseSymbolY: number | undefined;
  const chestSlots = reelhouse.skeleton.slots.filter((slot) =>
    slot.data.name.startsWith("reel_chest_"),
  );
  const chestAlpha = new Map<Slot, number>();
  const chestTotal = new BitmapText({ style: { fontFamily: "td_gold", fontSize: 240 } });
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
  let totalWinRenderer: Promise<Application | undefined> | undefined;
  let liveOverlay: Application | undefined;
  let mode: "base" | "bonus" | undefined;
  let previousFeature: FeatureState | null = null;
  const compactScene = matchMedia("(max-aspect-ratio: 4/5)");
  let portrait = compactScene.matches;
  let baseExited = false;
  let bonusExited = false;
  let revealingChests = false;
  let bounds = screenBounds(screens.skeleton.data, []);
  const viewports = new Map<string, typeof bounds>();

  function updateReelhouse(time: number) {
    // Free spins draw the atlas chests over the separate symbol canvas.
    for (const [slot, alpha] of chestAlpha) slot.color.a = alpha;
    chestAlpha.clear();
    reelhouse.update(time);
    const foreground = mode === "bonus" && !revealingChests && !bonusExited;
    stage.toggleAttribute("data-foreground-chests", foreground);
    if (!foreground) return;
    for (const slot of chestSlots) {
      chestAlpha.set(slot, slot.color.a);
      slot.color.a = 0;
    }
  }

  function updateBackground(time: number) {
    for (const [slot, alpha] of foregroundAlpha) slot.color.a = alpha;
    background.update(time);
    const source = portrait ? reelhouse : background;
    const anchor = source.skeleton.findSlot((portrait ? slots.portraitMascot : slots.landscapeMascot) ?? "")?.bone;
    const inlineMascot = portrait && !!anchor && !!portraitMascot;
    stage.toggleAttribute("data-mascot-behind-board", inlineMascot);
    const shell = stage.parentElement;
    const mascotHidden = !mode || shell?.hasAttribute("data-opening") || shell?.dataset.entering === "before-mascot";
    if (portraitMascot) {
      portraitMascot.visible = portraitMascot.autoUpdate =
        inlineMascot && !mascotHidden;
    }
    if (mascotHidden) {
      placeMascot(null);
      return;
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
    if (host !== scene && !liveOverlay) return;
    const time = tick.deltaMS / 1000;
    updateReelhouse(time);
    updateBackground(time);
  }, undefined, -10);

  function layout() {
    if (host !== scene) {
      const { clientWidth: width, clientHeight: height } = host;
      if (width && height) {
        const overlay = liveOverlay ?? app;
        if (overlay.screen.width !== width || overlay.screen.height !== height)
          overlay.renderer.resize(width, height);
        const mobile = compactScene.matches;
        const retrigger = host.dataset.spineClip === "addfs";
        const celebration = host.closest(".win-celebration");
        const totalWin = host.classList.contains("total-win-screen");
        const fit = retrigger ? 0.85
          : totalWin && mobile ? 1.4
          : celebration ? (mobile ? 1.71 : 1.55) : 0.94;
        const scale = Math.min(width / bounds.width, height / bounds.height) * fit;
        const centerX = width * (mobile && (totalWin || (celebration && !retrigger)) ? 0.48 : 0.5);
        screens.scale.set(scale);
        screens.position.set(
          centerX - (bounds.x + bounds.width / 2) * scale,
          height / 2 - (bounds.y + bounds.height / 2) * scale,
        );
      }
      if (!liveOverlay) return;
    }
    const { clientWidth: width, clientHeight: height } = scene;
    if (!width || !height) return;
    if (app.screen.width !== width || app.screen.height !== height)
      app.renderer.resize(width, height);
    if (openingDimmer.visible)
      drawDimmer(openingDimmer, width, height, sceneLayout?.openingDimmerOpacity ?? 0);
    const nextPortrait = compactScene.matches;
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

  function setMode(next: "base" | "bonus", opening = false) {
    if (next === mode) return;
    if (next === "base") {
      chestZoom?.cancel();
      reelExit?.cancel();
    }
    const was = mode;
    mode = next;
    revealingChests = false;
    chestAlpha.clear();
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
    if (opening) {
      background.state.setAnimation(0, "0_base_idle", true);
      background.state.setAnimation(1, "1_zoom_in", false);
    } else if (was || next === "base") {
      background.state.setAnimation(0, `0_${next}_enter`, false);
      background.state.addAnimation(0, `0_${next}_idle`, true, 0);
    } else {
      background.state.setAnimation(0, "0_bonus_idle", true);
    }
    if (opening) {
      reelhouse.state.setAnimation(
        1,
        portrait ? "1_splash_intro_mobile" : "1_splash_intro",
        false,
      );
    } else if (!was && next === "base") {
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
    updateReelhouse(0);
    layout();
  }

  function startScene() {
    if (app.ticker.started) return;
    app.render();
    app.start();
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
    if (liveOverlay) {
      liveOverlay.stop();
      liveOverlay.canvas.remove();
      app.stage.addChild(screens);
      liveOverlay = undefined;
    }
    reelhouse.visible = background.visible = true;
    frozenScene.remove();
    scene.append(app.canvas);
    stage.dataset.spineScene = "true";
    layout();
  }

  async function createTotalWinRenderer() {
    const overlay = new Application();
    try {
      await overlay.init({
        width: 1, height: 1, autoStart: false, backgroundAlpha: 0,
        resolution: Math.min(devicePixelRatio, 1.5), preference: "webgl",
      });
    } catch (error) {
      console.warn("Live Total Win overlay unavailable", error);
      return;
    }
    overlay.ticker.maxFPS = 30;
    overlay.canvas.className = "tavern-spine-canvas";
    overlay.canvas.setAttribute("aria-hidden", "true");
    return overlay;
  }

  function mountOverlay(target: HTMLElement, overlay?: Application) {
    if (host !== scene && host !== target) hideScreen();
    if (overlay) {
      host = target;
      liveOverlay = overlay;
      overlay.stage.addChild(screens);
      target.dataset.spineReady = "true";
      target.append(overlay.canvas);
      observer.observe(target);
      overlay.start();
      return;
    }
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
    celebrateMascot(playbackRate?: number) {
      if (portraitMascot?.visible) playMascotWin(portraitMascot, playbackRate);
    },
    async showOpening() {
      openingDimmer.visible = true;
      setMode("base", true);
      stage.dataset.spineScene = "true";
      app.render();
      // Let the first Spine frame reach the compositor under the opaque loader.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      app.start();
    },
    async enterGame(playbackRate = 1) {
      openingDimmer.visible = false;
      background.state.setAnimation(1, "1_zoom_out", false).timeScale = playbackRate;
      const done = playClip(
        reelhouse,
        1,
        portrait ? "1_game_enter_mobile" : "1_game_enter",
        playbackRate,
      );
      reelhouse.state.addAnimation(1, "1_idle", true, 0);
      updateReelhouse(0);
      updateBackground(0);
      await done;
      baseSymbolY = symbolAnchor?.worldY;
    },
    setOpeningBrightness(brightness: number) {
      const channel = Math.round(brightness * 255);
      background.tint = reelhouse.tint = channel * 0x010101;
    },
    revealOpeningMascot() {
      updateBackground(0);
    },
    sync(feature: FeatureState | null) {
      setMode(feature ? "bonus" : "base");
      syncFeature(feature);
      if (host === scene) stage.dataset.spineScene = "true";
      startScene();
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
      await playClip(reelhouse, 2, "2_base_exit");
      reelhouse.visible = false;
    },
    async revealChests(amount: string) {
      revealingChests = true;
      chestTotal.text = amount;
      chestTotal.visible = true;
      stage.dataset.chestReveal = "true";
      if (sceneLayout?.chestCamera)
        chestZoom = zoomScene(stage, sceneLayout.chestCamera);
      await Promise.all([chestZoom?.finished, playClip(reelhouse, 4, "4_finalwin")]);
    },
    async prepareTotalWin() {
      totalWinRenderer ??= createTotalWinRenderer();
      bonusExited = true;
      chestZoom?.cancel();
      layout();
      background.state.setAnimation(1, "1_zoom_in", false);
      const exit = reelhouse.skeleton.data.findAnimation("2_bonus_exit")!;
      const reelBone = symbolAnchor;
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
      updateReelhouse(0);
      reelhouse.visible = false;
    },
    hasLiveTotalWin() {
      return !!liveOverlay;
    },
    async returnFromTotalWin() {
      setMode("base");
      reelhouse.visible = true;
      const reelEntry = reelhouse.state.getCurrent(2);
      if (!reelEntry) return;
      const followReels = () => {
        if (symbolAnchor && baseSymbolY !== undefined) {
          const y = (symbolAnchor.worldY - baseSymbolY) * reelhouse.scale.y;
          reelHost.style.translate = `0 ${y}px`;
        }
      };
      followReels();
      app.ticker.add(followReels, undefined, -10);
      try {
        await waitForClip(reelEntry);
      } finally {
        app.ticker.remove(followReels);
        reelHost.style.removeProperty("translate");
      }
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
      mountOverlay(target, name === "total_win_start" ? await totalWinRenderer : undefined);
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
        host.dataset.spineClip = name;
        await playClip(screens, 0, name, name === "total_win_end" && liveOverlay ? 1.35 : 1);
        if (!liveOverlay) background.state.setAnimation(1, "1_zoom_out", false);
      }
      hideScreen();
    },
  };
}
