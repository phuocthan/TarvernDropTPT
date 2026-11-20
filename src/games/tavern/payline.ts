import { Container, Text } from "pixi.js";
import { BitmapAmount } from "../../framework/presentation/bitmap-amount.ts";
import type { Spine } from "@esotericsoftware/spine-pixi-v8";
import type {
  GameDefinition,
  LineWin,
} from "../../framework/domain/contracts.ts";
import { alignReelGrid, reelCellCenter } from "../../framework/presentation/grid.ts";

const originalRows = [
  "00000",
  "11111",
  "22222",
  "33333",
  "44444",
  "01010",
  "12121",
  "23232",
  "34343",
  "10101",
  "21212",
  "32323",
  "43434",
  "01234",
  "43210",
];

export function createTavernPayline(
  stage: Container,
  game: GameDefinition,
  native?: Spine,
  bitmapFont = false,
) {
  const layer = new Container();
  const labels = new Container();
  const makeLabel = (high: boolean) => {
    if (bitmapFont)
      return high ? new BitmapAmount("td_red", 54, 0xff6354) : new BitmapAmount("td_green", 54, 0xadff35);
    return new Text({
      style: {
        fontFamily: "Outfit",
        fontSize: 44,
        fontWeight: "800",
        fill: high ? 0xff6354 : 0xadff35,
        stroke: { color: 0x172315, width: 4, join: "round" },
      },
    });
  };
  const source = game.presentation.animationGrid;
  const origin = source && native?.skeleton.findSlot(source.originSlot)?.bone;
  if (native && source && origin) {
    native.autoUpdate = false;
    native.update(0);
    native.visible = false;
    const aligned = alignReelGrid(game.presentation, {
      x: origin.worldX, y: origin.worldY,
      reelPitch: source.reelPitch, rowPitch: source.rowPitch,
    });
    native.scale.set(aligned.scaleX, aligned.scaleY);
    native.position.set(aligned.x, aligned.y);
    native.afterUpdateWorldTransforms = ({ skeleton }) => {
      for (const slot of skeleton.slots)
        if (!/^(line_holder|payline_)/.test(slot.data.name))
          slot.setAttachment(null);
    };
    layer.addChild(native);
  }
  layer.addChild(labels);
  stage.addChild(layer);

  /** Reference units (reelhouse space: 564 per row) to board pixels. */
  const rowPitch = reelCellCenter({ reel: 0, row: 1 }, game.presentation).y -
    reelCellCenter({ reel: 0, row: 0 }, game.presentation).y;
  const unit = rowPitch / 564;
  const power2Out = (t: number) => 1 - (1 - t) ** 3;
  const power3In = (t: number) => t ** 4;
  const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
  let textPositions: string[] = [];
  let nativeFrame = 0;
  const active = new Set<{ stop: () => void }>();
  const pumpNative = () => {
    if (!native || nativeFrame) return;
    let last = performance.now();
    const frame = (now: number) => {
      native.update((now - last) / 1000);
      last = now;
      const busy = native.state.tracks.some((track) =>
        !!track?.animation && track.animation.duration > 0 && track.trackTime < track.animationEnd);
      if (busy) nativeFrame = requestAnimationFrame(frame);
      else {
        nativeFrame = 0;
        native.visible = false;
      }
    };
    nativeFrame = requestAnimationFrame(frame);
  };

  return {
    /** Start a fresh round of line wins (reference oh.clearPositions on bet start). */
    clear() {
      textPositions = [];
      for (const item of [...active]) item.stop();
      if (native) {
        native.state.clearTracks();
        native.skeleton.setToSetupPose();
        native.visible = false;
        if (nativeFrame) cancelAnimationFrame(nativeFrame);
        nativeFrame = 0;
      }
    },
    /**
     * Reference v13 line win: the payline clip plays at its own speed on its own track (lines
     * overlap), and the amount pops in above its anchor, wobbles and falls out of the board.
     * Not awaited by the caller; the line cadence comes from the symbol stagger.
     */
    show(win: LineWin, rows: number[], amount: string, highAmount: boolean, fast: boolean) {
      const index = originalRows.indexOf(rows.join(""));
      const clip = index >= 0 && origin ? native?.skeleton.data.findAnimation(`payline_${index}`) : null;
      if (native && clip) {
        native.visible = true;
        native.state.setAnimation(1 + index, clip.name, false);
        native.state.addEmptyAnimation(1 + index, 0, 0);
        pumpNative();
      }
      const reel = (win.positions.length - 1) / 2;
      let row = (Math.min(...rows) + Math.max(...rows)) / 2;
      if (textPositions.includes(`${reel}:${row}`)) row += 0.25;
      textPositions.push(`${reel}:${row}`);
      const label = makeLabel(highAmount);
      label.anchor.set(0.5);
      label.text = amount;
      const at = reelCellCenter({ reel, row }, game.presentation);
      const bottom = reelCellCenter({ reel, row: 3200 / 564 }, game.presentation).y;
      label.position.set(at.x, at.y);
      label.alpha = 0;
      labels.addChild(label);
      const s = fast ? 0.5 : 1;
      const rise = 600 * s, fade = 200 * s, wobble = 400 * s, fall = 600 * s, fadeOut = 200 * s;
      const direction = Math.random() > 0.5 ? 1 : -1;
      const riseTo = at.y - 200 * unit;
      const start = performance.now();
      let fallFrom: number | undefined;
      let frame = 0;
      const item = {
        stop: () => {
          cancelAnimationFrame(frame);
          active.delete(item);
          label.destroy();
        },
      };
      active.add(item);
      const tick = (now: number) => {
        const t = now - start;
        if (t < fade) label.position.y = at.y + (riseTo - at.y) * power2Out(Math.min(1, t / rise));
        else {
          // The fall starts when the fade-in completes and overrides the rise.
          fallFrom ??= at.y + (riseTo - at.y) * power2Out(Math.min(1, fade / rise));
          label.position.y = fallFrom + (bottom - fallFrom) * power3In(Math.min(1, (t - fade) / fall));
          const swing = ((t - fade) / wobble) % 2;
          label.rotation = 0.08 * direction * sineInOut(swing <= 1 ? swing : 2 - swing);
        }
        const outAt = fade + fade * 2;
        label.alpha = t < fade ? t / fade : t < outAt ? 1 : Math.max(0, 1 - (t - outAt) / fadeOut);
        if (t >= outAt + fadeOut) item.stop();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
  };
}
