import { useEffect, useRef, useState } from 'react';
import { clamp } from '../lib/anim';
import { t } from '../i18n';
import { publishProbe } from '../lib/devflag';
import { resolveTier } from '../fx/world';
import { watchViewport } from '../lib/viewport';
import { CharacterRig, type CubismCoreModel } from './rig';
import { MAO_CENTER_FIX, MAO_MODEL_URL, MOOD_EXPRESSION, MOOD_MOTION, loadLive2D, type HitArea } from './live2d';
import { dispatchTap, moods, onMoodChange, setBridge, type CharacterBridge, type Rect } from './controller';
import './Live2DStage.css';

type CoreModel = CubismCoreModel & { getParameterIndex(id: string): number };

/** Only the members this component touches, so an upstream type change surfaces as
    one cast rather than page-wide fallout. */
type LiveModel = {
  x: number;
  y: number;
  scale: { x: number; y: number; set: (v: number) => void };
  focus: (x: number, y: number) => void;
  hitTest: (x: number, y: number) => string[];
  motion: (group: string) => unknown;
  expression: (id?: string) => unknown;
  destroy: (options?: unknown) => void;
  internalModel: {
    /** Natural size at scale 1; the library applies no centering offset for Mao. */
    width: number;
    height: number;
    coreModel: CoreModel;
    focusController: { x: number; y: number; targetX: number; targetY: number };
    on: (event: string, fn: () => void) => unknown;
    off: (event: string, fn: () => void) => unknown;
  };
};

type PixiApp = {
  stage: { addChild: (child: unknown) => void };
  view: HTMLCanvasElement;
  renderer: { resize: (w: number, h: number) => void };
  destroy: (removeView: boolean, options?: unknown) => void;
};

/** Loads nothing until the browser is idle, so the first paint never waits on 3.7 MB. */
const deferLoad = (fn: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 300);
  return () => window.clearTimeout(id);
};

const asHitArea = (value: string | undefined): HitArea | null =>
  value === 'head' || value === 'body' ? value : null;

