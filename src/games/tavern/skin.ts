import { Container, Graphics, Text } from "pixi.js";
import type { GameDefinition } from "../../framework/domain/contracts.ts";
const CELL = 102;
function label(value: string, size: number, color: number | string) {
  return new Text({
    text: value,
    style: {
      fontFamily: "Georgia, serif",
      fontSize: size,
      fontWeight: "bold",
      fill: color,
      dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.65 },
    },
  });
}
class TavernSymbol extends Container {
  private currentId = "";
  private plate = new Graphics();
  private icon = new Graphics();
  private title: Text;
  constructor() {
    super();
    this.addChild(this.plate, this.icon);
    this.title = label("", 42, 0xffffff);
    this.title.anchor.set(0.5);
    this.title.position.set(CELL / 2, CELL / 2);
    this.addChild(this.title);
  }
  set(id: string, game: GameDefinition) {
    if (id === this.currentId) return;
    this.currentId = id;
    this.title.y = 51;
    const symbol = game.symbols.find((s) => s.id === id)!;
    const color = parseInt(symbol.color.slice(1), 16);
    this.plate
      .clear()
      .roundRect(2, 2, CELL - 4, CELL - 4, 10)
      .fill({ color: 0x211a17, alpha: 0.88 })
      .stroke({ color: 0x635039, width: 1 });
    this.icon.clear();
    this.title.text = symbol.glyph;
    this.title.style.fill = color;
    this.title.style.fontSize = symbol.kind === "royal" ? 44 : 40;
    if (symbol.kind === "wild" || symbol.kind === "bonus") {
      this.icon
        .circle(51, 49, 34)
        .fill({ color, alpha: 0.17 })
        .stroke({ color, width: 3 });
      this.title.y = 43;
      this.title.style.fontSize = 38;
      const name = symbol.kind === "wild" ? "WILD" : "BONUS";
      this.title.text = symbol.glyph + "\n" + name;
      this.title.style.fontSize = 23;
      this.title.style.align = "center";
    } else if (id === "ale") {
      this.title.text = "";
      this.icon
        .roundRect(30, 28, 39, 49, 5)
        .fill(0xc48c2f)
        .stroke({ color: 0xffda7a, width: 2 })
        .roundRect(69, 38, 13, 25, 4)
        .stroke({ color: 0xcfa45b, width: 6 })
        .roundRect(26, 23, 46, 15, 7)
        .fill(0xf3e0b5);
      for (let n = 0; n < 3; n++)
        this.icon.rect(38 + n * 10, 42, 3, 26).fill(0x805021);
    } else if (id === "barrel") {
      this.title.text = "";
      this.icon
        .roundRect(28, 19, 47, 64, 17)
        .fill(0x9a592b)
        .stroke({ color: 0xe2b06c, width: 2 })
        .rect(26, 34, 51, 7)
        .fill(0x9c9887)
        .rect(26, 62, 51, 7)
        .fill(0x9c9887);
    } else if (id === "coin") {
      this.icon
        .circle(51, 51, 33)
        .fill(0xb98520)
        .stroke({ color: 0xf8da83, width: 4 })
        .circle(51, 51, 25)
        .stroke({ color: 0x674517, width: 2 });
      this.title.style.fill = 0xffe6a1;
    } else this.title.y = 51;
  }
}
export function tavernSymbolFactory(game: GameDefinition) {
  return () => {
    const symbol = new TavernSymbol();
    return { view: symbol, set: (id: string) => symbol.set(id, game) };
  };
}
