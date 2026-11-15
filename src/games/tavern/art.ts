import { assetUrl } from "../../framework/presentation/assets.ts";

export function tavernAsset(name: string) {
  return assetUrl("tavern-assets/assets/" + name);
}

const pages = [
  ["td_master.webp", 4096, 4095],
  ["td_master_2.webp", 4096, 4096],
  ["td_master_3.webp", 4092, 4095],
  ["td_master_4.webp", 4094, 4090],
] as const;

const regions = {
  base: [1, 2, 2094, 3000, 2000],
  cellar: [1, 2, 92, 3000, 2000],
  barrel: [1, 3004, 1064, 756, 1694],
  cellarBarrels: [0, 2, 508, 3001, 2001],
  baseTable: [0, 2, 3547, 3001, 546],
  cellarTable: [0, 2, 2999, 3001, 546],
  reel: [2, 2, 399, 1988, 1702],
  chestFront: [1, 3286, 3, 259, 161],
  chestLid: [1, 3004, 5, 280, 159],
  chestOpen: [3, 3462, 7, 245, 184],
  chestCoins: [0, 776, 2531, 230, 103],
  key: [3, 3248, 3, 212, 188],
  totalWin: [3, 1480, 657, 1075, 310],
} as const;

/** Atlas crops use the original texture pages. The key is stored rotated. */
export function artRegion(name: keyof typeof regions, className: string) {
  const [page, x, y, width, height] = regions[name];
  const [file, pageWidth, pageHeight] = pages[page];
  return textureRegion(
    "hd/" + file,
    className,
    [pageWidth, pageHeight],
    [x, y, width, height],
  );
}

export function textureRegion(
  file: string,
  className: string,
  [pageWidth, pageHeight]: readonly [number, number],
  [x, y, width, height]: readonly [number, number, number, number],
) {
  const size = `${(pageWidth / width) * 100}% ${(pageHeight / height) * 100}%`;
  const position = `${(x / (pageWidth - width)) * 100}% ${(y / (pageHeight - height)) * 100}%`;
  return `<span aria-hidden="true" class="atlas-art ${className}" style="--art-image:url(${tavernAsset(file)});--art-size:${size};--art-position:${position};--art-ratio:${width}/${height}"></span>`;
}
