import { BitmapText, Container, Point, Text } from "pixi.js";

/** Keep authored bitmap digits; supply currency glyphs missing from their atlas. */
export class BitmapAmount extends Container {
  readonly anchor = new Point();
  private digits: BitmapText;
  private currency: Text;
  private value = "";
  constructor(fontFamily: string, fontSize: number, color = 0xffdb57) {
    super();
    this.digits = new BitmapText({ style: { fontFamily, fontSize } });
    this.currency = new Text({ style: {
      fontFamily: "Arial, sans-serif", fontSize: fontSize * 0.7, fontWeight: "900", fill: color,
      stroke: { color: 0x24140d, width: Math.max(2, fontSize * 0.025), join: "round" },
    } });
    this.digits.anchor.set(0, 0.5);
    this.currency.anchor.set(0, 0.5);
    this.addChild(this.currency, this.digits);
  }
  get text() { return this.value; }
  set text(value: string) {
    if (value === this.value) return;
    this.value = value;
    const [, currency = "", digits = ""] = /^([^\d+-]*)(.*)$/.exec(value) ?? [];
    this.currency.text = currency;
    this.currency.visible = !!currency;
    this.digits.text = digits;
    const prefixWidth = currency ? this.currency.width + this.currency.style.fontSize * 0.08 : 0;
    const width = prefixWidth + this.digits.width;
    const y = (0.5 - this.anchor.y) * Math.max(this.digits.height, this.currency.height);
    this.currency.position.set(-width * this.anchor.x, y);
    this.digits.position.set(-width * this.anchor.x + prefixWidth, y);
  }
}
