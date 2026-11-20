import { defaultFilterVert, Filter, GlProgram, Rectangle, RendererType, type Application } from "pixi.js";

/** Same parameter meaning as pixi-filters' ShockwaveFilter (distances in logical pixels). */
export interface ShockwaveConfig {
  amplitude: number;
  wavelength: number;
  speed: number;
  brightness: number;
  /** Maximum radius in pixels; -1 lets the ring travel without fading out. */
  radius: number;
  durationMs: number;
  /** Shader time at the start of the first wave and of every later wave. */
  firstTime: number;
  restartTime: number;
  endTime: number;
}

export const defaultShockwave: ShockwaveConfig = {
  amplitude: 20, wavelength: 450, speed: 500, brightness: 1, radius: -1,
  durationMs: 500, firstTime: 0, restartTime: -1.5, endTime: 2.4,
};

// A radial ring displacement equivalent to pixi-filters ShockwaveFilter, written for the
// PixiJS v8 WebGL filter pipeline. uCenter is in input-texture pixels.
// highp matches the default vertex shader: GPUs refuse to link when uInputSize precision differs.
const fragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
uniform vec2 uCenter;
uniform float uTime;
uniform float uSpeed;
uniform vec4 uWave;

const float PI = 3.14159265;

void main(void) {
  float amplitude = uWave.x;
  float halfWavelength = uWave.y * 0.5 / uInputSize.x;
  float brightness = uWave.z;
  float maxRadius = uWave.w / uInputSize.x;
  float currentRadius = uTime * uSpeed / uInputSize.x;
  float fade = 1.0;
  vec4 source = texture(uTexture, vTextureCoord);
  if (maxRadius > 0.0) {
    if (currentRadius > maxRadius) { finalColor = source; return; }
    fade = 1.0 - pow(currentRadius / maxRadius, 2.0);
  }
  vec2 dir = vTextureCoord - uCenter / uInputSize.xy;
  dir.y *= uInputSize.y / uInputSize.x;
  float dist = length(dir);
  if (dist <= 0.0 || dist < currentRadius - halfWavelength || dist > currentRadius + halfWavelength) {
    finalColor = source;
    return;
  }
  float diff = (dist - currentRadius) / halfWavelength;
  float p = 1.0 - pow(abs(diff), 2.0);
  float shift = 1.25 * sin(diff * PI) * p * amplitude * fade;
  vec2 coord = vTextureCoord + normalize(dir) * shift / uInputSize.xy;
  vec2 clamped = clamp(coord, uInputClamp.xy, uInputClamp.zw);
  vec4 color = texture(uTexture, clamped);
  if (coord != clamped) color *= max(0.0, 1.0 - length(coord - clamped));
  color.rgb *= 1.0 + (brightness - 1.0) * p * fade;
  finalColor = color;
}
`;

export class ShockwaveFilter extends Filter {
  private uniforms: { uCenter: Float32Array; uTime: number; uSpeed: number; uWave: Float32Array };
  constructor(config: Pick<ShockwaveConfig, "amplitude" | "wavelength" | "speed" | "brightness" | "radius">) {
    super({
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "fw-pixi-shockwave" }),
      resources: {
        shockwaveUniforms: {
          uCenter: { value: new Float32Array(2), type: "vec2<f32>" },
          uTime: { value: 0, type: "f32" },
          uSpeed: { value: config.speed, type: "f32" },
          uWave: { value: new Float32Array([config.amplitude, config.wavelength, config.brightness, config.radius]), type: "vec4<f32>" },
        },
      },
    });
    // Only a GL program is supplied, so Pixi marks this filter WebGL-only.
    this.uniforms = this.resources.shockwaveUniforms.uniforms;
  }
  set time(value: number) { this.uniforms.uTime = value; }
  get time() { return this.uniforms.uTime; }
  setCenter(x: number, y: number) {
    this.uniforms.uCenter[0] = x;
    this.uniforms.uCenter[1] = y;
  }
}

interface Target { app: Application; filter: ShockwaveFilter; frame: number | null; release?: () => void; done?: () => void }

/**
 * Plays one viewport-centred wave across several Pixi canvases at once. Each canvas keeps
 * its other filters; only this shockwave filter is removed when the wave ends.
 */
export function createShockwave(config: ShockwaveConfig = defaultShockwave) {
  const targets = new WeakMap<Application, Target>();
  let time = config.firstTime;
  function target(app: Application) {
    let entry = targets.get(app);
    if (!entry) {
      entry = { app, filter: new ShockwaveFilter(config), frame: null };
      targets.set(app, entry);
    }
    return entry;
  }
  function attach(entry: Target) {
    const { app, filter } = entry;
    const stage = app.stage;
    const filters = stage.filters ? [...(Array.isArray(stage.filters) ? stage.filters : [stage.filters])] : [];
    if (!filters.includes(filter)) stage.filters = [...filters, filter];
    const previousArea = stage.filterArea;
    // Keep texture pixels aligned with the canvas so the centre maps to the viewport centre.
    stage.filterArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
    const canvas = app.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? app.screen.width / rect.width : 1;
    const scaleY = rect.height ? app.screen.height / rect.height : 1;
    filter.setCenter((innerWidth / 2 - rect.left) * scaleX, (innerHeight / 2 - rect.top) * scaleY);
    return () => {
      const current = stage.filters ? (Array.isArray(stage.filters) ? stage.filters : [stage.filters]) : [];
      const rest = current.filter((item) => item !== filter);
      stage.filters = rest.length ? rest : null;
      stage.filterArea = previousArea;
    };
  }
  /** Resolves when the wave has finished on every canvas. Overlapping calls restart it. */
  function play(apps: (Application | undefined | null)[]) {
    const live = apps.filter((app): app is Application =>
      !!app?.renderer && app.renderer.type === RendererType.WEBGL && app.canvas.isConnected);
    if (!live.length) return Promise.resolve();
    const from = time;
    time = config.restartTime;
    return Promise.all(live.map((app) => new Promise<void>((resolve) => {
      const entry = target(app);
      if (entry.frame !== null) cancelAnimationFrame(entry.frame);
      entry.done?.();
      entry.done = resolve;
      entry.release ??= attach(entry);
      const start = performance.now();
      const step = () => {
        const progress = Math.min(1, (performance.now() - start) / config.durationMs);
        entry.filter.time = from + (config.endTime - from) * progress;
        // Stopped tickers (frozen scenes) still show the wave.
        if (!app.ticker.started) app.render();
        if (progress < 1) {
          entry.frame = requestAnimationFrame(step);
          return;
        }
        entry.frame = null;
        entry.release?.();
        entry.release = undefined;
        entry.filter.time = config.restartTime;
        if (!app.ticker.started) app.render();
        entry.done = undefined;
        resolve();
      };
      entry.frame = requestAnimationFrame(step);
    }))).then(() => undefined);
  }
  return { play };
}
