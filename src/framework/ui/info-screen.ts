/**
 * Full-screen game information page: Game Rules, Paytable, Ways to Win (payline grids),
 * Features (text with inline images), General Terms and the version line.
 * Text is inserted as text content; only `[./path.ext]` markers in the features text become images.
 */
export interface InfoPaySymbol {
  image: string;
  /** Matching-symbol counts with their payout multiplier of the bet. */
  pays: { count: number; multiplier: number }[];
}

export interface InfoScreenContent {
  headings: { rules: string; paytable: string; waysToWin: string; features: string; general: string };
  rules: string;
  /** Groups shown as separate rows, e.g. low symbols, high symbols, wild. */
  paytable: InfoPaySymbol[][];
  paytableNote?: string;
  waysToWin: string;
  /** lines[i][reel] is the row of payline i on that reel. */
  paylines: { reels: number; rows: number; lines: number[][] };
  features: string;
  general: string;
  version: string;
  closeIcon: string;
  imageUrl(path: string): string;
}

type Block = { type: "text"; content: string } | { type: "images"; content: string[] };

/** Splits `[./file.webp]` markers from paragraphs, grouping adjacent images in one row. */
export function infoBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const marker = /\[(\.\/[^\]]+\.(?:webp|png|jpe?g|gif|svg))\]/gi;
  let last = 0;
  // Text between images stays one pre-wrapped paragraph, blank lines included.
  const pushText = (part: string) => {
    const content = part.trim();
    if (content) blocks.push({ type: "text", content });
  };
  for (const match of text.matchAll(marker)) {
    pushText(text.slice(last, match.index));
    const previous = blocks.at(-1);
    if (previous?.type === "images" && !text.slice(last, match.index).trim()) previous.content.push(match[1]);
    else blocks.push({ type: "images", content: [match[1]] });
    last = match.index! + match[0].length;
  }
  pushText(text.slice(last));
  return blocks;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(heading: string, ...children: (Node | null)[]) {
  const node = element("div", "info-section");
  node.append(element("h1", undefined, heading), ...children.filter((child): child is Node => !!child));
  return node;
}

function paragraph(text: string) {
  return element("p", undefined, text);
}

function paytable(content: InfoScreenContent) {
  if (!content.paytable.length) return null;
  const wrap = document.createDocumentFragment();
  for (const group of content.paytable) {
    const row = element("div", "info-paysection");
    for (const symbol of group) {
      const column = element("div", "info-paytable-column-container");
      const image = element("img", "info-paytable-image");
      image.alt = "";
      image.src = content.imageUrl(symbol.image);
      const pays = element("div", "info-paytable-column");
      for (const { count, multiplier } of symbol.pays) pays.append(element("span", undefined, `${count} | ${multiplier}x`));
      column.append(image, pays);
      row.append(column);
    }
    wrap.append(row);
  }
  return wrap;
}

function paylines({ reels, rows, lines }: InfoScreenContent["paylines"]) {
  const wrap = element("div", "info-payline-wrap");
  for (const line of lines) {
    const grid = element("div", "info-payline");
    grid.style.gridTemplateColumns = `repeat(${reels}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (let index = 0; index < reels * rows; index++) {
      const cell = element("span", "info-payline-index");
      if (line[index % reels] === Math.floor(index / reels)) cell.classList.add("is-active");
      grid.append(cell);
    }
    wrap.append(grid);
  }
  return wrap;
}

function features(content: InfoScreenContent) {
  return infoBlocks(content.features).map((block) => {
    if (block.type === "text") return paragraph(block.content);
    const images = block.content.map((path) => {
      const image = element("img", "info-content-image");
      image.alt = "";
      image.src = content.imageUrl(path);
      return image;
    });
    if (images.length === 1) return images[0];
    const row = element("div", "info-image-row");
    row.append(...images);
    return row;
  });
}

/**
 * Opens the information page as a modal dialog. Any click on the page, the close button or
 * Escape closes it. Resolves when it has closed.
 */
export function openInfoScreen(content: InfoScreenContent, host: HTMLElement = document.body) {
  host.querySelector("dialog.info-screen")?.remove();
  const dialog = element("dialog", "info-screen");
  dialog.setAttribute("aria-label", content.headings.rules);
  const close = element("button", "info-close-button");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.innerHTML = content.closeIcon;
  const wrap = element("div", "info-wrap");
  wrap.append(
    section(content.headings.rules, paragraph(content.rules)),
    content.paytable.length ? section(content.headings.paytable, ...(content.paytableNote ? [paragraph(content.paytableNote)] : []), paytable(content)) : element("div"),
    section(content.headings.waysToWin, paragraph(content.waysToWin), paylines(content.paylines)),
    section(content.headings.features, ...features(content)),
    section(content.headings.general, paragraph(content.general)),
    paragraph(content.version),
  );
  dialog.append(close, wrap);
  host.append(dialog);
  const closed = new Promise<void>((resolve) => dialog.addEventListener("close", () => {
    dialog.remove();
    resolve();
  }, { once: true }));
  // Like the reference, the whole page dismisses on click; scrolling does not.
  dialog.addEventListener("click", () => dialog.close());
  dialog.showModal();
  close.focus({ preventScroll: true });
  return closed;
}
