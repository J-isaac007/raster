import { alpha, fromHsl, toHsl, type Color } from './color';

/**
 * Hue-shifted color ramps, as pixel artists build them: a run of shades from
 * dark to light where the darker steps lean toward a cool blue and the lighter
 * steps toward a warm yellow, instead of only mixing in black and white.
 */
export interface RampOptions {
  /** How many colors, base included. */
  steps: number;
  /** Degrees the hue turns at the darkest and lightest ends. */
  hueShift: number;
  /** Saturation added at the dark end and taken away at the light end, -1..1. */
  saturationShift: number;
  /** Lightness span from the darkest to the lightest step, 0..1. */
  lightRange: number;
}

export const DEFAULT_RAMP: RampOptions = {
  steps: 5,
  hueShift: 20,
  saturationShift: 0.1,
  lightRange: 0.6,
};

export const MIN_RAMP_STEPS = 3;
export const MAX_RAMP_STEPS = 12;

/** Where darker steps turn (blue) and lighter steps turn (yellow), as 0..1 hues. */
export const COOL_HUE = 2 / 3;
export const WARM_HUE = 1 / 6;

/** Darkest and lightest lightness a ramp reaches, so its ends aren't pure black or white. */
const DARKEST = 0.04;
const LIGHTEST = 0.96;

/** `h` moved up to `amount` (0..1 of the wheel) toward `target` the short way, without passing it. */
function turnToward(h: number, target: number, amount: number): number {
  let d = target - h;
  d -= Math.round(d); // shortest signed distance, -0.5..0.5
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}

/**
 * A ramp of `steps` colors from dark to light around `base`. The base itself
 * is one of the steps, unchanged, at the step whose lightness is nearest its
 * own; the others spread evenly over `lightRange`. Every step keeps the base's
 * alpha.
 */
export function makeRamp(base: Color, options: Partial<RampOptions> = {}): Color[] {
  const { steps, hueShift, saturationShift, lightRange } = { ...DEFAULT_RAMP, ...options };
  const n = Math.min(MAX_RAMP_STEPS, Math.max(MIN_RAMP_STEPS, Math.round(steps)));
  const range = Math.min(LIGHTEST - DARKEST, Math.max(0.01, lightRange));
  const [h, s, l] = toHsl(base);
  const a = alpha(base);

  // Center the span on the base, then slide it back inside the usable range.
  let lo = l - range / 2;
  let hi = l + range / 2;
  if (lo < DARKEST) [lo, hi] = [DARKEST, DARKEST + range];
  if (hi > LIGHTEST) [lo, hi] = [LIGHTEST - range, LIGHTEST];
  const lightness = (i: number) => lo + ((hi - lo) * i) / (n - 1);

  let baseIndex = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(lightness(i) - l) < Math.abs(lightness(baseIndex) - l)) baseIndex = i;
  }

  const gray = s === 0;
  const ramp: Color[] = [];
  for (let i = 0; i < n; i++) {
    if (i === baseIndex) {
      ramp.push(base);
      continue;
    }
    const li = lightness(i);
    // -1 at the dark end of the span, 1 at the light end, by distance from the base.
    const t = Math.max(-1, Math.min(1, (li - l) / (range / 2)));
    const target = t < 0 ? COOL_HUE : WARM_HUE;
    // A gray has no hue to turn, so it takes on the tint directly.
    const hue = gray ? target : turnToward(h, target, (hueShift / 360) * Math.abs(t));
    ramp.push(fromHsl(hue, s - saturationShift * t, li, a));
  }
  return ramp;
}

/**
 * `palette` with `ramp` put in, in order: in place of `base` when the palette
 * has it (so the darker steps come just before it and the lighter ones just
 * after), otherwise at the end. Repeats within the ramp are dropped, and when
 * the result would pass `max` colors the steps farthest from the base are
 * left out.
 */
export function insertRamp(palette: Color[], base: Color, ramp: Color[], max: number): Color[] {
  const steps = ramp.filter((c, i) => ramp.indexOf(c) === i);
  const at = palette.indexOf(base);
  const room = max - palette.length + (at >= 0 ? 1 : 0);
  const b = Math.max(0, steps.indexOf(base));
  let lo = 0;
  let hi = steps.length;
  while (hi - lo > Math.max(0, room)) {
    if (b - lo >= hi - 1 - b) lo++;
    else hi--;
  }
  const part = steps.slice(lo, hi);
  if (at < 0) return [...palette, ...part];
  return [...palette.slice(0, at), ...part, ...palette.slice(at + 1)];
}
