import { Application, BitmapText, Container, Graphics, Text } from "pixi.js";
import {
  RegionAttachment,
  AttachmentTimeline,
  EventTimeline,
  Spine,
  TextureAtlasRegion,
  type Skeleton,
  type Slot,
  type TrackEntry,
} from "@esotericsoftware/spine-pixi-v8";
import type { FeatureState, ReelPresentation, SymbolLandingEffects } from "../../framework/domain/contracts.ts";
import type { SceneAnchor } from "../../framework/presentation/scene.ts";
import type { LayoutModeWatcher } from "../../framework/presentation/layout-mode.ts";
import { createShockwave, defaultShockwave } from "../../framework/presentation/shockwave.ts";
import { hasTavernBitmapFont } from "./typography.ts";
import { createMascot, loadMascot, playMascotWin } from "./mascot.ts";
import { animationBounds } from "./spine-bounds.ts";
import { slotContentScale } from "../../framework/presentation/slot-content-fit.ts";
import { BitmapAmount } from "../../framework/presentation/bitmap-amount.ts";
import type { ResourceManager } from "../../framework/resources/resource-manager.ts";
import { atlasCrop } from "./art.ts";

const cameraEffects = new Set(["fade", "fx_light"]);
const introArtSlots = new Set(["bonus_title", "bonus_img", "bonus_desc", "fs"]);

export function createReelhouse(app: Application, autoUpdate: boolean, resources: ResourceManager) {
  return Spine.from({
    skeleton: resources.url("scene.reelhouse"),
    atlas: resources.url("atlas"),
    ticker: app.ticker,
    autoUpdate,
  });
}

