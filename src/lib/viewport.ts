import { clamp } from './anim';

export type Viewport = {
  w: number;
  h: number;
  /** Continuous, so nothing snaps at an arbitrary breakpoint. */
  scale: number;
  /** Discrete escape hatch only for HUD collapsing. */
  tiny: boolean;
  /** Touch capability, deliberately decoupled from size. */
  coarse: boolean;
  /** Clamped: a 3x phone would otherwise triple fill-rate for no visible gain. */
  dpr: number;
};

const BASE_AREA = 1440 * 900;

const read = (): Viewport => {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  return {
    w,
    h,
    scale: clamp(Math.sqrt(w * h) / Math.sqrt(BASE_AREA), 0.55, 1.35),
    tiny: Math.min(w, h) < 400,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };
};

let current: Viewport = read();

/** The single writer of `--scale`; everything visual derives from it. */
const applyScale = (v: Viewport) =>
  document.documentElement.style.setProperty('--scale', v.scale.toFixed(4));

/* publish() only ever runs from a resize, so without this the first paint — and every
   paint in a session where nobody resizes — renders at the tokens.css default. */
applyScale(current);

const subscribers = new Set<(v: Viewport) => void>();

const coarseQuery = window.matchMedia('(pointer: coarse)');

let frame = 0;

const publish = () => {
  frame = 0;
  const next = read();
  const changed =
    next.w !== current.w ||
    next.h !== current.h ||
    next.scale !== current.scale ||
    next.tiny !== current.tiny ||
    next.coarse !== current.coarse ||
    next.dpr !== current.dpr;
  if (!changed) return;
  current = next;
  applyScale(next);
  for (const fn of subscribers) fn(next);
};

const schedule = () => {
  if (frame) return;
  frame = requestAnimationFrame(publish);
};

let attached = 0;

/**
 * Subscribe to viewport changes. Returns the unsubscribe.
 *
 * iOS reports the pre-rotation size on `orientationchange`, so that one event is
 * re-sampled after the layout has actually settled.
 */
export const watchViewport = (fn: (v: Viewport) => void): (() => void) => {
  if (attached++ === 0) {
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', () => setTimeout(schedule, 250));
    coarseQuery.addEventListener('change', schedule);
  }
  subscribers.add(fn);
  fn(current);
  return () => {
    subscribers.delete(fn);
    if (--attached === 0) {
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      coarseQuery.removeEventListener('change', schedule);
    }
  };
};

export const viewport = (): Viewport => current;