const Live2DStage = () => {
  const figureRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = figureRef.current;
    if (!host) return;

    let dead = false;
    let model: LiveModel | null = null;
    let app: PixiApp | null = null;
    let rig: CharacterRig | null = null;
    let baseScale = 1;
    let unwatch = () => {};
    let lastNow = performance.now();
    let rect = host.getBoundingClientRect();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const headVec = { x: 0, y: 0 };
    const targetVec = { x: 0, y: 0 };
    let box = { w: 1, h: 1 };

    /** The stage is position:fixed and the page never scrolls, so the host rect only
        changes on a viewport event — never read it per frame. */
    const refreshRect = () => {
      rect = host.getBoundingClientRect();
      box = {
        w: Math.max(1, Math.round(rect.width)),
        h: Math.max(1, Math.round(rect.height)),
      };
      return box;
    };

    /** The scale and position of the drawn box belong to this function alone. */
    const place = () => {
      if (!model) return;
      const natural = model.internalModel;
      baseScale = Math.min(box.w / natural.width, box.h / natural.height);
      const s = baseScale * (reduced.matches ? 1 : (rig?.scalePulse ?? 1));
      model.scale.set(s);
      model.x = (box.w - natural.width * s) / 2 + box.w * MAO_CENTER_FIX.x;
      model.y = (box.h - natural.height * s) / 2 + box.h * MAO_CENTER_FIX.y;
    };

    const bridge: CharacterBridge = {
      hitAreaAt: (clientX, clientY) =>
        model ? asHitArea(model.hitTest(clientX - rect.left, clientY - rect.top)[0]) : null,
      focusAt: (clientX, clientY, pinned) => {
        if (!model) return;
        if (pinned) model.focus(rect.width / 2, rect.height / 2);
        else model.focus(clientX - rect.left, clientY - rect.top);
      },
      playMotion: (area) => model?.motion(MOOD_MOTION[area]),
      impact: (strength) => {
        if (reduced.matches) return;
        rig?.impact(strength);
      },
      rect: (): Rect => {
        if (!model) {
          const { w, h } = refreshRect();
          return { x: rect.left, y: rect.top, w, h };
        }
        return {
          x: rect.left + model.x,
          y: rect.top + model.y,
          w: model.internalModel.width * model.scale.x,
          h: model.internalModel.height * model.scale.y,
        };
      },
    };

    const applyMood = () => {
      const id = MOOD_EXPRESSION[moods.mood];
      if (id) model?.expression(id);
    };

    const onBeforeUpdate = () => {
      if (!model || !rig) return;
      const now = performance.now();
      const dt = clamp(now - lastNow, 0, 50);
      lastNow = now;
      const fc = model.internalModel.focusController;
      if (reduced.matches) {
        headVec.x = 0;
        headVec.y = 0;
        targetVec.x = 0;
        targetVec.y = 0;
      } else {
        headVec.x = fc.x;
        headVec.y = fc.y;
        targetVec.x = fc.targetX;
        targetVec.y = fc.targetY;
      }
      rig.update(dt, headVec, targetVec);
      place();
    };

    const boot = async () => {
      let pixiApp: PixiApp | null = null;
      try {
        const { PIXI, Live2DModel } = await loadLive2D();
        if (dead) return;
        const { w, h } = refreshRect();
        pixiApp = new PIXI.Application({
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: true,
          sharedTicker: true,
          resolution: resolveTier() === 'compact' ? 1 : clamp(window.devicePixelRatio || 1, 1, 2),
          powerPreference: 'high-performance',
        }) as unknown as PixiApp;

        const live = (await Live2DModel.from(MAO_MODEL_URL, {
          autoInteract: false,
        })) as unknown as LiveModel;
        if (dead) {
          live.destroy();
          pixiApp.destroy(true);
          return;
        }

        model = live;
        app = pixiApp;
        pixiApp.stage.addChild(live);
        host.append(pixiApp.view);

        const core = live.internalModel.coreModel;
        rig = new CharacterRig(core, (id) => core.getParameterIndex(id), moods);
        place();
        live.internalModel.on('beforeModelUpdate', onBeforeUpdate);
        applyMood();
        setBridge(bridge);
        publishProbe({ pixi: PIXI, app: pixiApp, model: live, rig, moods });
        setStatus('ready');

        unwatch = watchViewport(() => {
          const next = refreshRect();
          app?.renderer.resize(next.w, next.h);
          place();
        });
      } catch (err) {
        if (dead) return;
        pixiApp?.destroy(true);
        console.error('[ciallo] Live2D stage failed to load', err);
        setStatus('failed');
      }
    };

    const cancel = deferLoad(boot);
    const offMood = onMoodChange(applyMood);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      const r = host.getBoundingClientRect();
      dispatchTap(r.left + r.width / 2, r.top + r.height * 0.35);
    };
    host.addEventListener('keydown', onKeyDown);

    return () => {
      dead = true;
      host.removeEventListener('keydown', onKeyDown);
      cancel();
      offMood();
      unwatch();
      setBridge(null);
      model?.internalModel.off('beforeModelUpdate', onBeforeUpdate);
      // removeView=true detaches only the canvas Pixi created. The figure element
      // renders no React children, so this cannot desynchronise the tree.
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [attempt]);

  return (
    <div className="l2d-host">
      <div
        className="l2d-figure"
        data-state={status}
        ref={figureRef}
        role="img"
        tabIndex={0}
        aria-label={t().figureAria}
      />
      {status === 'loading' && <span className="l2d-hint" aria-hidden="true">Ciallo～</span>}
      {status === 'failed' && (
        <button
          className="l2d-retry"
          type="button"
          data-no-spawn
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t().loadFailed}
        </button>
      )}
    </div>
  );
};

export default Live2DStage;