export async function loadReelhouse(resources: ResourceManager) {
  await resources.loadBundle("scene");
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

/** GSAP power2.out, used by the reference chest camera. */
const POWER2_OUT = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/** Alpha of the black rectangle that reference v13 adds to the screens `fade` slot. */
const SCREEN_DIM_RECT_ALPHA = 0.75;

export async function mountTavernEffects(
  stage: HTMLElement,
  frame: HTMLElement,
  reelHost: HTMLElement,
  foreground: HTMLElement,
  sceneLayout: ReelPresentation["scene"],
  placeMascot: (anchor?: SceneAnchor | null) => void,
  resources: ResourceManager,
  boardApp: Application,
  layoutMode?: LayoutModeWatcher,
  onMascotEvent?: (name: string) => void,
  /** Reference reelhouseEvent (key_spawn, chest_spawn) and chestActivate sound hooks. */
  onSceneEvent?: (type: "reelhouse" | "chestActivate", name?: string) => void,
) {
  const atlas = resources.url("atlas");
  const backgroundUrl = resources.url("scene.background");
  const screensUrl = resources.url("scene.screens");
  const slots = sceneLayout?.slots ?? {};
  const camera = sceneLayout?.backgroundCamera;
  const [, mascotLoaded] = await Promise.all([
    resources.loadBundle("scene"),
    loadMascot(resources).then(() => true, () => false),
  ]);
  const app = new Application();
  await app.init({
    width: stage.clientWidth,
    height: stage.clientHeight,
    autoStart: false,
    backgroundAlpha: 0,
    antialias: false,
    // Reference v13 renders every Pixi canvas at min(2, devicePixelRatio). A lower cap made
    // the scene visibly soft on phones (dpr 2-3) after the browser upscaled it.
    resolution: Math.min(devicePixelRatio, 2),
    preference: "webgl",
  });
  app.ticker.maxFPS = 60;
  app.ticker.minFPS = 0;

  const background = Spine.from({
    skeleton: backgroundUrl,
    atlas,
    ticker: app.ticker,
    autoUpdate: false,
  });
  const reelhouse = createReelhouse(app, false, resources);
  reelhouse.state.addListener({ event: (_entry, event) => onSceneEvent?.("reelhouse", event.data.name) });
  const symbolAnchor = reelhouse.skeleton.findSlot("slot_symbols")?.bone
    ?? reelhouse.skeleton.findBone("slot_symbols");
  // The HTML reel canvas is outside Spine. Mirror the authored slot_symbols fade
  // so symbols leave and return together with the reel frame.
  const symbolSlot = reelhouse.skeleton.findSlot("slot_symbols");
  const followSymbolAlpha = () => {
    if (symbolSlot) reelHost.style.opacity = String(symbolSlot.color.a);
  };
  reelhouse.update(0);
  const baseSymbolY = symbolAnchor?.worldY;
  const chestSlots = reelhouse.skeleton.slots.filter((slot) =>
    slot.data.name.startsWith("reel_chest_"),
  );
  const chestAlpha = new Map<Slot, number>();
  const chestSlotIndexes = new Set(chestSlots.map(({ data }) => data.index));
  const chestActiveFx = new Map<number, number[]>();
  const projectedChestSlots = new Set(chestSlotIndexes);
  const chestActivations = new Map<number, Promise<void>>();
  const chestPrefix = (reel: number) => `${30 + reel * 2}_reel_${reel}_chest_`;
  for (let reel = 0; reel < 5; reel++) {
    const clip = reelhouse.skeleton.data.findAnimation(chestPrefix(reel) + "activate");
    if (!clip) continue;
    // Native activation also targets rays, rings and sparks outside reel_chest_*.
    chestActiveFx.set(reel, clip.timelines.flatMap((timeline) =>
      timeline instanceof AttachmentTimeline && !chestSlotIndexes.has(timeline.slotIndex)
        ? [timeline.slotIndex] : []));
  }
  let foregroundChests: Spine | undefined;
  const chestTotal = new BitmapAmount("td_gold", 240);
  chestTotal.anchor.set(0.5);
  chestTotal.visible = false;
  const chestTotalSlot = new Container();
  chestTotalSlot.addChild(chestTotal);
  const pulseDurationMs = 260;
  let amountPulseStarted = -Infinity;
  function pulseStrength() {
    const progress = (performance.now() - amountPulseStarted) / pulseDurationMs;
    return progress >= 0 && progress < 1 ? Math.sin(Math.PI * progress) ** 2 : 0;
  }
  const chestMultipliers = Array.from({ length: 5 }, (_, reel) => {
    const text = new BitmapText({ style: { fontFamily: "td_gold", fontSize: 260 } });
    text.anchor.set(0.5);
    text.visible = false;
    return text;
  });
  // The reference attaches the symbol container to reelhouse slot_symbols, so every slot drawn
  // after it (fade, winbar, final win, chests, multipliers) covers the symbols. Here the symbols
  // have their own canvas: those slots, and the texts in them, are projected into a layer above.
  foregroundChests = createForegroundChests();
  foregroundChests.addSlotObject("slot_finalwin", chestTotalSlot, { followSlotColor: true });
  chestMultipliers.forEach((text, reel) =>
    foregroundChests!.addSlotObject(`slot_reel_mult_${reel}`, text, { followSlotColor: true }));
  // Paylines have their own renderer; fade dims the symbol layers instead of covering the canvas.
  // The board canvas only spans the reel frame. The logo (`title`) sits above the frame and never
  // overlaps symbols, so it stays in the scene canvas instead of being clipped at the board edge.
  const notProjected = /^(payline_|line_holder|fade$|title$)/;
  const fadeSlot = reelhouse.skeleton.findSlot("fade");
  // Reference v13 adds a black 0.75-alpha rectangle to the reelhouse `fade` slot, shown with the
  // slot alpha while the authored (slot-tinted) attachment is present. Together they are the only
  // scene dim of the landing, game entry and chest finale. It sits above the frame, symbols and
  // portrait mascot and below the logo and chests. (Its BlurFilter only softened edges that lie
  // outside the viewport, so the rectangle is simply made large enough to cover any viewport.)
  const reelFadeRect = new Graphics().rect(-50000, -50000, 100000, 100000).fill({ color: 0x000000, alpha: SCREEN_DIM_RECT_ALPHA });
  reelhouse.addSlotObject("fade", reelFadeRect, { followAttachmentTimeline: true });
  /** Combined darkness of the reelhouse fade attachment and rectangle (0 = none). */
  function reelFadeDim() {
    if (!fadeSlot?.getAttachment()) return 0;
    const alpha = fadeSlot.color.a;
    return 1 - (1 - alpha) * (1 - SCREEN_DIM_RECT_ALPHA * alpha);
  }
  /** DOM layers that sit under the reference fade (landscape mascot, table) follow the same dim. */
  let domFadeDim = -1;
  function dimDomLayers(amount: number) {
    const rounded = Math.round(amount * 1000) / 1000;
    if (rounded === domFadeDim) return;
    domFadeDim = rounded;
    stage.toggleAttribute("data-reel-fade", rounded > 0);
    if (rounded > 0) stage.style.setProperty("--reel-fade-brightness", String(1 - rounded));
    else stage.style.removeProperty("--reel-fade-brightness");
  }
  let symbolDim = -1;
  function dimSymbols(amount: number) {
    if (amount === symbolDim) return;
    symbolDim = amount;
    const channel = Math.round(255 * (1 - amount));
    const tint = (channel << 16) | (channel << 8) | channel;
    for (const child of boardApp.stage.children) if (child !== foregroundChests) child.tint = tint;
  }
  let chestZoom: Animation | undefined;
  /** Ease the chest camera back to the full scene, as the reference does after the last chest. */
  function releaseChestZoom() {
    if (!chestZoom) return;
    const { scale, translate, transformOrigin } = getComputedStyle(stage);
    chestZoom.cancel();
    const durationMs = sceneLayout?.chestCamera?.durationMs ?? 500;
    chestZoom = scale === "none" || scale === "1" ? undefined : stage.animate([
      { scale, translate, transformOrigin },
      { scale: "1", translate: "0 0", transformOrigin },
    ], { duration: durationMs, easing: POWER2_OUT });
  }
  let reelExit: Animation | undefined;
  const tables = [
    [background.skeleton.findSlot(slots.baseTable ?? ""), foreground.querySelector<HTMLElement>(".base-art")],
    [background.skeleton.findSlot(slots.bonusTable ?? ""), foreground.querySelector<HTMLElement>(".bonus-art")],
  ] as const;
  const foregroundAlpha = new Map<Slot, number>();
  const tableRegions = new Map<HTMLElement, TextureAtlasRegion>();
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
      const region = attachment instanceof RegionAttachment ? attachment.region : null;
      if (!(attachment instanceof RegionAttachment) || !(region instanceof TextureAtlasRegion) || region.degrees !== 0) {
        table.style.opacity = "0";
        continue;
      }
      if (tableRegions.get(table) !== region) {
        const { page, x, y, width, height } = region;
        const { size, position } = atlasCrop([page.width, page.height], [x, y, width, height]);
        const textureUrl = new URL(page.name, new URL(atlas, document.baseURI));
        table.style.setProperty("--art-image", `url("${textureUrl.href}")`);
        table.style.setProperty("--art-size", size);
        table.style.setProperty("--art-position", position);
        table.dataset.spineTable = "";
        tableRegions.set(table, region);
      }
      table.style.opacity = String(slot.color.a);
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
      foregroundAlpha.set(slot, slot.color.a);
      slot.color.a = 0;
    }
  };
  // Dark layer behind Spine screens, matching the reference `fade` slot (see screens below).
  let dimContainer: HTMLElement | null = null;
  function publishScreenDim(amount: number, target: HTMLElement = host) {
    const container = target === scene ? null : target.closest<HTMLElement>("dialog, .win-celebration");
    if (container !== dimContainer) clearScreenDim();
    if (!container) return;
    dimContainer = container;
    container.dataset.spineDim = "true";
    container.style.setProperty("--spine-screen-dim", Math.max(0, Math.min(1, amount)).toFixed(3));
  }
  function clearScreenDim() {
    const container = dimContainer;
    if (!container) return;
    dimContainer = null;
    const release = () => {
      if (container === dimContainer) return;
      delete container.dataset.spineDim;
      container.style.removeProperty("--spine-screen-dim");
    };
    // The screen's own fade has already cleared the dim. A dialog can stay open after it (Total
    // Win waits for the payout count and reel entry), so keep its backdrop clear until it closes;
    // otherwise the generic dialog backdrop (dark + blur) would flash in for those frames.
    if (container instanceof HTMLDialogElement && container.open) {
      container.style.setProperty("--spine-screen-dim", "0");
      container.addEventListener("close", release, { once: true });
    } else release();
  }
  const screens = Spine.from({
    skeleton: screensUrl,
    atlas,
    ticker: app.ticker,
    autoUpdate: false,
  });
  const payout = new BitmapAmount("td_gold", 480);
  payout.anchor.set(0.5);
  // Spine owns the slot container's transform. Keep responsive amount scaling on its child.
  const payoutSlot = new Container();
  payoutSlot.addChild(payout);
  screens.addSlotObject("slot_win", payoutSlot, { followSlotColor: true });
  // Win tiers are announced by authored Spine events (big, super, mega, epic, max).
  const screenEventListeners = new Set<(name: string) => void>();
  screens.state.addListener({
    event: (_entry, event) => {
      for (const listener of screenEventListeners) listener(event.data.name);
    },
  });
  const shockwave = createShockwave(sceneLayout?.shockwave ?? defaultShockwave);
  // Set when the Total Win outro has already started the base background.
  let backgroundBaseEntered = false;
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
    // Slot objects are absent from Skeleton.getBounds(). Fit the actual amount separately,
    // on every authored pose and counter update, including long KRW values.
    const amountScreen = host.closest(".win-celebration") || host.classList.contains("total-win-screen");
    if (payout.text && host !== scene && amountScreen && host.dataset.spineClip !== "addfs") {
      const bone = skeleton.findSlot("slot_win")!.bone;
      const content = payout.getLocalBounds();
      const baseScale = Math.min(1, 3000 / (content.width || 1));
      const desiredScale = baseScale * (1 + 0.10 * pulseStrength());
      const fit = slotContentScale(
        { width: content.width * desiredScale, height: content.height * desiredScale },
        bone,
        { x: screens.x, y: screens.y, scaleX: screens.scale.x, scaleY: screens.scale.y },
        { width: host.clientWidth, height: host.clientHeight },
        sceneLayout?.winScreen?.paddingPx ?? 16,
      );
      payout.scale.set(desiredScale * fit);
    }
    // Reference v13 dims everything under a screen through the authored `fade` slot: its black
    // attachment plus a black 0.75-alpha rectangle added as a slot object, both scaled by the
    // slot alpha (BlurFilter on that solid rectangle only softens its off-screen edges, so it
    // never blurs the scene). This canvas covers the art box only, so the same darkness is
    // published to the full-viewport container behind it instead of being drawn here.
    // The authored attachment is always present in the reference (only `fade` is ever keyed),
    // so its alpha comes from the skin while the canvas copy is removed.
    const fadeSlot = skeleton.findSlot("fade");
    if (fadeSlot) {
      const fadeAlpha = fadeSlot.color.a;
      const fadeArt = skeleton.data.defaultSkin?.getAttachment(fadeSlot.data.index, "fade");
      const authored = fadeArt instanceof RegionAttachment ? fadeArt.color.a : 0;
      publishScreenDim(1 - (1 - authored * fadeAlpha) * (1 - SCREEN_DIM_RECT_ALPHA * fadeAlpha));
      fadeSlot.setAttachment(null);
    }
    // Only the exact count of ten can use the authored text sprite.
    if (spinCount.text) skeleton.findSlot("fs")?.setAttachment(null);
  };
  screens.visible = false;
  app.stage.addChild(background, reelhouse, screens);
  const portraitMascot = mascotLoaded ? createMascot(app, resources, (name) => {
    // Only the visible mascot is updated, so its events never double the landscape one.
    if (portraitMascot?.visible) onMascotEvent?.(name);
  }) : undefined;
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
  let screenOverlayRenderer: Promise<Application | undefined> | undefined;
  let liveOverlay: Application | undefined;
  let mode: "base" | "bonus" | undefined;
  let previousFeature: FeatureState | null = null;
  // The portrait Spine poses (0_mobile, 4_mobile, mobile mascot) follow the shared layout mode,
  // exactly as the reference does; without one, fall back to a narrow-aspect check.
  const compactScene = matchMedia("(max-aspect-ratio: 4/5)");
  const isPortrait = () => layoutMode ? layoutMode.mode === "portrait" : compactScene.matches;
  let portrait = isPortrait();
  let baseExited = false;
  let bonusExited = false;
  let revealingChests = false;
  let openingEntry: TrackEntry | undefined;
  let bounds = screenBounds(screens.skeleton.data, []);
  const viewports = new Map<string, typeof bounds>();

  function layoutForegroundChests() {
    const boardRenderer = boardApp.renderer;
    if (!foregroundChests || !boardRenderer) return;
    const stageRect = scene.getBoundingClientRect();
    const boardRect = boardRenderer.canvas.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height || !stageRect.width || !stageRect.height) return;
    const boardScaleX = boardApp.screen.width / boardRect.width;
    const boardScaleY = boardApp.screen.height / boardRect.height;
    const stageScaleX = stageRect.width / app.screen.width;
    const stageScaleY = stageRect.height / app.screen.height;
    foregroundChests.position.set(
      (stageRect.left - boardRect.left + reelhouse.x * stageScaleX) * boardScaleX - boardApp.stage.x,
      (stageRect.top - boardRect.top + reelhouse.y * stageScaleY) * boardScaleY - boardApp.stage.y,
    );
    foregroundChests.scale.set(reelhouse.scale.x * stageScaleX * boardScaleX, reelhouse.scale.y * stageScaleY * boardScaleY);
  }

  function createForegroundChests() {
    const layer = new Spine({ skeletonData: reelhouse.skeleton.data, autoUpdate: false });
    layer.visible = false;
    const source = reelhouse.skeleton;
    layer.afterUpdateWorldTransforms = ({ skeleton }) => {
      // Project the authored slots into the reel renderer using the scene's current
      // pose and draw order. The scene alone advances tracks and emits events.
      for (const bone of source.bones) {
        const target = skeleton.bones[bone.data.index];
        target.a = bone.a;
        target.b = bone.b;
        target.c = bone.c;
        target.d = bone.d;
        target.worldX = bone.worldX;
        target.worldY = bone.worldY;
      }
      skeleton.drawOrder.length = 0;
      for (const slot of source.drawOrder) {
        if (!projectedChestSlots.has(slot.data.index)) continue;
        const target = skeleton.slots[slot.data.index];
        target.setAttachment(slot.getAttachment());
        target.color.setFromColor(slot.color);
        if (target.darkColor && slot.darkColor) target.darkColor.setFromColor(slot.darkColor);
        target.sequenceIndex = slot.sequenceIndex;
        target.deform.length = slot.deform.length;
        for (let i = 0; i < slot.deform.length; i++) target.deform[i] = slot.deform[i];
        skeleton.drawOrder.push(target);
      }
    };
    boardApp.stage.addChild(layer);
    return layer;
  }

  function updateReelhouse(time: number) {
    for (const [slot, alpha] of chestAlpha) slot.color.a = alpha;
    chestAlpha.clear();
    reelhouse.update(time);
    const foreground = mode === "bonus" && !stage.hasAttribute("data-bonus-entry") && !bonusExited;
    stage.toggleAttribute("data-foreground-chests", foreground);
    // Symbols live on the board canvas above this scene, so they take the fade as a tint.
    const fadeDim = reelFadeDim();
    dimDomLayers(fadeDim);
    if (!foreground) {
      if (foregroundChests) foregroundChests.visible = false;
      dimSymbols(fadeDim);
      return;
    }
    foregroundChests ??= createForegroundChests();
    // Effects can finish loading before BoardView mounts its symbol containers.
    // Keep the projected authored foreground above those later-added layers.
    if (boardApp.stage.getChildIndex(foregroundChests) !== boardApp.stage.children.length - 1)
      boardApp.stage.setChildIndex(foregroundChests, boardApp.stage.children.length - 1);
    // The chest camera zooms the stage, so follow the scene every frame.
    layoutForegroundChests();
    foregroundChests.visible = true;
    projectedChestSlots.clear();
    // Current draw order: 4_finalwin reorders slots.
    let aboveSymbols = false;
    for (const slot of reelhouse.skeleton.drawOrder) {
      if (slot === symbolSlot) aboveSymbols = true;
      else if (aboveSymbols && !notProjected.test(slot.data.name)) projectedChestSlots.add(slot.data.index);
    }
    dimSymbols(fadeDim);
    foregroundChests.update(0);
    for (const index of projectedChestSlots) {
      const slot = reelhouse.skeleton.slots[index];
      chestAlpha.set(slot, slot.color.a);
      slot.color.a = 0;
    }
  }

  function updateBackground(time: number) {
    for (const [slot, alpha] of foregroundAlpha) slot.color.a = alpha;
    background.update(time);
    const source = portrait ? reelhouse : background;
    const anchorSlot = source.skeleton.findSlot((portrait ? slots.portraitMascot : slots.landscapeMascot) ?? "");
    const anchor = anchorSlot?.bone;
    const inlineMascot = portrait && !!anchor && !!portraitMascot;
    stage.toggleAttribute("data-mascot-behind-board", inlineMascot);
    const shell = stage.parentElement;
    const mascotHidden = !mode || shell?.hasAttribute("data-opening") || shell?.dataset.entering === "before-mascot";
    if (portraitMascot) {
      // The reelhouse fades slot_character with the frame (2_base_exit, 2_bonus_exit and the
      // enter clips), so the inline portrait mascot follows the slot alpha as well as its bone.
      const slotAlpha = inlineMascot ? anchorSlot!.color.a : 0;
      portraitMascot.alpha = slotAlpha;
      portraitMascot.visible = portraitMascot.autoUpdate =
        inlineMascot && !mascotHidden && slotAlpha > 0.001;
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
    if (revealingChests && chestTotal.visible) {
      const strength = pulseStrength();
      chestTotal.scale.set(1 + 0.065 * strength, 1 - 0.095 * strength);
    }
    updateBackground(time);
  }, undefined, -10);

  function layout() {
    if (host !== scene) {
      const { clientWidth: width, clientHeight: height } = host;
      if (width && height) {
        const overlay = liveOverlay ?? app;
        if (overlay.screen.width !== width || overlay.screen.height !== height) {
          overlay.renderer.resize(width, height);
          overlayResized = overlay;
        }
        const mobile = isPortrait();
        const retrigger = host.dataset.spineClip === "addfs";
        const celebration = host.closest(".win-celebration");
        const totalWin = host.classList.contains("total-win-screen");
        const fit = retrigger ? 0.85
          : totalWin && mobile ? 1.4
          : celebration ? (mobile ? sceneLayout?.winScreen?.portraitFit ?? 1.71 : sceneLayout?.winScreen?.landscapeFit ?? 1.55) : 0.94;
        // The renderer fills the viewport; the previous art box still defines visual size.
        const artWidth = celebration && (!mobile || retrigger) ? Math.min(width * 0.96, 1400) : width;
        const artHeight = celebration && (!mobile || retrigger) ? Math.min(height * 0.78, 780) : height;
        const scale = Math.min(artWidth / bounds.width, artHeight / bounds.height) * fit;
        const centerX = width * (mobile && (totalWin || (celebration && !retrigger)) ? 0.48 : 0.5);
        screens.scale.set(scale);
        screens.position.set(
          centerX - (bounds.x + bounds.width / 2) * scale,
          height * (celebration && !retrigger ? sceneLayout?.winScreen?.centerY ?? 0.44 : 0.5) - (bounds.y + bounds.height / 2) * scale,
        );
      }
      // Resizing clears a WebGL canvas. Redraw now: ResizeObserver runs after this frame's
      // ticker render, so waiting for the next tick would paint an empty frame (flicker).
      overlayResized?.render();
      overlayResized = undefined;
      if (!liveOverlay) return;
    }
    const { clientWidth: width, clientHeight: height } = scene;
    if (!width || !height) return;
    let redraw = false;
    if (app.screen.width !== width || app.screen.height !== height) {
      app.renderer.resize(width, height);
      redraw = true;
    }
    const nextPortrait = isPortrait();
    if (nextPortrait !== portrait) {
      portrait = nextPortrait;
      applyOrientation();
      // Apply the orientation pose in this frame instead of on the next tick.
      updateReelhouse(0);
      redraw = true;
    }
    const sceneRect = scene.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    if (portrait) {
      const bottom = camera?.portraitBottom ?? 1940;
      const backgroundScale = Math.max(
        width / (camera?.width ?? 6000),
        height / ((camera?.top ?? 2060) + bottom),
      );
      background.scale.set(backgroundScale);
      background.position.set(
        width / 2 + (camera?.centerOffsetX ?? 80) * backgroundScale,
        height - bottom * backgroundScale,
      );
    } else {
      // Reference v13 (QL + JL): the background covers a 5800x3800 box centred on the
      // viewport, so very wide or short screens crop top and bottom evenly.
      const backgroundScale = width / height > 5800 / 3800 ? width / 5800 : height / 3800;
      background.scale.set(backgroundScale);
      background.position.set(width / 2, height / 2);
    }
    const sceneScale = sceneRect.width / scene.clientWidth || 1;
    const reelScale = frameRect.width / sceneScale / 3976;
    reelhouse.scale.set(reelScale);
    // The source bonus pose lifts the frame by 221 Spine units.
    reelhouse.position.set(
      (frameRect.left - sceneRect.left) / sceneScale + 1991 * reelScale,
      (frameRect.top - sceneRect.top) / sceneScale +
        (mode === "bonus" ? 2001 : 1780) * reelScale,
    );
    layoutForegroundChests();
    updateBackground(0);
    if (redraw && host === scene) app.render();
  }
  let overlayResized: Application | undefined;
  const observer = new ResizeObserver(layout);
  layoutMode?.subscribe(() => layout());
  observer.observe(stage);
  observer.observe(frame);
  layout();

  function applyOrientation() {
    if (portrait) {
      reelhouse.state.setAnimation(0, "0_mobile", false);
      background.state.setAnimation(4, "4_mobile", false);
    } else {
      // Like the reference, mix the mobile pose out so title, character slot and background
      // return to their landscape (setup) pose; clearTrack would leave the mobile pose applied.
      reelhouse.state.setEmptyAnimation(0, 0);
      background.state.setEmptyAnimation(4, 0);
    }
  }

  function setMode(next: "base" | "bonus", opening = false) {
    if (next === mode) return;
    if (next === "base") {
      chestZoom?.cancel();
      reelExit?.cancel();
      reelHost.style.removeProperty("opacity");
    }
    const was = mode;
    let transition: TrackEntry | undefined;
    mode = next;
    revealingChests = false;
    chestAlpha.clear();
    chestActivations.clear();
    chestTotal.scale.set(1);
    chestTotal.text = "";
    chestTotal.visible = false;
    for (const text of chestMultipliers) {
      text.text = "";
      text.visible = false;
    }
    delete stage.dataset.chestReveal;
    previousFeature = null;
    const keepBackground = next === "base" && backgroundBaseEntered;
    backgroundBaseEntered = false;
    if (!keepBackground) background.state.clearTracks();
    reelhouse.state.clearTracks();
    foregroundAlpha.clear();
    if (!keepBackground) background.skeleton.setToSetupPose();
    reelhouse.skeleton.setToSetupPose();
    applyOrientation();
    if (opening) {
      background.state.setAnimation(0, "0_base_idle", true);
      background.state.setAnimation(1, "1_zoom_in", false);
    } else if (keepBackground) {
      // The background entered at the authored Total Win beat; keep its tracks running.
    } else if (was || next === "base") {
      background.state.setAnimation(0, `0_${next}_enter`, false);
      background.state.addAnimation(0, `0_${next}_idle`, true, 0);
    } else {
      background.state.setAnimation(0, "0_bonus_idle", true);
    }
    if (opening) {
      openingEntry = reelhouse.state.setAnimation(
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
        transition = reelhouse.state.setAnimation(2, `2_${next}_enter`, false);
      } else {
        reelhouse.state.setAnimation(2, `2_${was}_exit`, false);
        transition = reelhouse.state.addAnimation(2, `2_${next}_enter`, false, 0);
      }
      if (!keepBackground) background.state.setAnimation(1, "1_zoom_out", false);
      if (next === "base") reelhouse.state.addAnimation(2, "1_idle", true, 0);
    } else {
      const entry = reelhouse.state.setAnimation(2, "2_bonus_enter", false);
      entry.trackTime = entry.animation!.duration;
    }
    baseExited = false;
    bonusExited = false;
    updateReelhouse(0);
    layout();
    return transition;
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
        const prefix = chestPrefix(reel);
        if (previousFeature) {
          const activating = playClip(reelhouse, 30 + reel, prefix + "activate");
          onSceneEvent?.("chestActivate");
          chestActivations.set(reel, activating);
          reelhouse.state.addAnimation(30 + reel, prefix + "idle", true, 0);
          void activating.then(() => {
            if (chestActivations.get(reel) === activating) chestActivations.delete(reel);
          });
        } else {
          reelhouse.state.setAnimation(30 + reel, prefix + "idle", true);
        }
      }
    });
    previousFeature = feature;
  }

  function hideScreen() {
    if (host === scene) return;
    clearScreenDim();
    observer.unobserve(host);
    host.removeAttribute("data-spine-ready");
    host.removeAttribute("data-spine-pending");
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
      return;
    }
    background.visible = true;
    reelhouse.visible = !bonusExited;
    frozenScene.remove();
    scene.append(app.canvas);
    stage.dataset.spineScene = "true";
    layout();
  }

  async function createScreenOverlayRenderer() {
    const overlay = new Application();
    try {
      await overlay.init({
        width: 1, height: 1, autoStart: false, backgroundAlpha: 0,
        resolution: Math.min(devicePixelRatio, 2), preference: "webgl",
      });
    } catch (error) {
      console.warn("Live screen overlay unavailable", error);
      return;
    }
    overlay.ticker.maxFPS = 60;
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
    /** One viewport-centred shockwave across the scene, the live overlay and any extra canvases. */
    shockwave(extra: (Application | undefined)[] = []) {
      return shockwave.play([app, liveOverlay, ...extra]);
    },
    onScreenEvent(listener: (name: string) => void) {
      screenEventListeners.add(listener);
      return () => screenEventListeners.delete(listener);
    },
    winScreenEvents(name: string) {
      const animation = screens.skeleton.data.findAnimation(name);
      return (animation?.timelines ?? [])
        .flatMap((timeline) => timeline instanceof EventTimeline
          ? timeline.events.map((event) => ({ name: event.data.name, time: event.time })) : [])
        .sort((a, b) => a.time - b.time);
    },
    /** Moves the current win screen forward only; Spine fires the events it passes. */
    seekScreen(time: number) {
      const entry = screens.visible ? screens.state.getCurrent(0) : null;
      if (!entry?.animation || time <= entry.trackTime) return;
      entry.trackTime = Math.min(time, entry.animation.duration);
    },
    /**
     * Starts the authored Total Win exit at the click: total_win_end, background zoom-out
     * and a shockwave; the base background and chest text clear follow after backgroundEnterMs.
     * Resolves when total_win_end has finished and the screen is removed.
     */
    startTotalWinOutro(backgroundEnterMs: number, extra: (Application | undefined)[] = []) {
      if (host === scene) return Promise.resolve();
      void shockwave.play([app, liveOverlay, ...extra]);
      background.state.setAnimation(1, "1_zoom_out", false);
      host.dataset.spineClip = "total_win_end";
      const entry = screens.state.setAnimation(0, "total_win_end", false);
      entry.mixDuration = 0.125;
      const leaving = waitForClip(entry);
      if (liveOverlay) {
        setTimeout(() => {
          entry.mixDuration = 0;
          backgroundBaseEntered = true;
          background.state.setAnimation(0, "0_base_enter", false);
          background.state.addAnimation(0, "0_base_idle", true, 0);
          chestTotal.text = "";
          chestTotal.visible = false;
          for (const text of chestMultipliers) {
            text.text = "";
            text.visible = false;
          }
        }, backgroundEnterMs);
      }
      return leaving.then(() => hideScreen());
    },
    celebrateMascot(playbackRate?: number) {
      if (portraitMascot?.visible) playMascotWin(portraitMascot, playbackRate);
    },
    async showOpening() {
      setMode("base", true);
      stage.dataset.spineScene = "true";
      app.render();
      // Let the first Spine frame reach the compositor under the opaque loader.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    startOpening() {
      stage.dataset.openingAnimation = "playing";
      const done = openingEntry?.animation && openingEntry.trackTime < openingEntry.animation.duration
        ? waitForClip(openingEntry) : Promise.resolve();
      app.start();
      return done.then(() => { stage.dataset.openingAnimation = "complete"; });
    },
    async enterGame(playbackRate = 1) {
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
      // Reference v13 attaches the reels to slot_symbols: 1_game_enter keeps them hidden until
      // 0.47 s and fades them in by 0.97 s, under the entry fade.
      followSymbolAlpha();
      app.ticker.add(followSymbolAlpha, undefined, -10);
      try {
        await done;
      } finally {
        app.ticker.remove(followSymbolAlpha);
        reelHost.style.removeProperty("opacity");
      }
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
    waitForChestActivations() {
      return Promise.all(chestActivations.values());
    },
    pulseScreenAmount() {
      amountPulseStarted = performance.now();
    },
    async enterBonus() {
      // The authored entry animates the same chests that the HUD layers above the reels during play.
      stage.setAttribute("data-bonus-entry", "");
      // 2_bonus_enter brings slot_symbols back 0 -> 1.
      app.ticker.add(followSymbolAlpha, undefined, -10);
      try {
        reelhouse.visible = true;
        const entry = setMode("bonus");
        followSymbolAlpha();
        if (entry) await waitForClip(entry);
      } finally {
        app.ticker.remove(followSymbolAlpha);
        reelHost.style.removeProperty("opacity");
        stage.removeAttribute("data-bonus-entry");
        updateReelhouse(0);
        app.render();
      }
    },
    restoreFeature(feature: FeatureState | null) {
      // The initial bonus pose is restored at its end frame; no base exit or game-enter clip.
      mode = undefined;
      setMode("bonus");
      const zoom = background.state.setAnimation(1, "1_zoom_out", false);
      zoom.trackTime = zoom.animation!.duration;
      reelhouse.visible = background.visible = true;
      syncFeature(feature);
      updateBackground(0);
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
      const firstY = symbolAnchor?.worldY;
      const followReels = () => {
        if (symbolAnchor && firstY !== undefined) {
          const y = (symbolAnchor.worldY - firstY) * reelhouse.scale.y;
          reelHost.style.translate = `0 ${y}px`;
        }
        // 2_base_exit fades slot_symbols 1 -> 0; the reference symbols live in that slot.
        followSymbolAlpha();
      };
      app.ticker.add(followReels, undefined, -10);
      try {
        await playClip(reelhouse, 2, "2_base_exit");
        followSymbolAlpha();
        reelhouse.visible = false;
      } finally {
        app.ticker.remove(followReels);
        reelHost.style.removeProperty("translate");
      }
    },
    async revealChests(amount: string) {
      revealingChests = true;
      chestTotal.text = amount;
      chestTotal.visible = true;
      stage.dataset.chestReveal = "true";
      const camera = sceneLayout?.chestCamera;
      if (camera) {
        // Reference v13 (playChestFinalWins): scale the whole scene about the viewport centre
        // (1.4, portrait 1.125) and lift it by a width-dependent offset over 0.5 s, power2.out.
        // The HUD lives outside the stage and stays put, as in the reference.
        const width = stage.clientWidth;
        const lift = !camera.liftPx ? 0 : portrait ? camera.liftPx.portrait
          : camera.liftPx.steps.find(([maxWidth]) => width < maxWidth)?.[1] ?? camera.liftPx.default;
        chestZoom?.cancel();
        chestZoom = stage.animate([
          { scale: "1", translate: "0 0", transformOrigin: `50% ${100 * camera.originY}%` },
          {
            scale: String(portrait ? camera.portraitScale ?? camera.scale : camera.scale),
            translate: `0 ${-lift}px`,
            transformOrigin: `50% ${100 * camera.originY}%`,
          },
        ], { duration: camera.durationMs, easing: POWER2_OUT, fill: "forwards" });
      }
      await Promise.all([chestZoom?.finished, playClip(reelhouse, 4, "4_finalwin")]);
    },
    async prepareTotalWin() {
      screenOverlayRenderer ??= createScreenOverlayRenderer();
      bonusExited = true;
      releaseChestZoom();
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
        followSymbolAlpha();
      };
      app.ticker.add(followReels, undefined, -10);
      if (!reelBone) reelExit = reelHost.animate(
        [{ translate: "0 0" }, { translate: `0 ${distance}px` }],
        { duration, fill: "forwards", easing: "ease-in" },
      );
      await finished;
      app.ticker.remove(followReels);
      reelHost.style.removeProperty("translate");
      // Stay hidden behind Total Win; returnFromTotalWin fades the symbols back in.
      if (symbolSlot) reelHost.style.opacity = "0";
      chestTotal.text = "";
      for (const text of chestMultipliers) text.text = "";
      updateReelhouse(0);
      reelhouse.visible = false;
    },
    hasLiveTotalWin() {
      return !!liveOverlay;
    },
    waitForTotalWinReturn(outro: Promise<void>) {
      const ticker = liveOverlay?.ticker;
      if (!ticker) return outro;
      return new Promise<void>((resolve) => {
        const release = () => {
          ticker.remove(checkBeat);
          resolve();
        };
        // This key in total_win_end is the first pop of the Total Win title.
        const checkBeat = () => {
          if ((screens.state.getCurrent(0)?.getAnimationTime() ?? 0) >= 0.47) release();
        };
        ticker.add(checkBeat, undefined, -10);
        void outro.then(release, release);
      });
    },
    async returnFromTotalWin() {
      const reelEntry = setMode("base");
      reelhouse.visible = true;
      if (!reelEntry) return;
      const followReels = () => {
        if (symbolAnchor && baseSymbolY !== undefined) {
          const y = (symbolAnchor.worldY - baseSymbolY) * reelhouse.scale.y;
          reelHost.style.translate = `0 ${y}px`;
        }
        followSymbolAlpha();
      };
      followReels();
      app.ticker.add(followReels, undefined, -10);
      try {
        await waitForClip(reelEntry);
      } finally {
        app.ticker.remove(followReels);
        reelHost.style.removeProperty("translate");
        reelHost.style.removeProperty("opacity");
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
      amountPulseStarted = -Infinity;
      // Start from the clip's own (clear) fade before the overlay renderer is ready.
      publishScreenDim(0, target);
      const intro = name === "bonus_intro" || name === "super_intro";
      const keepSceneLive = intro || name === "total_win_start" ||
        (revealingChests && name !== "addfs" && !!target.closest(".win-celebration"));
      if (keepSceneLive) screenOverlayRenderer ??= createScreenOverlayRenderer();
      mountOverlay(target, keepSceneLive ? await screenOverlayRenderer : undefined);
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
      return screens.visible ? screens.state.getCurrent(0)?.trackTime ?? 0 : 0;
    },
    restoreChest(reel: number, multiplier: number) {
      chestMultipliers[reel].text = `x${multiplier}`;
      chestMultipliers[reel].visible = true;
      reelhouse.state.setAnimation(50 + reel, chestPrefix(reel) + "open_idle", true);
    },
    async openChest(reel: number, multiplier: number) {
      stage.dataset.chestOpening = String(reel);
      const text = chestMultipliers[reel];
      text.text = `x${multiplier}`;
      text.visible = true;
      const prefix = chestPrefix(reel);
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
        await playClip(screens, 0, name);
        if (!liveOverlay) background.state.setAnimation(1, "1_zoom_out", false);
      }
      hideScreen();
    },
  };
}
