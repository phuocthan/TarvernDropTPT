import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** Capture Chromium frames outside Playwright's video teardown, using system FFmpeg. */
export async function beginReviewCapture(page: Page, destination: string, frameDir: string) {
  const recording = await page.context().newCDPSession(page);
  const frames: { data: string; timestamp: number }[] = [];
  recording.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, timestamp: metadata.timestamp ?? Date.now() / 1000 });
    void recording.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await recording.send("Page.startScreencast", {
    format: "jpeg", quality: 72, maxWidth: 1280, maxHeight: 844, everyNthFrame: 2,
  });
  return async () => {
    await recording.send("Page.stopScreencast");
    await recording.detach();
    if (!frames.length) throw Error("Capture contained no Chromium frames.");
    await mkdir(frameDir, { recursive: true });
    const files: string[] = [];
    for (const [index, frame] of frames.entries()) {
      const name = `frame-${String(index).padStart(6, "0")}.jpg`;
      await writeFile(join(frameDir, name), frame.data, "base64");
      const next = frames[index + 1];
      const duration = next ? Math.max(1 / 30, Math.min(0.7, next.timestamp - frame.timestamp)) : 0.8;
      files.push(`file '${name}'`, `duration ${duration}`);
    }
    files.push(`file 'frame-${String(frames.length - 1).padStart(6, "0")}.jpg'`);
    await writeFile(join(frameDir, "frames.txt"), files.join("\n") + "\n");
    const encoder = spawn(process.env.M2_FFMPEG ?? "ffmpeg", [
      "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "frames.txt",
      "-vf", "fps=24,pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", destination,
    ], { cwd: frameDir, windowsHide: true, stdio: "inherit" });
    await new Promise<void>((resolve, reject) => {
      encoder.once("error", reject);
      encoder.once("exit", (code) => code === 0 ? resolve() : reject(Error(`FFmpeg exited with ${code}`)));
    });
  };
}
