import { Assets, type BitmapFont } from "pixi.js";
import { tavernAsset } from "./art.ts";

const fonts = ["td_green", "td_gold", "td_red"] as const;
type AmountFont = (typeof fonts)[number];
const fontUrl = (name: AmountFont) => tavernAsset(name + ".xml");
export const hasTavernBitmapFont = (name: AmountFont) =>
  !!Assets.get<BitmapFont | undefined>(fontUrl(name));

export const loadTavernBitmapFonts = () =>
  Promise.all(fonts.map((name) => Assets.load<BitmapFont>(fontUrl(name))));

export function renderAmount(
  target: HTMLElement,
  value: string,
  name: AmountFont,
) {
  const font = Assets.get<BitmapFont | undefined>(fontUrl(name));
  const glyphs = Array.from(
    value.replaceAll("×", "x"),
    (letter) => font?.chars[letter],
  );
  if (!font || !glyphs.every((glyph) => glyph?.texture)) {
    target.textContent = value;
    return;
  }

  const number = document.createElement("span");
  number.className = "tavern-bitmap-number";
  number.setAttribute("aria-hidden", "true");
  for (const glyph of glyphs) {
    const texture = glyph!.texture!;
    const { x, y, width, height } = texture.frame;
    const { width: pageWidth, height: pageHeight } = texture.source;
    const digit = document.createElement("span");
    digit.style.width = `${width / font.baseMeasurementFontSize}em`;
    digit.style.height = `${height / font.baseMeasurementFontSize}em`;
    digit.style.backgroundImage = `url(${tavernAsset(name + ".webp")})`;
    digit.style.backgroundSize = `${(pageWidth / width) * 100}% ${(pageHeight / height) * 100}%`;
    digit.style.backgroundPosition = `${(x / (pageWidth - width)) * 100}% ${(y / (pageHeight - height)) * 100}%`;
    number.append(digit);
  }
  const text = document.createElement("span");
  text.className = "visually-hidden";
  text.textContent = value;
  target.replaceChildren(text, number);
}
