import { onPointerDown, onPointerMove } from '../lib/input';
import { viewport } from '../lib/viewport';
import { MoodMachine, type Mood } from './mood';
import type { HitArea } from './live2d';

export type { HitArea, Mood };

export type Rect = { x: number; y: number; w: number; h: number };

/** Implemented by whichever layer currently owns a live character. */
export type CharacterBridge = {
  hitAreaAt(clientX: number, clientY: number): HitArea | null;
  focusAt(clientX: number, clientY: number, pinned: boolean): void;
  playMotion(area: HitArea): void;
  impact(strength: number): void;
  rect(): Rect;
};

export const moods = new MoodMachine();

let bridge: CharacterBridge | null = null;

export const setBridge = (next: CharacterBridge | null) => {
  bridge = next;
};

const moodListeners = new Set<(next: Mood, prev: Mood) => void>();

moods.onMood = (next, prev) => {
  for (const fn of moodListeners) fn(next, prev);
};

export const onMoodChange = (fn: (next: Mood, prev: Mood) => void): (() => void) => {
  moodListeners.add(fn);
  return () => void moodListeners.delete(fn);
};

/** Aim point for the keyboard path, and the anchor labels fly away from. */
export const characterCenter = (): { x: number; y: number } => {
  const r = bridge?.rect();
  return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: viewport().w / 2, y: viewport().h / 2 };
};

const nearCharacter = (x: number, y: number): boolean => {
  const r = bridge?.rect();
  if (!r) return false;
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy) < NEAR_PX * viewport().scale;
};

const NEAR_PX = 60;

export type TapNotification = {
  x: number;
  y: number;
  area: HitArea | null;
  combo: number;
  center: { x: number; y: number };
};

const tapListeners = new Set<(t: TapNotification) => void>();

export const onTap = (fn: (t: TapNotification) => void): (() => void) => {
  tapListeners.add(fn);
  return () => void tapListeners.delete(fn);
};

/** Shared by the pointer path and the keyboard stand-in so both produce one tap. */
export const dispatchTap = (x: number, y: number) => {
  const at = performance.now();
  const area = bridge?.hitAreaAt(x, y) ?? null;
  moods.tap(at, { onCharacter: area !== null, nearCharacter: nearCharacter(x, y) });
  if (area && bridge) {
    bridge.impact(Math.min(1, 0.45 + moods.combo * 0.05));
    bridge.playMotion(area);
  }
  const note: TapNotification = { x, y, area, combo: moods.combo, center: characterCenter() };
  for (const fn of tapListeners) fn(note);
};

/**
 * Character-side input wiring. The FX layer subscribes separately through
 * {@link onTap}, so a click that misses the character still gets feedback.
 */
export const attachCharacterInput = (): (() => void) => {
  moods.start(performance.now());

  const offMove = onPointerMove((p) => {
    moods.pointerMoved(performance.now());
    bridge?.focusAt(p.x, p.y, moods.gazePinned);
  });

  const offDown = onPointerDown((p) => dispatchTap(p.x, p.y));

  let raf = 0;
  const tick = () => {
    moods.tick(performance.now(), viewport().coarse);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    offMove();
    offDown();
    cancelAnimationFrame(raf);
  };
};
