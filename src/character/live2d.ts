import type { Mood } from './mood';

export const CUBISM_CORE_URL = '/live2d/live2dcubismcore.min.js';
export const MAO_MODEL_URL = '/live2d/mao/mao_pro.model3.json';

export type HitArea = 'head' | 'body';

/**
 * Expressions are chosen so the rig's lid mask stays authoritative. exp_01 writes
 * `ParamEyeLOpen = 1 Multiply`, which is a no-op, so the eyes are open exactly as far as
 * the mask allows and the blink stays visible; exp_03 writes `0 Multiply`, which closes
 * them outright and would swallow every blink and every drowsy half-lid. Measured: with
 * exp_03 on idle, 149 of 150 frames had her eyes shut. Only happy (^_^) and the wide
 * startle touch the lids, and both are transient.
 */
export const MOOD_EXPRESSION: Record<Mood, string | null> = {
  boot: 'exp_04',
  idle: 'exp_01',
  happy: 'exp_02',
  surprised: 'exp_07',
  drowsy: 'exp_01',
  asleep: 'exp_01',
  wake: 'exp_01',
};

export const MOOD_MOTION: Record<HitArea, string> = {
  head: 'TapHead',
  body: 'TapBody',
};

/**
 * Mao's bounding box is the union of every drawable, which is not where her visible
 * art sits: measured against the drawn alpha centroid she lands 36px left and 14px
 * above the centre of a 340x456 frame. Stored as frame fractions so the correction
 * scales with the model instead of becoming a magic pixel count.
 */
export const MAO_CENTER_FIX = { x: 0.106, y: -0.031 };

export type Live2DBundle = {
  PIXI: typeof import('pixi.js');
  Live2DModel: typeof import('pixi-live2d-display/cubism4').Live2DModel;
};

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

let corePromise: Promise<void> | null = null;

/**
 * Injected rather than tagged into index.html: it is 207 KB and would block the
 * first paint on a file the visitor does not see yet.
 */
const loadCubismCore = (): Promise<void> => {
  if (window.Live2DCubismCore) return Promise.resolve();
  return (corePromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = CUBISM_CORE_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      corePromise = null;
      reject(new Error('Live2D Cubism Core failed to load'));
    };
    document.head.append(el);
  }));
};

let bundlePromise: Promise<Live2DBundle> | null = null;

/**
 * The whole Live2D stack is reached through this one dynamic import, so it lands in
 * its own chunk and the entry bundle stays what it was.
 */
export const loadLive2D = (): Promise<Live2DBundle> => {
  return (bundlePromise ??= loadCubismCore()
    .then(() => Promise.all([import('pixi.js'), import('pixi-live2d-display/cubism4')] as const))
    .then(([PIXI, cubism4]) => {
      // Required because the ESM build cannot see a global PIXI to grab Ticker from.
      cubism4.Live2DModel.registerTicker(PIXI.Ticker);
      return { PIXI, Live2DModel: cubism4.Live2DModel };
    })
    .catch((err: unknown) => {
      bundlePromise = null;
      throw err;
    }));
};
