import {
  Assets,
  Container,
  Graphics,
  GraphicsPath,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import type {
  SpineTexture,
  TextureAtlas,
} from "@esotericsoftware/spine-pixi-v8";
import type { GameDefinition, LineWin } from "../../framework/domain/contracts.ts";
import { reelCellCenter } from "../../framework/presentation/board.ts";
import { tavernAsset } from "./art.ts";

export function createTavernPayline(stage: Container, game: GameDefinition) {
  const atlas = Assets.get<TextureAtlas>(tavernAsset("hd/td_master.atlas"));
  const cap = (name: string, size: number) => {
    const region = atlas?.findRegion(name);
    const source = (region?.page.texture as SpineTexture | undefined)?.texture
      .source;
    if (!region || !source) return new Sprite();
    const rotated = region.degrees === 90;
    const sprite = new Sprite(
      new Texture({
        source,
        frame: new Rectangle(
          region.x,
          region.y,
          rotated ? region.height : region.width,
          rotated ? region.width : region.height,
        ),
        rotate: rotated ? 2 : 0,
      }),
    );
    sprite.anchor.set(0.5);
    sprite.width = size;
    sprite.scale.y = sprite.scale.x;
    return sprite;
  };
  const layer = new Container();
  const trace = new Graphics();
  const bottle = cap("payline_bottle", 42);
  const stopper = cap("payline_install bottle", 24);
  const label = new Text({
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize: 44,
      fontWeight: "900",
      fill: 0xadff35,
      stroke: { color: 0x172503, width: 5, join: "round" },
      dropShadow: { color: 0x120d09, blur: 2, distance: 3, alpha: 0.9 },
    },
  });
  label.anchor.set(0.5);
  layer.visible = false;
  layer.addChild(trace, bottle, stopper, label);
  stage.addChild(layer);

  return {
    async play(
      win: LineWin,
      rows: number[],
      amount: string,
      duration: number,
      skipped: () => boolean,
    ) {
      const points = rows.map((row, reel) => reelCellCenter({ reel, row }, game.presentation));
      const first = points[0],
        last = points[points.length - 1];
      const anchor = win.positions[1] ?? win.positions[0];
      const amountAt = reelCellCenter(anchor, game.presentation);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const segments = points.length - 1;
      bottle.position.copyFrom(first);
      stopper.position.copyFrom(last);
      label.text = amount;
      label.position.set(
        amountAt.x,
        amountAt.y + (anchor.row === game.rows - 1 ? -36 : 32) * game.presentation.cellSizePx / 102,
      );
      layer.visible = true;

      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const elapsed = now - start;
          if (skipped() || elapsed >= duration) {
            resolve();
            return;
          }
          const progress = reduced
            ? 1
            : Math.min(1, elapsed / (duration * 0.48));
          const travelled = (1 - (1 - progress) ** 2) * segments;
          const path = new GraphicsPath().moveTo(first.x, first.y);
          for (let index = 0; index < segments && index < travelled; index++) {
            const from = points[index],
              to = points[index + 1];
            const part = Math.min(1, travelled - index);
            path.lineTo(
              from.x + (to.x - from.x) * part,
              from.y + (to.y - from.y) * part,
            );
          }
          trace
            .clear()
            .path(path)
            .stroke({
              color: 0xd9280b,
              width: 14,
              alpha: 0.32,
              cap: "round",
              join: "round",
            })
            .path(path)
            .stroke({ color: 0xef411c, width: 8, cap: "round", join: "round" })
            .path(path)
            .stroke({ color: 0xff9b43, width: 3, cap: "round", join: "round" });
          stopper.visible = progress >= 1;
          label.alpha = reduced ? 1 : Math.min(1, elapsed / (duration * 0.24));
          layer.alpha = reduced
            ? 1
            : Math.min(1, (duration - elapsed) / (duration * 0.18));
          requestAnimationFrame(frame);
        };
        frame(start);
      });
      layer.visible = false;
    },
  };
}
