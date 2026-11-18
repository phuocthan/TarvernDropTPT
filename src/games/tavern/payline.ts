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
  const label = bitmapFont
    ? new BitmapAmount("td_green", 54, 0xadff35)
    : new Text({
        style: {
          fontFamily: "Outfit",
          fontSize: 44,
          fontWeight: "800",
          fill: 0xadff35,
          stroke: { color: 0x172315, width: 4, join: "round" },
        },
      });
  label.anchor.set(0.5);
  const highLabel = bitmapFont
    ? new BitmapAmount("td_red", 54, 0xff6354)
    : null;
  highLabel?.anchor.set(0.5);
  layer.visible = false;
  const source = game.presentation.animationGrid;
  const origin = source && native?.skeleton.findSlot(source.originSlot)?.bone;
  if (native && source && origin) {
    native.autoUpdate = false;
    native.update(0);
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
  layer.addChild(label);
  if (highLabel) layer.addChild(highLabel);
  stage.addChild(layer);

  return {
    async play(
      win: LineWin,
      rows: number[],
      amount: string,
      highAmount: boolean,
      duration: number,
      skipped: () => boolean,
    ) {
      const index = originalRows.indexOf(rows.join(""));
      const clip =
        index >= 0 && origin
          ? native?.skeleton.data.findAnimation(`payline_${index}`)
          : null;
      if (native) {
        native.visible = !!clip;
        if (clip) {
          native.state.clearTracks();
          native.skeleton.setToSetupPose();
          native.state.setAnimation(0, clip.name, false);
          native.update(0);
        }
      }
      const amountLabel = highAmount && highLabel ? highLabel : label;
      label.visible = amountLabel === label;
      if (highLabel) highLabel.visible = amountLabel === highLabel;
      const anchor = {
        reel: (win.positions.length - 1) / 2,
        row: (Math.min(...rows) + Math.max(...rows)) / 2,
      };
      const amountAt = reelCellCenter(anchor, game.presentation);
      amountLabel.text = amount;
      amountLabel.position.set(amountAt.x, amountAt.y);
      layer.visible = true;

      const clipSeconds = clip?.duration ?? 0;
      let trackTime = 0;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const elapsed = now - start;
          if (skipped() || elapsed >= duration) {
            resolve();
            return;
          }
          if (native && clip) {
            const time = (elapsed / duration) * clipSeconds;
            native.update(time - trackTime);
            trackTime = time;
          }
          requestAnimationFrame(frame);
        };
        frame(start);
      });
      layer.visible = false;
    },
  };
}
