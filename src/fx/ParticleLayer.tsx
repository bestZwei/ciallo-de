import { useEffect, useRef } from 'react';
import { median } from '../lib/anim';
import { onTap } from '../character/controller';
import { SELF_CHECK, publishProbe } from '../lib/devflag';
import { viewport, watchViewport } from '../lib/viewport';
import { buildGlowSprites, renderWorld } from './draw';
import { createWorld, resolveTier, type Tier } from './world';
import './ParticleLayer.css';

const ORDER: Tier[] = ['full', 'reduced', 'compact'];
/** Sample window. One second of drawn frames at 60fps. */
const WINDOW = 64;
/** Our own share of the frame budget before the tier steps down. */
const SLOW_MS = 8;
const COOLDOWN_MS = 3000;

/**
 * The click-feedback layer: one canvas, one rAF loop, no allocation per click.
 * Slots live in `world.ts`; this file only owns the surface and the clock.
 */
const ParticleLayer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const halo = styles.getPropertyValue('--label-halo').trim() || 'rgba(13,10,31,0.85)';
    const fontFamily = styles.getPropertyValue('--font-stack').trim() || 'system-ui,sans-serif';

    const world = createWorld(resolveTier());
    const sprites = buildGlowSprites();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 1;
    let height = 1;
    /* Re-applied only when the backing store changes size, so the frame loop never
       reads layout or resets the transform. */
    const stopWatching = watchViewport((v) => {
      width = Math.max(1, Math.round(v.w));
      height = Math.max(1, Math.round(v.h));
      canvas.width = Math.round(width * v.dpr);
      canvas.height = Math.round(height * v.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    });

    const tapOpts = { reduced: reduced.matches, scale: viewport().scale };
    const renderOpts = { width, height, fontFamily, halo, glow: world.tier !== 'compact' };

    let raf = 0;
    let last = performance.now();
    /** Set after any visible frame so the final empty state gets one clearRect. */
    let needsClear = false;

    /* The watchdog measures the work this layer does, not the interval between frames:
       an interval metric would blame a 30Hz display for being a 30Hz display. */
    const samples: number[] = [];
    let slowWindows = 0;
    let lastShiftAt = 0;

    const noteWork = (ms: number, now: number) => {
      samples.push(ms);
      if (samples.length < WINDOW) return;
      const mid = median(samples);
      samples.length = 0;
      /* Two consecutive windows: one collection pause is not a trend. */
      slowWindows = mid >= SLOW_MS ? slowWindows + 1 : 0;
      if (slowWindows < 2) return;
      slowWindows = 0;
      if (now - lastShiftAt < COOLDOWN_MS) return;
      const next = ORDER[ORDER.indexOf(world.tier) + 1];
      if (!next) return;
      lastShiftAt = now;
      world.setTier(next);
      renderOpts.glow = next !== 'compact';
    };

    /** Update plus draw — the part that has a budget, and the part the probe times. */
    const work = (dt: number, now: number): number => {
      tapOpts.reduced = reduced.matches;
      tapOpts.scale = viewport().scale;
      renderOpts.width = width;
      renderOpts.height = height;
      const start = performance.now();
      world.update(dt, tapOpts);
      renderWorld(ctx, world, sprites, renderOpts);
      needsClear = true;
      const ms = performance.now() - start;
      noteWork(ms, now);
      return ms;
    };

    /* Only filled under ?selfcheck. Kept separate from the watchdog window because the
       probe wants percentiles over a stretch of frames, not one median per 64. */
    const frameTimes: number[] = [];

    const frame = (now: number) => {
      /* Clamp: a restored background tab reports dt in whole seconds, which would
         teleport every live entry off screen in a single step. */
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const alive = world.particles.live > 0 || world.labels.live > 0;
      if (alive) {
        const ms = work(dt, now);
        if (SELF_CHECK && frameTimes.length < 600) frameTimes.push(ms);
      } else if (needsClear) {
        ctx.clearRect(0, 0, width, height);
        needsClear = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const offTap = onTap((t) => {
      world.spawnTap(t.x, t.y, t.combo, t.center, tapOpts);
    });

    if (SELF_CHECK) {
      publishProbe({
        fx: world,
        stats: () => world.stats(),
        step: (dt: number) => work(dt, performance.now()),
        drainFrames: () => {
          const s = frameTimes.slice();
          frameTimes.length = 0;
          return s;
        },
        spawnTap: (x: number, y: number, combo: number) =>
          world.spawnTap(x, y, combo, { x: viewport().w / 2, y: viewport().h / 2 }, tapOpts),
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      offTap();
      stopWatching();
    };
  }, []);

  return <canvas className="fx" ref={canvasRef} aria-hidden="true" />;
};

export default ParticleLayer;
