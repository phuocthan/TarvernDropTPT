import { Application, Container, Graphics } from "pixi.js";
import type {
  Board,
  GameDefinition,
  LineWin,
  Position,
  ReelMotion,
  ReelPresentation,
} from "../domain/contracts.ts";
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export function reelCellCenter(
  { reel, row }: Position,
  { cellSizePx, gapPx }: Pick<ReelPresentation, "cellSizePx" | "gapPx">,
) {
  const pitch = cellSizePx + gapPx;
  return { x: reel * pitch + cellSizePx / 2, y: row * pitch + cellSizePx / 2 };
}
export interface SymbolView {
  view: Container;
  set: (id: string) => void;
  effect?: (phase: SymbolPhase) => Promise<void> | void;
}
export type SymbolPhase = "idle" | "spin" | "land" | "win";
export type SymbolFactory = (cellSizePx: number) => SymbolView;

interface DropRound {
  exit: Promise<void>;
  skipped: boolean;
}

/** Presentation owns motion only. It never evaluates outcomes or changes wallet state. */
export class BoardView {
  readonly app = new Application();
  private game: GameDefinition;
  private columns: Container[] = [];
  private tiles: SymbolView[][] = [];
  private spinning: boolean[] = [];
  private highlights = new Graphics();
  private tokens = new Container();
  private strip = new Container();
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
    this.app.stage.addChild(this.strip, this.highlights, this.tokens);
    const mask = new Graphics()
      .rect(0, 0, this.app.screen.width, this.app.screen.height)
      .fill(0xffffff);
    this.app.stage.addChild(mask);
    this.strip.mask = mask;
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
        column.addChild(tile.view);
        this.tiles[reel].push(tile);
      }
    }
    this.setBoard(this.game.initialBoard);
    const normal = this.game.presentation.normal;
    this.app.ticker.add((tick) => {
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
    });
  }
  setBoard(board: Board) {
    this.dropRound = null;
    this.finishDrop?.();
    this.spinning.fill(false);
    this.clearHighlight();
    board.forEach((symbols, reel) => this.setReel(reel, symbols, "idle"));
  }
  private setReel(reel: number, symbols: string[], phase: SymbolPhase) {
    this.tiles[reel].forEach((tile, row) => {
      tile.view.y = (row - 1) * (this.cell + this.gap);
      tile.view.alpha = 1;
      tile.view.visible = row > 0 && row <= this.game.rows;
      if (tile.view.visible) tile.set(symbols[row - 1]);
      tile.effect?.(tile.view.visible ? phase : "idle");
    });
  }
  start(turbo: boolean, motion: ReelMotion = this.game.presentation.spinType) {
    this.fast = turbo;
    this.clearHighlight();
    if (motion === "drop") {
      for (const tile of this.tiles.flat()) {
        if (tile.view.visible) tile.effect?.("idle");
      }
      this.dropRound = { exit: this.animateDrop(false), skipped: false };
      return;
    }
    this.spinning.fill(true);
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
  async stop(board: Board) {
    const drop = this.dropRound;
    if (drop) {
      await drop.exit;
      if (this.dropRound !== drop) return;
      if (!drop.skipped) {
        board.forEach((symbols, reel) => this.setReel(reel, symbols, "idle"));
        await this.animateDrop(true);
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
  }
  private animateDrop(entering: boolean) {
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
          from,
          to,
          start:
            reel * reelStaggerMs + (this.game.rows - 1 - row) * rowStaggerMs,
          fall: fallMs * Math.sqrt((to - from) / boardHeight),
          landed: false,
        };
      }),
    );
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
          !this.dropRound?.skipped
        ) {
          move.landed = true;
          move.tile.effect?.("land");
        }
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
        tile.view.alpha = dimUnmatched && seen.size && !matched ? 0.55 : 1;
        if (matched) {
          const animation = tile.effect?.("win");
          if (animation) animations.push(animation);
        }
      }
    }
    return Promise.all(animations);
  }
  clearHighlight() {
    this.highlights.clear();
    for (const tile of this.tiles.flat()) tile.view.alpha = 1;
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
