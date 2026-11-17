const base = "../tavern-assets/";
const objects = ["character", "backgrounds", "reelhouse", "screens", "symbols_low", "symbols_high", "symbols_wild", "symbols_bonus"];
const scenePreviews = { reelhouse: "1_idle", screens: "bonus_intro" };
const fullscreenEffects = new Set(["fade", "fx_light"]);
const images = ["td_loader.webp","td_loader_bg.webp","td_card_character.webp","td_ante.webp","td_superante.webp","td_bonus.webp","td_super.webp","bonus_static.webp","wild_static.webp","h1_static.webp","h2_static.webp","h3_static.webp","h4_static.webp","l1_static.webp","l2_static.webp","l3_static.webp","l4_static.webp","l5_static.webp","continue.webp","td_gold.webp","td_red.webp","td_green.webp","paperclip_full_logo.webp","paperclip-C0ObTQLL.webp","poweredby-D9-5QAZx.webp","paperclip-rMFDawAD.gif","hd/td_master.webp","hd/td_master_2.webp","hd/td_master_3.webp","hd/td_master_4.webp","hd/td_master_5.webp"];
const skeleton = document.querySelector("#skeleton");
const animation = document.querySelector("#animation");
const replay = document.querySelector("#replay");
const status = document.querySelector("#status");
const container = document.querySelector("#player");
let player;
let generation = 0;
for (const name of objects) skeleton.add(new Option(name, name));
const hud = ["menu", "close", "bet-up", "bet-down", "spin", "stop", "autoplay", "autoplay-ready", "turbo", "skip", "feature-buy", "info", "share", "effects", "effects-muted", "music", "music-muted"];
for (const name of [...images.map((name) => "assets/" + name), "assets/sd/td_master.webp", ...hud.map((name) => "hud/" + name + ".svg")]) {
  const link = document.createElement("a");
  link.href = base + name;
  link.target = "_blank";
  link.rel = "noopener";
  const img = document.createElement("img");
  img.src = link.href;
  img.alt = name.replace(/^assets\//, "");
  img.loading = "lazy";
  const caption = document.createElement("span");
  caption.textContent = img.alt;
  link.append(img, caption);
  document.querySelector("#gallery").append(link);
}
function sceneViewport(data, clip) {
  const preview = new spine.Skeleton(data);
  const offset = new spine.Vector2();
  const size = new spine.Vector2();
  let left = Infinity;
  let bottom = Infinity;
  let right = -Infinity;
  let top = -Infinity;
  for (let frame = 0; frame <= 30; frame++) {
    const time = (clip.duration * frame) / 30;
    preview.setToSetupPose();
    clip.apply(
      preview, time, time, false, null, 1, spine.MixBlend.setup, spine.MixDirection.mixIn,
    );
    preview.updateWorldTransform(spine.Physics.pose);
    for (const slot of preview.drawOrder) {
      // Screen-wide effects still render in the player and stay out of the camera bounds.
      if (fullscreenEffects.has(slot.data.name) || slot.color.a <= 0.01)
        slot.setAttachment(null);
    }
    preview.getBounds(offset, size);
    if (size.x <= 0 || size.y <= 0 || !Number.isFinite(size.x + size.y))
      continue;
    left = Math.min(left, offset.x);
    bottom = Math.min(bottom, offset.y);
    right = Math.max(right, offset.x + size.x);
    top = Math.max(top, offset.y + size.y);
  }
  return right > left && top > bottom
    ? { x: left, y: bottom, width: right - left, height: top - bottom }
    : null;
}

function playClip(loaded) {
  const clip = loaded.skeleton.data.findAnimation(animation.value);
  if (!clip) return;
  if (scenePreviews[skeleton.value]) {
    const viewports = loaded.config.viewport.animations;
    const bounds = viewports[clip.name] ??= sceneViewport(loaded.skeleton.data, clip);
    if (bounds) Object.assign(loaded.config.viewport, bounds);
  }
  loaded.animationState.clearTracks();
  loaded.skeleton.setToSetupPose();
  loaded.playTime = 0;
  loaded.config.animation = clip.name;
  loaded.setAnimation(clip.name, clip.duration > 0);
  loaded.playButton.classList.toggle("spine-player-hidden", clip.duration === 0);
  if (clip.duration > 0) {
    loaded.play();
    status.textContent = `${animation.options.length} animations · ${clip.duration.toFixed(2)} s`;
  } else {
    loaded.animationState.apply(loaded.skeleton);
    loaded.skeleton.updateWorldTransform(spine.Physics.pose);
    loaded.timelineSlider.setValue(0);
    loaded.pause();
    status.textContent = `${animation.options.length} animations · Static pose (0 s)`;
  }
}

function load() {
  const current = ++generation;
  if (player) player.dispose();
  container.replaceChildren();
  animation.replaceChildren();
  animation.disabled = replay.disabled = true;
  status.textContent = "Loading animations…";
  player = new spine.SpinePlayer(container, {
    binaryUrl: base + "assets/td_" + skeleton.value + ".skel",
    atlasUrl: base + "assets/hd/td_master.atlas",
    backgroundColor: "#352635",
    premultipliedAlpha: false,
    showControls: true,
    viewport: { transitionTime: 0 },
    success(loaded) {
      if (current !== generation) return;
      const animations = loaded.skeleton.data.animations;
      for (const item of animations) animation.add(new Option(item.name, item.name));
      animation.disabled = replay.disabled = !animations.length;
      loaded.animationButton.classList.add("spine-player-hidden");
      if (animations.length) {
        animation.value = scenePreviews[skeleton.value] ?? animations[0].name;
        playClip(loaded);
      } else {
        status.textContent = "This skeleton has no animations.";
      }
    },
    error(loaded, message) {
      if (current === generation) status.textContent = "Could not load Spine: " + message;
    }
  });
}
skeleton.addEventListener("change", load);
animation.addEventListener("change", () => playClip(player));
replay.addEventListener("click", () => playClip(player));
load();
