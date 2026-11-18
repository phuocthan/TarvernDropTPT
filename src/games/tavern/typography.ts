import { Assets, type BitmapFont } from "pixi.js";
import { tavernAsset } from "./art.ts";
import type { ResourceManager } from "../../framework/resources/resource-manager.ts";

const fonts = ["td_green", "td_gold", "td_red"] as const;
type AmountFont = (typeof fonts)[number];
const fontUrl = (name: AmountFont) => tavernAsset(name + ".xml");
const loadedFonts = new Map<AmountFont, BitmapFont>();
export const hasTavernBitmapFont = (name: AmountFont) =>
  loadedFonts.has(name) || !!Assets.get<BitmapFont | undefined>(fontUrl(name));

export const loadTavernBitmapFonts = async (resources: ResourceManager) => {
  await resources.loadBundle("fonts");
  for (const name of fonts) loadedFonts.set(name, resources.get<BitmapFont>("font." + name.slice(3)));
};

export function renderAmount(
  target: HTMLElement,
  value: string,
  name: AmountFont,
) {
  const font = loadedFonts.get(name) ?? Assets.get<BitmapFont | undefined>(fontUrl(name));
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
