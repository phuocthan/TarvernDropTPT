import { Application, Container, Graphics, RenderLayer } from "pixi.js";
import { keepWithinVerticalViewport, reelCellCenter, type VerticalBounds } from "./grid.ts";
import { drawDimmer } from "./scene.ts";
import { planDropColumns } from "./drop-schedule.ts";
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
export type SymbolFactory = (cellSizePx: number) => SymbolView;

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
  private dimmer = new Graphics();
  private winningSymbols = new RenderLayer();
  private elapsed: number[] = [];
  private fast = false;
  private dropRound: DropRound | null = null;
  private finishDrop: (() => void) | null = null;
  private factory: SymbolFactory;
  private readonly cell: number;
  private readonly gap: number;
  constructor(game: GameDefinition, factory: SymbolFactory) {
    this.game = game;
    this.factory = factory;
    this.cell = game.presentation.cellSizePx;
    this.gap = game.presentation.gapPx;
  }
  async mount(host: HTMLElement) {
    await this.app.init({
      width: this.game.reels * (this.cell + this.gap) - this.gap,
      height: this.game.rows * (this.cell + this.gap) - this.gap,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: "webgl",
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      "aria-label",
      `${this.game.reels} by ${this.game.rows} reel board`,
    );
    const { width, height } = this.app.screen;
    const maskedReels = new Container();
    drawDimmer(this.dimmer, width, height, this.game.presentation.winDimmerOpacity ?? 0.5);
    this.dimmer.visible = false;
    maskedReels.addChild(this.strip, this.dimmer, this.winningSymbols);
    const mask = new Graphics()
      .rect(0, 0, width, height)
      .fill(0xffffff);
    this.app.stage.addChild(maskedReels, this.highlights, this.tokens, mask);
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
        const tile = this.factory(this.cell);
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
      this.app.ticker.add(() => this.fitEdgeSymbols());
  }
  setBoard(board: Board) {
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
      tile.effect?.(tile.view.visible ? phase : "idle");
    });
  }
  private fitEdgeSymbols() {
    if (!this.strip.visible || !this.edgeTiles.size) return;
    const inset = this.game.presentation.symbolEdgeInsetPx!;
    for (const [tile, edge] of this.edgeTiles) {
      if (!edge.settled || !tile.view.visible) continue;
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
        this.app.screen.height, inset,
      );
      view.pivot.y = edge.pivotY - offset / scale;
    }
  }
  start(turbo: boolean, motion: ReelMotion = this.game.presentation.spinType) {
    this.fast = turbo;
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
    this.fast = true;
    if (this.dropRound) {
      this.dropRound.skipped = true;
      this.finishDrop?.();
    }
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
    for (let reel = 0; reel < this.game.reels; reel++) {
      await delay(this.fast ? normal.turboStopDelayMs : normal.stopDelayMs);
      this.spinning[reel] = false;
      this.setReel(reel, board[reel], this.fast ? "idle" : "land");
      board[reel].forEach((_, row) => onLand(reel, row));
      events?.reel?.(reel);
      // Reel-specific settling bounce while later reels are still spinning.
      const col = this.columns[reel],
        start = performance.now();
      const bounce = () => {
        const t = Math.min(1, (performance.now() - start) / normal.bounceMs);
        col.y = Math.sin(t * Math.PI) * normal.bouncePx * (1 - t);
        if (t < 1) requestAnimationFrame(bounce);
        else col.y = 0;
      };
      bounce();
    }
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
    const bounce = entering ? drop.bounceMs : 0;
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
    let anticipating = false;
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
          ? drop.bouncePx * Math.sin(Math.PI * settle)
          : 0;
        move.tile.view.y =
          move.from + (move.to - move.from) * progress ** 2 - rebound;
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
          move.tile.effect?.("land");
          landing?.onLand(move.reel, move.row);
        }
      }
      if (entering) this.fitEdgeSymbols();
      if (!plan || !this.dropRound || this.dropRound.skipped) return;
      plan.starts.forEach((start, reel) => {
        if (time < start + reelLandMs || landedReels.has(reel)) return;
        landedReels.add(reel);
        landing?.events?.reel?.(reel);
      });
      if (!anticipating && plan.anticipationAt !== undefined && time >= plan.anticipationAt) {
        anticipating = true;
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
        if (anticipating) landing?.events?.anticipation?.(false);
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
  private playWinners(seen: Set<string>, dimUnmatched: boolean) {
    const animations: Promise<void>[] = [];
    for (const [reel, tiles] of this.tiles.entries()) {
      for (const [slot, tile] of tiles.entries()) {
        const matched = seen.has(reel + ":" + (slot - 1));
        const raised = tile.view.parentRenderLayer === this.winningSymbols;
        if (matched && dimUnmatched) this.winningSymbols.attach(tile.view);
        else if (raised) {
          this.winningSymbols.detach(tile.view);
          if (!matched) tile.effect?.("idle");
        }
        if (matched) {
          const animation = tile.effect?.("win");
          if (animation) animations.push(animation);
        }
      }
    }
    this.dimmer.visible = this.winningSymbols.renderLayerChildren.length > 0;
    this.app.canvas.toggleAttribute("data-win-focus", this.dimmer.visible);
    return Promise.all(animations);
  }
  clearHighlight() {
    this.highlights.clear();
    for (const tile of this.tiles.flat()) {
      if (tile.view.parentRenderLayer === this.winningSymbols) tile.effect?.("idle");
    }
    this.winningSymbols.detachAll();
    this.dimmer.visible = false;
    this.app.canvas.removeAttribute("data-win-focus");
  }
  destroy() {
    this.dropRound = null;
    this.finishDrop?.();
    this.app.destroy(true, { children: true });
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
