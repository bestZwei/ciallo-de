/**
 * Gates the page-internal verification probe. Enabled by query parameter rather
 * than build mode so the same assertions can run against a deployed artifact.
 */
export const SELF_CHECK =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('selfcheck');

export type ProbeHandles = {
  pixi: unknown;
  app: unknown;
  model: unknown;
  rig: unknown;
  moods: unknown;
  fx: unknown;
  stats: () => unknown;
  spawnTap: (x: number, y: number, combo: number) => void;
  /** One update+draw of the FX layer, so cost can be timed without a frame. */
  step: (dt: number) => void;
  /** Durations of frames the real rAF loop drew since the last drain. */
  drainFrames: () => number[];
  audio: () => unknown;
};

declare global {
  interface Window {
    __ciallo?: Partial<ProbeHandles>;
  }
}

export const publishProbe = (handles: Partial<ProbeHandles>) => {
  if (!SELF_CHECK) return;
  window.__ciallo = { ...window.__ciallo, ...handles };
};
