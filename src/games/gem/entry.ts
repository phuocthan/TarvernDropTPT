import "./gem.css";
import { Container, Graphics, Text } from "pixi.js";
import type { GameDefinition } from "../../framework/domain/contracts.ts";
import { mountBasicGame } from "../../framework/presentation/basic-game.ts";
import type { BrandLoader } from "../../framework/presentation/brand-loading.ts";

export async function mount(
  root: HTMLElement,
  game: GameDefinition,
  loader?: BrandLoader,
  navigation?: { href: string; label: string },
) {
  root.classList.add("gem-demo");
  const symbols = new Map(game.symbols.map((symbol) => [symbol.id, symbol]));
  await mountBasicGame(root, game, loader, navigation, {
    motionPicker: true,
    symbolFactory(size) {
      const view = new Container();
      const tile = new Graphics().roundRect(1, 1, size - 2, size - 2, size * 0.13).fill(0x172638);
      const gem = new Graphics();
      const glyph = new Text({ style: { fontSize: size * 0.27, fontWeight: "bold", fill: 0x111a2a } });
      glyph.anchor.set(0.5);
      glyph.position.set(size / 2);
      view.addChild(tile, gem, glyph);
      return {
        view,
        set(id) {
          const symbol = symbols.get(id)!;
          glyph.text = symbol.glyph;
          gem.clear().poly([
            size * 0.50, size * 0.13,
            size * 0.85, size * 0.40,
            size * 0.75, size * 0.72,
            size * 0.50, size * 0.87,
            size * 0.25, size * 0.72,
            size * 0.15, size * 0.40,
          ]).fill(symbol.color);
        },
      };
    },
  });
}
