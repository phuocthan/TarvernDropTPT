const assetRoot = new URL("../tavern-assets/", document.baseURI);
const media = document.querySelector("#sound-sprite");
const cueSelect = document.querySelector("#sound-cue");
const playButton = document.querySelector("#sound-play");
const stopButton = document.querySelector("#sound-stop");
const volume = document.querySelector("#sound-volume");
const timing = document.querySelector("#sound-timing");
const status = document.querySelector("#sound-status");
const cues = new Map();
let playback;
let boundaryTimer;

function stop(message = "Stopped.") {
  playback = undefined;
  clearTimeout(boundaryTimer);
  media.pause();
  stopButton.disabled = true;
  status.textContent = message;
}

function checkBoundary() {
  clearTimeout(boundaryTimer);
  if (!playback || media.paused || media.seeking || media.readyState < 2) return;
  const remaining = playback.end - media.currentTime;
  if (remaining <= 0) stop("Finished.");
  else boundaryTimer = setTimeout(checkBoundary, Math.max(12, remaining * 1000));
}

function describeCue() {
  const { start, duration } = cues.get(cueSelect.value);
  timing.textContent = `Duration ${duration.toFixed(2)} s · Offset ${start.toFixed(2)} s`;
}

cueSelect.addEventListener("change", () => {
  stop("Ready to play.");
  describeCue();
});
volume.addEventListener("input", () => { media.volume = Number(volume.value) / 100; });
stopButton.addEventListener("click", () => stop());
for (const event of ["playing", "seeked", "timeupdate"]) media.addEventListener(event, checkBoundary);
media.addEventListener("ended", () => stop("Finished."));
media.addEventListener("error", () => stop("Could not load the sound sprite."));

playButton.addEventListener("click", async () => {
  const cue = cues.get(cueSelect.value);
  if (!cue) return;
  stop("Loading audio…");
  const selection = { end: cue.start + cue.duration };
  playback = selection;
  stopButton.disabled = false;
  try {
    media.currentTime = cue.start;
    await media.play();
    if (playback !== selection) return;
    status.textContent = `Playing ${cueSelect.value}`;
    checkBoundary();
  } catch {
    if (playback === selection) stop("Could not play the sound cue.");
  }
});

try {
  const response = await fetch(new URL("assets/td_sounds.json", assetRoot));
  if (!response.ok) throw Error("Sound manifest unavailable");
  const { src, sprite } = await response.json();
  for (const file of src) {
    const source = document.createElement("source");
    source.src = new URL(file, assetRoot).href;
    source.type = file.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg";
    media.append(source);
  }
  for (const [name, [offset, duration]] of Object.entries(sprite)) {
    if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(duration) || duration <= 0) continue;
    cues.set(name, { start: offset / 1000, duration: duration / 1000 });
    cueSelect.add(new Option(name, name));
  }
  if (!cues.size) throw Error("Sound manifest contains no cues");
  media.volume = Number(volume.value) / 100;
  cueSelect.disabled = playButton.disabled = false;
  document.querySelector("#sound-count").textContent = `${cues.size} cues`;
  describeCue();
  status.textContent = "Ready to play.";
} catch {
  status.textContent = "Could not load sound cues.";
}
