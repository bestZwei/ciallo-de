export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/**
 * Frame-rate independent approach. dt and tau share units, so a 240Hz tab and a
 * throttled 30Hz tab converge in the same wall-clock time. The naive
 * `x += (t - x) * 0.15` is not: it slows down exactly when frames drop, which is
 * what reads as "not keeping up with the mouse".
 */
export const expDamp = (current: number, target: number, dt: number, tau: number): number =>
  tau <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / tau));

/** Seedable so the self-check can replay an identical FX sequence. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Median of a sorted-able sample; used by the frame-time watchdog. */
export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[clamp(Math.round((p / 100) * (s.length - 1)), 0, s.length - 1)];
};
