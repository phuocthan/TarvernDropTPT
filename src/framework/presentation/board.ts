import { Application, Container, Graphics, RenderLayer, UPDATE_PRIORITY, type Ticker } from "pixi.js";
import { keepWithinVerticalViewport, reelCellCenter, type VerticalBounds } from "./grid.ts";
import { planDropColumns } from "./drop-schedule.ts";
import { landingDuration, landingOffset, landingScale } from "./landing-motion.ts";
import type {
  Board,
  GameDefinition,
  LineWin,
  Position,
  ReelMotion,
  SymbolLandingEffects,
} from "../domain/contracts.ts";
export { reelCellCenter } from "./grid.ts";
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export interface SymbolView {
  view: Container;
  set: (id: string) => void;
  effect?: (phase: SymbolPhase) => Promise<void> | void;
  verticalBounds?: () => VerticalBounds | undefined;
}
export type SymbolPhase = "idle" | "spin" | "land" | "win";
export type SymbolFactory = (cellSizePx: number, ticker: Ticker) => SymbolView;

interface DropRound {
  exit: Promise<void>;
  skipped: boolean;
}
interface ReelStopEvents {
  symbol?: (id: string, position: Position) => void;
  reel?: (reel: number) => void;
  anticipation?: (active: boolean) => void;
}

