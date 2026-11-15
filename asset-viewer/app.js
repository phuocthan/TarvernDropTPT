const base = "../tavern-assets/";
const objects = ["character", "backgrounds", "reelhouse", "screens", "symbols_low", "symbols_high", "symbols_wild", "symbols_bonus"];
const images = ["td_loader.webp","td_loader_bg.webp","td_card_character.webp","td_ante.webp","td_superante.webp","td_bonus.webp","td_super.webp","bonus_static.webp","wild_static.webp","h1_static.webp","h2_static.webp","h3_static.webp","h4_static.webp","l1_static.webp","l2_static.webp","l3_static.webp","l4_static.webp","l5_static.webp","continue.webp","td_gold.webp","td_red.webp","td_green.webp","paperclip_full_logo.webp","paperclip-C0ObTQLL.webp","poweredby-D9-5QAZx.webp","paperclip-rMFDawAD.gif","hd/td_master.webp","hd/td_master_2.webp","hd/td_master_3.webp","hd/td_master_4.webp","hd/td_master_5.webp"];
const skeleton = document.querySelector("#skeleton");
const animation = document.querySelector("#animation");
const status = document.querySelector("#status");
const container = document.querySelector("#player");
let player;
let generation = 0;
for (const name of objects) skeleton.add(new Option(name, name));
for (const name of images) {
  const link = document.createElement("a");
  link.href = base + "assets/" + name;
  link.target = "_blank";
  link.rel = "noopener";
  const img = document.createElement("img");
  img.src = link.href;
  img.alt = name;
  img.loading = "lazy";
  const caption = document.createElement("span");
  caption.textContent = name;
  link.append(img, caption);
  document.querySelector("#gallery").append(link);
}
function load() {
  const current = ++generation;
  if (player) player.dispose();
  container.replaceChildren();
  animation.replaceChildren();
  animation.disabled = true;
  status.textContent = "Đang tải hoạt ảnh…";
  player = new spine.SpinePlayer(container, {
    binaryUrl: base + "assets/td_" + skeleton.value + ".skel",
    atlasUrl: base + "assets/hd/td_master.atlas",
    backgroundColor: "#352635",
    showControls: true,
    success(loaded) {
      if (current !== generation) return;
      const animations = loaded.skeleton.data.animations;
      for (const item of animations) animation.add(new Option(item.name, item.name));
      animation.disabled = !animations.length;
      if (animations.length) loaded.setAnimation(animations[0].name, true);
      status.textContent = animations.length ? animations.length + " hoạt ảnh" : "Tệp này không có hoạt ảnh.";
    },
    error(loaded, message) {
      if (current === generation) status.textContent = "Không tải được Spine: " + message;
    }
  });
}
skeleton.addEventListener("change", load);
animation.addEventListener("change", () => player.setAnimation(animation.value, true));
load();
