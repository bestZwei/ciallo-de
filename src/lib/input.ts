export type PointerSample = {
  /** Client space, never page space: iOS collapses the address bar and pageY drifts. */
  x: number;
  y: number;
};

type Handler = (p: PointerSample) => void;

const downHandlers = new Set<Handler>();
const moveHandlers = new Set<Handler>();

/** Handlers run synchronously inside {@link emit}, so one reused sample keeps a 500Hz
    pointer off the allocator. Store the coordinates if you need them later. */
const sample: PointerSample = { x: 0, y: 0 };

const emit = (set: Set<Handler>, e: PointerEvent) => {
  sample.x = e.clientX;
  sample.y = e.clientY;
  for (const fn of set) fn(sample);
};

/**
 * The only place pointer events are bound. Anything that wants clicks subscribes
 * here instead of adding its own listener, so there is exactly one coordinate
 * source and exactly one "do not respond" rule.
 */
export const attachPointerSource = (root: HTMLElement): (() => void) => {
  // `click` + `touchstart` double-binding is what made the old site fire twice or
  // zero times depending on cancelability; pointer events alone are unambiguous.
  const onDown = (e: PointerEvent) => {
    // HUD, dialogs and links opt out by name. Every other path must produce
    // feedback — silently dropping a click is the failure mode being designed out.
    if ((e.target as Element | null)?.closest?.('[data-no-spawn]')) return;
    emit(downHandlers, e);
  };
  const onMove = (e: PointerEvent) => emit(moveHandlers, e);

  // Capturing so a child calling stopPropagation cannot starve the stage.
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    root.removeEventListener('pointerdown', onDown, true);
    root.removeEventListener('pointermove', onMove);
  };
};

export const onPointerDown = (fn: Handler): (() => void) => {
  downHandlers.add(fn);
  return () => void downHandlers.delete(fn);
};

export const onPointerMove = (fn: Handler): (() => void) => {
  moveHandlers.add(fn);
  return () => void moveHandlers.delete(fn);
};
