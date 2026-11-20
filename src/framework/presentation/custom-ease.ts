/**
 * Easing curves used by reference GSAP timelines.
 *
 * - Named eases follow GSAP: power1 = quad, power2 = cubic, power3 = quart, power4 = quint,
 *   with `.in`, `.out` and `.inOut` variants ("none"/"linear" is linear).
 * - Any other string is read as a GSAP CustomEase SVG path: "M0,0 C x1,y1 x2,y2 x,y ..."
 *   where every three points after `C` form one cubic Bézier segment and x is time (0..1).
 *   The curve may overshoot (y above 1), which is how a "drop with bounce" is authored.
 */
export type Ease = (progress: number) => number;

const POWER: Record<string, number> = { power1: 2, power2: 3, power3: 4, power4: 5 };

function namedEase(name: string): Ease | undefined {
  if (name === "none" || name === "linear") return (t) => t;
  const match = /^(power[1-4])\.(in|out|inOut)$/.exec(name);
  if (!match) return undefined;
  const p = POWER[match[1]];
  if (match[2] === "in") return (t) => t ** p;
  if (match[2] === "out") return (t) => 1 - (1 - t) ** p;
  return (t) => (t < 0.5 ? (2 * t) ** p / 2 : 1 - (2 * (1 - t)) ** p / 2);
}

interface Segment { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }

const bezier = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** Parse a GSAP CustomEase path into cubic segments. */
export function parseEasePath(path: string): Segment[] {
  const numbers = path.replace(/[MC]/gi, " ").trim().split(/[\s,]+/).map(Number);
  if (numbers.length < 8 || (numbers.length - 2) % 6 !== 0 || numbers.some((n) => !Number.isFinite(n)))
    throw new Error(`Invalid ease path: ${path}`);
  const segments: Segment[] = [];
  let x0 = numbers[0], y0 = numbers[1];
  for (let i = 2; i < numbers.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = numbers.slice(i, i + 6);
    segments.push({ x0, y0, x1, y1, x2, y2, x3, y3 });
    x0 = x3;
    y0 = y3;
  }
  return segments;
}

function pathEase(path: string): Ease {
  const segments = parseEasePath(path);
  return (progress) => {
    if (progress <= 0) return segments[0].y0;
    if (progress >= 1) return segments[segments.length - 1].y3;
    const segment = segments.find((s) => progress <= s.x3) ?? segments[segments.length - 1];
    // x(t) is monotonic for a time curve; solve it by bisection, then read y(t).
    let low = 0, high = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (bezier(segment.x0, segment.x1, segment.x2, segment.x3, mid) < progress) low = mid;
      else high = mid;
    }
    const t = (low + high) / 2;
    return bezier(segment.y0, segment.y1, segment.y2, segment.y3, t);
  };
}

/** Resolve a GSAP-style ease name or CustomEase path into a function of progress (0..1). */
export function resolveEase(spec: string): Ease {
  return namedEase(spec) ?? pathEase(spec);
}

/** True when `spec` is a supported ease, for config validation. */
export function isEaseSpec(spec: unknown): spec is string {
  if (typeof spec !== "string") return false;
  if (namedEase(spec)) return true;
  try {
    parseEasePath(spec);
    return true;
  } catch {
    return false;
  }
}