/** Presentation owns motion only. It never evaluates outcomes or changes wallet state. */
export class BoardView {
  readonly app = new Application();
  private game: GameDefinition;
  private columns: Container[] = [];
  private tiles: SymbolView[][] = [];
  private edgeTiles = new Map<SymbolView, { reel: number; pivotY: number; settled: boolean }>();
  private spinning: boolean[] = [];
  private highlights = new Graphics();
  private tokens = new Container();
  private strip = new Container();
  private winningSymbols = new RenderLayer();
  private foregroundSymbols = new RenderLayer();
  private displayedBoard: Board;
  private animatedWinners = new Set<SymbolView>();
  private landingAnimations = new Map<string, Promise<void>>();
  private elapsed: number[] = [];
  private fast = false;
  private dropRound: DropRound | null = null;
  private finishDrop: (() => void) | null = null;
  private resizeObserver?: ResizeObserver;
  private factory: SymbolFactory;
  private readonly cell: number;
  private readonly gap: number;
  private landingCarriers = new Map<SymbolView, Container>();
  private motionGeneration = 0;
  private skipLanding = false;
  private get unfocusedTint() {
    const channel = Math.round(255 * (1 - (this.game.presentation.winDimmerOpacity ?? 0.5)));
    return (channel << 16) | (channel << 8) | channel;
  }
  constructor(game: GameDefinition, factory: SymbolFactory) {
    this.game = game;
    this.factory = factory;
    this.cell = game.presentation.cellSizePx;
    this.gap = game.presentation.gapPx;
    this.displayedBoard = structuredClone(game.initialBoard);
  }
  get allowForceStop() { return this.game.presentation.allowForceStop !== false; }
  get isMoving() { return this.spinning.some(Boolean) || this.dropRound !== null; }
  get contentWidth() { return this.game.reels * (this.cell + this.gap) - this.gap; }
  get contentHeight() { return this.game.rows * (this.cell + this.gap) - this.gap; }
  async mount(host: HTMLElement, { autoStart = true } = {}) {
    const width = this.game.reels * (this.cell + this.gap) - this.gap;
    const height = this.game.rows * (this.cell + this.gap) - this.gap;
    const padding = this.game.presentation.reelMaskPaddingPx ?? 0;
    const overflow = this.game.presentation.winOverflowPaddingPx ?? 0;
    const renderPadding = Math.max(padding, overflow);
    const renderWidth = width + 2 * overflow;
    const renderHeight = height + 2 * renderPadding;
    const boardResolution = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      return Math.min(dpr, Math.max(1, (host.clientWidth || width) * dpr / width));
    };
    await this.app.init({
      width: renderWidth,
      height: renderHeight,
      autoStart,
      backgroundAlpha: 0,
      antialias: true,
      resolution: boardResolution(),
      autoDensity: true,
      preference: "webgl",
    });
    this.app.ticker.minFPS = 0;
    if (renderPadding || overflow) {
      host.dataset.maskPadding = "true";
      host.style.setProperty("--reel-canvas-height", `${100 * renderHeight / height}%`);
      host.style.setProperty("--reel-canvas-width", `${100 * renderWidth / width}%`);
      host.style.setProperty("--reel-canvas-offset-x", `${-100 * overflow / renderWidth}%`);
      host.style.setProperty("--reel-canvas-offset", `${-100 * renderPadding / renderHeight}%`);
      this.app.stage.position.set(overflow, renderPadding);
    }
    host.appendChild(this.app.canvas);
    this.resizeObserver = new ResizeObserver(() => {
      const resolution = boardResolution();
      if (Math.abs(this.app.renderer.resolution - resolution) > 0.05)
        this.app.renderer.resize(renderWidth, renderHeight, resolution);
    });
    this.resizeObserver.observe(host);
    this.app.canvas.setAttribute(
      "aria-label",
      `${this.game.reels} by ${this.game.rows} reel board`,
    );
    const maskedReels = new Container();
    maskedReels.addChild(this.strip, this.winningSymbols);
    const mask = new Graphics()
      .rect(0, -padding, width, height + 2 * padding)
      .fill(0xffffff);
    this.app.stage.addChild(maskedReels, this.highlights, this.foregroundSymbols, this.tokens, mask);
    maskedReels.mask = mask;
    for (let reel = 0; reel < this.game.reels; reel++) {
      const column = new Container();
      column.x = reel * (this.cell + this.gap);
      this.strip.addChild(column);
      this.columns.push(column);
      this.tiles.push([]);
      this.elapsed.push(0);
      this.spinning.push(false);
      for (let row = 0; row < this.game.rows + 2; row++) {
        const original = this.factory(this.cell, this.app.ticker);
        let tile = original;
        if (this.game.presentation.landing) {
          const view = new Container();
          const carrier = new Container({ label: "symbol-landing" });
          carrier.pivot.set(this.cell / 2, this.cell);
          carrier.position.copyFrom(carrier.pivot);
          carrier.addChild(original.view); view.addChild(carrier);
          tile = { ...original, view, verticalBounds: () => {
            const bounds = original.verticalBounds?.();
            return bounds && { top: this.cell + (bounds.top - this.cell) * carrier.scale.y,
              bottom: this.cell + (bounds.bottom - this.cell) * carrier.scale.y };
          } };
          this.landingCarriers.set(tile, carrier);
        }
        if (this.game.presentation.symbolEdgeInsetPx !== undefined &&
          (row === 1 || row === this.game.rows)) {
          this.edgeTiles.set(tile, { reel, pivotY: tile.view.pivot.y, settled: true });
        }
        column.addChild(tile.view);
        this.tiles[reel].push(tile);
      }
    }
    this.setBoard(this.game.initialBoard);
    const normal = this.game.presentation.normal;
    this.app.ticker.add((tick) => {
      if (!this.spinning.includes(true)) return;
      this.columns.forEach((_column, reel) => {
        if (!this.spinning[reel]) return;
        this.elapsed[reel] +=
          (tick.deltaMS *
            (this.fast
              ? normal.turboSpeedPxPerSecond
              : normal.speedPxPerSecond)) /
          1000;
        const offset = this.elapsed[reel] % (this.cell + this.gap),
          cycle = Math.floor(this.elapsed[reel] / (this.cell + this.gap));
        this.tiles[reel].forEach((tile, row) => {
          tile.view.y = (row - 1) * (this.cell + this.gap) + offset;
          tile.set(
            this.game.symbols[
              (cycle + row + reel * 3) % this.game.symbols.length
            ].id,
          );
        });
      });
      this.strip.visible = true;
    });
    if (this.edgeTiles.size)
      this.app.ticker.add(() => this.fitEdgeSymbols(), undefined, UPDATE_PRIORITY.LOW + 1);
  }
  setBoard(board: Board) {
    this.motionGeneration++;
    this.resetLanding();
    this.dropRound = null;
    this.finishDrop?.();
    this.spinning.fill(false);
    this.clearHighlight();
    board.forEach((symbols, reel) => this.setReel(reel, symbols, "idle"));
    this.strip.visible = true;
    this.fitEdgeSymbols();
  }
  hideSymbols() {
    this.clearHighlight();
    this.strip.visible = false;
  }
  private setReel(reel: number, symbols: string[], phase: SymbolPhase) {
    this.displayedBoard[reel] = [...symbols];
    this.tiles[reel].forEach((tile, row) => {
      tile.view.y = (row - 1) * (this.cell + this.gap);
      tile.view.alpha = 1;
      tile.view.visible = row > 0 && row <= this.game.rows;
      const edge = this.edgeTiles.get(tile);
      if (edge) {
        edge.settled = true;
        tile.view.pivot.y = edge.pivotY;
      }
      if (tile.view.visible) tile.set(symbols[row - 1]);
      const animation = tile.effect?.(tile.view.visible ? phase : "idle");
      if (phase === "land" && row > 0 && row <= this.game.rows && animation)
        this.landingAnimations.set(`${reel}:${row - 1}`, animation);
    });
  }
  private fitEdgeSymbols() {
    if (!this.strip.visible || !this.edgeTiles.size) return;
    const inset = this.game.presentation.symbolEdgeInsetPx!;
    for (const [tile, edge] of this.edgeTiles) {
      if (!edge.settled || !tile.view.visible || tile.view.parentRenderLayer === this.foregroundSymbols) continue;
      const { view } = tile;
      const authored = tile.verticalBounds?.();
      const origin = this.columns[edge.reel].y + view.y;
      const scale = view.scale.y;
      if (!scale) continue;
      const local = authored ? null : view.getLocalBounds();
      const a = origin + ((authored?.top ?? local!.minY) - edge.pivotY) * scale;
      const b = origin + ((authored?.bottom ?? local!.maxY) - edge.pivotY) * scale;
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const offset = keepWithinVerticalViewport(
        { top: Math.min(a, b), bottom: Math.max(a, b) },
        this.contentHeight, inset,
      );
      view.pivot.y = edge.pivotY - offset / scale;
    }
  }
  start(turbo: boolean, motion: ReelMotion = this.game.presentation.spinType) {
    this.motionGeneration++;
    this.skipLanding = false;
    this.resetLanding();
    this.fast = turbo;
    this.landingAnimations.clear();
    this.clearHighlight();
    if (motion === "drop") {
      for (const tile of this.tiles.flat()) {
        if (tile.view.visible) tile.effect?.("idle");
      }
      this.dropRound = {
        exit: this.strip.visible ? this.animateDrop(false) : Promise.resolve(),
        skipped: false,
      };
      return;
    }
    this.spinning.fill(true);
    for (const [tile, edge] of this.edgeTiles) {
      edge.settled = false;
      tile.view.pivot.y = edge.pivotY;
    }
    this.tiles.flat().forEach((t) => {
      t.view.visible = true;
      t.effect?.("spin");
    });
  }
  skip() {
    if (!this.allowForceStop && this.isMoving) return false;
    this.fast = true;
    this.skipLanding = true;
    this.resetLanding();
    if (this.dropRound) {
      this.dropRound.skipped = true;
      this.finishDrop?.();
    }
    return true;
  }
  async stop(
    board: Board,
    playLandingEffects?: (effects: SymbolLandingEffects) => void,
    events?: ReelStopEvents,
  ) {
    const effectsBySymbol = this.game.presentation.symbolLandingEffects;
    const onLand = (reel: number, row: number) => {
      const symbol = board[reel][row];
      if (effectsBySymbol && Object.hasOwn(effectsBySymbol, symbol))
        playLandingEffects?.(effectsBySymbol[symbol]);
      events?.symbol?.(symbol, { reel, row });
    };
    const drop = this.dropRound;
    if (drop) {
      await drop.exit;
      if (this.dropRound !== drop) return;
      if (!drop.skipped) {
        board.forEach((symbols, reel) => this.setReel(reel, symbols, "idle"));
        this.strip.visible = true;
        await this.animateDrop(true, { board, onLand, events });
      }
      if (this.dropRound === drop) {
        this.dropRound = null;
        if (drop.skipped) this.setBoard(board);
      }
      return;
    }
    const normal = this.game.presentation.normal;
    const generation = this.motionGeneration;
    let lastBounce: Promise<void> = Promise.resolve();
    for (let reel = 0; reel < this.game.reels; reel++) {
      await delay(this.fast ? normal.turboStopDelayMs : normal.stopDelayMs);
      if (generation !== this.motionGeneration) return;
      this.spinning[reel] = false;
      this.setReel(reel, board[reel], this.fast ? "idle" : "land");
      board[reel].forEach((_, row) => onLand(reel, row));
      events?.reel?.(reel);
      // Reel-specific settling bounce while later reels are still spinning.
      const col = this.columns[reel],
        start = performance.now();
      lastBounce = new Promise<void>((resolve) => {
        const bounce = () => {
          if (generation !== this.motionGeneration) { resolve(); return; }
          const elapsed = performance.now() - start;
          const duration = Math.max(normal.bounceMs, landingDuration(this.game.presentation.landing));
          const t = this.skipLanding ? 1 : Math.min(1, elapsed / duration);
          col.y = landingOffset(t, normal.bouncePx);
          for (const tile of this.tiles[reel]) this.applyLanding(tile, this.skipLanding ? Infinity : elapsed);
          if (t < 1) requestAnimationFrame(bounce);
          else {
            col.y = 0;
            resolve();
          }
        };
        bounce();
      });
    }
    await lastBounce;
    this.strip.visible = true;
  }
  private animateDrop(entering: boolean, landing?: {
    board: Board;
    onLand: (reel: number, row: number) => void;
    events?: ReelStopEvents;
  }) {
    for (const [tile, edge] of this.edgeTiles) {
      edge.settled = false;
      if (entering) tile.view.pivot.y = edge.pivotY;
    }
    const pitch = this.cell + this.gap;
    const boardHeight = this.game.rows * pitch;
    const drop = this.game.presentation.drop;
    const { fallMs, reelStaggerMs, rowStaggerMs, holdMs } = entering
      ? drop.enter
      : drop.exit;
    const deformation = this.game.presentation.landing;
    const bounce = entering ? Math.max(drop.bounceMs, landingDuration(deformation) - (deformation?.leadMs ?? 0)) : 0;
    const moves = this.tiles.flatMap((tiles, reel) =>
      Array.from({ length: this.game.rows }, (_, row) => {
        const rest = row * pitch;
        const from = entering ? -pitch : rest;
        const to = entering ? rest : boardHeight;
        return {
          tile: tiles[row + 1],
          reel,
          row,
          from,
          to,
          start: (this.game.rows - 1 - row) * rowStaggerMs,
          fall: fallMs * Math.sqrt((to - from) / boardHeight),
          landed: false,
        };
      }),
    );
    const reelLandMs = Math.max(...moves.slice(0, this.game.rows).map((move) => move.start + move.fall));
    const plan = landing
      ? planDropColumns(landing.board, reelStaggerMs, reelLandMs, this.fast ? undefined : drop.anticipation)
      : undefined;
    for (const move of moves)
      move.start += plan?.starts[move.reel] ?? move.reel * reelStaggerMs;
    const landedReels = new Set<number>();
    const landedAnticipationSymbols: SymbolView[] = [];
    let anticipating = false;
    const anticipationSymbol = plan?.anticipationAt === undefined
      ? undefined
      : drop.anticipation?.symbolId;
    const duration =
      Math.max(...moves.map((move) => move.start + move.fall)) +
      bounce +
      holdMs;
    const paint = (time: number) => {
      for (const move of moves) {
        const elapsed = time - move.start;
        const progress = Math.max(0, Math.min(1, elapsed / move.fall));
        const settle = Math.max(
          0,
          Math.min(1, (elapsed - move.fall) / (bounce || 1)),
        );
        const rebound = entering
          ? landingOffset(settle, drop.bouncePx)
          : 0;
        this.applyLanding(move.tile, entering ? elapsed - move.fall + (deformation?.leadMs ?? 0) : Infinity);
        move.tile.view.y =
          move.from + (move.to - move.from) * progress ** 2 + rebound;
        if (
          entering &&
          progress === 1 &&
          !move.landed &&
          this.dropRound &&
          !this.dropRound.skipped
        ) {
          move.landed = true;
          const edge = this.edgeTiles.get(move.tile);
          if (edge) edge.settled = true;
          const animation = move.tile.effect?.("land");
          if (animation) this.landingAnimations.set(`${move.reel}:${move.row}`, animation);
          landing?.onLand(move.reel, move.row);
          if (anticipationSymbol !== undefined &&
              landing?.board[move.reel][move.row] === anticipationSymbol) {
            landedAnticipationSymbols.push(move.tile);
            if (anticipating) this.raiseAnticipationSymbol(move.tile);
          }
        }
      }
      if (!plan || !this.dropRound || this.dropRound.skipped) return;
      plan.starts.forEach((start, reel) => {
        if (time < start + reelLandMs || landedReels.has(reel)) return;
        landedReels.add(reel);
        landing?.events?.reel?.(reel);
      });
      if (!anticipating && plan.anticipationAt !== undefined && time >= plan.anticipationAt) {
        anticipating = true;
        for (const tile of this.tiles.flat())
          tile.view.tint = this.unfocusedTint;
        this.app.canvas.setAttribute("data-anticipation-focus", "");
        for (const tile of landedAnticipationSymbols) this.raiseAnticipationSymbol(tile);
        landing?.events?.anticipation?.(true);
      }
    };

    paint(0);
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const speed = this.fast ? drop.turboMultiplier : 1;
      let frame = 0;
      const finish = () => {
        cancelAnimationFrame(frame);
        this.finishDrop = null;
        paint(duration);
        this.resetLanding();
        if (anticipating) {
          this.clearHighlight();
          landing?.events?.anticipation?.(false);
        }
        resolve();
      };
      const tick = (now: number) => {
        const elapsed = (now - start) * speed;
        if (elapsed >= duration) {
          finish();
        } else {
          paint(elapsed);
          frame = requestAnimationFrame(tick);
        }
      };
      this.finishDrop = finish;
      frame = requestAnimationFrame(tick);
    });
  }
  highlight(wins: LineWin[], scatter: Position[] = [], dimUnmatched = false) {
    this.highlights.clear();
    const seen = new Set<string>();
    for (const win of wins) {
      for (const p of win.positions) {
        const key = p.reel + ":" + p.row;
        if (seen.has(key)) continue;
        seen.add(key);
        this.highlights
          .roundRect(
            p.reel * (this.cell + this.gap) + 2,
            p.row * (this.cell + this.gap) + 2,
            this.cell - 4,
            this.cell - 4,
            10,
          )
          .stroke({ color: 0xffdc77, width: 3 });
      }
      win.positions.forEach((p, i) => {
        const { x, y } = reelCellCenter(p, this.game.presentation);
        if (i === 0) this.highlights.moveTo(x, y);
        else this.highlights.lineTo(x, y);
      });
      this.highlights.stroke({ color: 0xffdc77, width: 2, alpha: 0.6 });
    }
    for (const { reel, row } of scatter) seen.add(reel + ":" + row);
    return this.playWinners(seen, dimUnmatched);
  }
  focusWins(positions: Position[]) {
    return this.playWinners(
      new Set(positions.map(({ reel, row }) => reel + ":" + row)),
      true,
    );
  }
  async waitForLandings(positions: Position[]) {
    await Promise.all(positions.map(({ reel, row }) => this.landingAnimations.get(`${reel}:${row}`)));
  }
  private raiseAnticipationSymbol(tile: SymbolView) {
    tile.view.tint = 0xffffff;
    this.winningSymbols.attach(tile.view);
  }
  private playWinners(seen: Set<string>, dimUnmatched: boolean) {
    const animations: Promise<void>[] = [];
    for (const [reel, tiles] of this.tiles.entries()) {
      for (const [slot, tile] of tiles.entries()) {
        const matched = seen.has(reel + ":" + (slot - 1));
        tile.view.tint = dimUnmatched && !matched ? this.unfocusedTint : 0xffffff;
        const foreground = matched && this.game.presentation.foregroundWinSymbols?.includes(this.displayedBoard[reel]?.[slot - 1]);
        const layer = foreground ? this.foregroundSymbols : this.winningSymbols;
        const previous = tile.view.parentRenderLayer;
        if (previous && (previous !== layer || !matched || !dimUnmatched)) previous.detach(tile.view);
        if (matched && dimUnmatched) {
          layer.attach(tile.view);
          if (foreground) {
            const edge = this.edgeTiles.get(tile);
            if (edge) tile.view.pivot.y = edge.pivotY;
          }
        }
        if (!matched && this.animatedWinners.delete(tile)) tile.effect?.("idle");
        if (matched) {
          this.animatedWinners.add(tile);
          const animation = tile.effect?.("win");
          if (animation) animations.push(animation);
        }
      }
    }
    this.app.canvas.toggleAttribute("data-win-focus", dimUnmatched && seen.size > 0);
    this.app.canvas.toggleAttribute("data-foreground-win-focus", this.tiles.flat().some((tile) => tile.view.parentRenderLayer === this.foregroundSymbols));
    return Promise.all(animations);
  }
  clearHighlight() {
    this.highlights.clear();
    for (const tile of this.tiles.flat()) {
      tile.view.tint = 0xffffff;
      if (this.animatedWinners.has(tile)) tile.effect?.("idle");
    }
    this.animatedWinners.clear();
    this.winningSymbols.detachAll();
    this.foregroundSymbols.detachAll();
    this.app.canvas.removeAttribute("data-foreground-win-focus");
    this.app.canvas.removeAttribute("data-win-focus");
    this.app.canvas.removeAttribute("data-anticipation-focus");
    this.fitEdgeSymbols();
  }
  destroy() {
    this.motionGeneration++;
    this.resizeObserver?.disconnect();
    this.dropRound = null;
    this.finishDrop?.();
    this.landingCarriers.clear();
    this.app.destroy(true, { children: true });
  }
  private applyLanding(tile: SymbolView, elapsed: number) {
    const carrier = this.landingCarriers.get(tile);
    if (!carrier) return;
    const scale = landingScale(elapsed, this.game.presentation.landing);
    carrier.scale.set(scale.x, scale.y);
  }
  private resetLanding() {
    for (const carrier of this.landingCarriers.values()) carrier.scale.set(1);
    for (const column of this.columns) column.y = 0;
  }
  async collect(positions: Position[]) {
    await Promise.all(
      positions.map(async (p, index) => {
        await delay(index * 35);
        const particle = new Graphics().circle(0, 0, 8).fill(0xffdf85);
        this.tokens.addChild(particle);
        const { x, y } = reelCellCenter(p, this.game.presentation);
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const step = () => {
            const t = Math.min(1, (performance.now() - start) / 450);
            particle.position.set(x + Math.sin(t * Math.PI) * 18, y * (1 - t));
            particle.alpha = 1 - t * 0.5;
            if (t < 1) requestAnimationFrame(step);
            else resolve();
          };
          step();
        });
        particle.destroy();
      }),
    );
  }
}
