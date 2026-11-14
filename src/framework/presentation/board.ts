import { Application, Container, Graphics } from "pixi.js";
import type {
  Board,
  GameDefinition,
  LineWin,
  Position,
} from "../domain/contracts.ts";
const CELL = 102,
  GAP = 8;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export interface SymbolView {
  view: Container;
  set: (id: string) => void;
}
export type SymbolFactory = () => SymbolView;
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
  private factory: SymbolFactory;
  constructor(game: GameDefinition, factory: SymbolFactory) {
    this.game = game;
    this.factory = factory;
  }
  async mount(host: HTMLElement) {
    await this.app.init({
      width: this.game.reels * (CELL + GAP) - GAP,
      height: this.game.rows * (CELL + GAP) - GAP,
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
    for (let reel = 0; reel < this.game.reels; reel++) {
      const column = new Container();
      column.x = reel * (CELL + GAP);
      this.strip.addChild(column);
      this.columns.push(column);
      this.tiles.push([]);
      this.elapsed.push(0);
      this.spinning.push(false);
      const mask = new Graphics()
        .rect(column.x, 0, CELL, this.game.rows * (CELL + GAP) - GAP)
        .fill(0xffffff);
      this.app.stage.addChild(mask);
      column.mask = mask;
      for (let row = 0; row < this.game.rows + 2; row++) {
        const tile = this.factory();
        column.addChild(tile.view);
        this.tiles[reel].push(tile);
      }
    }
    this.setBoard(this.game.initialBoard);
    this.app.ticker.add((tick) => {
      this.columns.forEach((_column, reel) => {
        if (!this.spinning[reel]) return;
        this.elapsed[reel] += tick.deltaMS * (this.fast ? 2.8 : 1.7);
        const offset = this.elapsed[reel] % (CELL + GAP),
          cycle = Math.floor(this.elapsed[reel] / (CELL + GAP));
        this.tiles[reel].forEach((tile, row) => {
          tile.view.y = (row - 1) * (CELL + GAP) + offset;
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
    this.spinning.fill(false);
    this.columns.forEach((_col, reel) =>
      this.tiles[reel].forEach((tile, row) => {
        tile.view.y = (row - 1) * (CELL + GAP);
        tile.view.visible = row > 0 && row <= this.game.rows;
        if (row > 0 && row <= this.game.rows) tile.set(board[reel][row - 1]);
      }),
    );
  }
  start(turbo: boolean) {
    this.fast = turbo;
    this.highlights.clear();
    this.spinning.fill(true);
    this.tiles.flat().forEach((t) => {
      t.view.visible = true;
    });
  }
  skip() {
    this.fast = true;
  }
  async stop(board: Board) {
    for (let reel = 0; reel < this.game.reels; reel++) {
      await delay(this.fast ? 20 : 130);
      this.spinning[reel] = false;
      this.tiles[reel].forEach((tile, row) => {
        tile.view.y = (row - 1) * (CELL + GAP);
        tile.view.visible = row > 0 && row <= this.game.rows;
        if (row > 0 && row <= this.game.rows) tile.set(board[reel][row - 1]);
      });
      // Reel-specific settling bounce while later reels are still spinning.
      const col = this.columns[reel],
        start = performance.now();
      const bounce = () => {
        const t = Math.min(1, (performance.now() - start) / 170);
        col.y = Math.sin(t * Math.PI) * 8 * (1 - t);
        if (t < 1) requestAnimationFrame(bounce);
        else col.y = 0;
      };
      bounce();
    }
  }
  highlight(wins: LineWin[]) {
    this.highlights.clear();
    const seen = new Set<string>();
    for (const win of wins) {
      for (const p of win.positions) {
        const key = p.reel + ":" + p.row;
        if (seen.has(key)) continue;
        seen.add(key);
        this.highlights
          .roundRect(
            p.reel * (CELL + GAP) + 2,
            p.row * (CELL + GAP) + 2,
            CELL - 4,
            CELL - 4,
            10,
          )
          .stroke({ color: 0xffdc77, width: 3 });
      }
      win.positions.forEach((p, i) => {
        const x = p.reel * (CELL + GAP) + CELL / 2,
          y = p.row * (CELL + GAP) + CELL / 2;
        if (i === 0) this.highlights.moveTo(x, y);
        else this.highlights.lineTo(x, y);
      });
      this.highlights.stroke({ color: 0xffdc77, width: 2, alpha: 0.6 });
    }
  }
  destroy() {
    this.app.destroy(true, { children: true });
  }
  async collect(positions: Position[]) {
    await Promise.all(
      positions.map(async (p, index) => {
        await delay(index * 35);
        const particle = new Graphics().circle(0, 0, 8).fill(0xffdf85);
        this.tokens.addChild(particle);
        const x = p.reel * (CELL + GAP) + CELL / 2,
          y = p.row * (CELL + GAP) + CELL / 2,
          start = performance.now();
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
