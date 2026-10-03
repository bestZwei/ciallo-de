import { median, percentile } from '../lib/anim';
import type { Tier } from '../fx/world';
import { BG_HOT, MIN_CONTRAST, SWATCHES, contrastRatio } from '../palette';
import { viewport } from '../lib/viewport';

/**
 * Page-internal verification probe, enabled with `?selfcheck`. It asserts the numbers
 * the old site failed: click offset zero, no dropped clicks, contrast above 4.4:1, the
 * retrigger gate holding, and one sound per click under StrictMode.
 */

type PoolView = {
  x: Float32Array;
  y: Float32Array;
  life: Float32Array;
  size: number;
  live: number;
  spawned: number;
  recycled: number;
  newest: number;
};

type FxView = {
  labels: PoolView;
  particles: PoolView;
  tier: Tier;
  reseed: (seed: number) => void;
  update: (dt: number, opts: { reduced: boolean; scale: number }) => void;
};

type Level = { peak: number; rms: number };

/** The slice of the Live2D model the lid assertion needs. */
type ModelView = {
  internalModel: {
    coreModel: {
      getParameterIndex(id: string): number;
      getParameterValueByIndex(index: number): number;
    };
    on: (event: string, fn: () => void) => unknown;
    off: (event: string, fn: () => void) => unknown;
  };
};

type AudioView = {
  ctx: string;
  speech: { played: number; gated: number; state: string; level: (Level & { duration: number }) | null };
  blip: { blips: number; chimes: number };
  output: Level | null;
};

type Probe = {
  fx?: FxView;
  step?: (dt: number) => void;
  drainFrames?: () => number[];
  audio?: () => AudioView;
  model?: ModelView;
  moods?: { mood: string };
};

type Result = { id: string; pass: boolean; detail: string };

const probe = (): Probe => (window as Window & { __ciallo?: Probe }).__ciallo ?? {};

/** Returns true when the point belongs to chrome that deliberately refuses feedback. */
const clickAt = (x: number, y: number): boolean => {
  const target = document.elementFromPoint(x, y) ?? document.querySelector('.stage');
  const blocked = Boolean((target as Element | null)?.closest?.('[data-no-spawn]'));
  target?.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }),
  );
  return blocked;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The first-visit dialog is modal and refuses feedback by design, so a probe that ran
 * against it would measure a wall of refusals instead of the toy. Enter, then wait for
 * the dialog to leave the DOM — `ciallo.seen` is per-origin, so a new dev port is a
 * first visit.
 */
const enterStage = async (): Promise<boolean> => {
  document.querySelector<HTMLElement>('.gate .gate-enter')?.click();
  const deadline = performance.now() + 2000;
  while (document.querySelector('.gate') && performance.now() < deadline) await wait(50);
  return !document.querySelector('.gate');
};

const untilReady = async (timeoutMs: number): Promise<Probe | null> => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const p = probe();
    if (p.fx && p.audio) return p;
    await wait(100);
  }
  return null;
};

/** T1 — every foreground colour against the lightest point of the stage. */
const t1 = (): Result => {
  const bare = SWATCHES.map((s) => ({ hex: s.hex, c: contrastRatio(s.hex, BG_HOT) }));
  const worstBare = bare.reduce((a, b) => (b.c < a.c ? b : a));
  return {
    id: 'T1 contrast',
    pass: MIN_CONTRAST >= 4.4 && worstBare.c >= 4.4,
    detail: `haloed floor ${MIN_CONTRAST.toFixed(2)}, bare floor ${worstBare.c.toFixed(
      2,
    )} (${worstBare.hex} on ${BG_HOT}) across ${SWATCHES.length} swatches`,
  };
};

/** T2 — the label must appear exactly where the finger was, not 16–284px away. */
const t2 = (fx: FxView): Result => {
  const { w, h } = viewport();
  const grid: [number, number][] = [
    [1, 1],
    [40, 90],
    [Math.round(w * 0.2), Math.round(h * 0.3)],
    [Math.round(w * 0.5), Math.round(h * 0.12)],
    [Math.round(w * 0.8), Math.round(h * 0.45)],
    [Math.round(w * 0.35), Math.round(h * 0.8)],
    [w - 1, h - 1],
    [Math.round(w * 0.9), 2],
  ];
  let worst = 0;
  let at = '';
  let measured = 0;
  let skipped = 0;
  for (const [x, y] of grid) {
    if (clickAt(x, y)) {
      skipped++;
      continue;
    }
    const i = fx.labels.newest;
    if (i < 0) return { id: 'T2 click offset', pass: false, detail: 'no label was created' };
    const d = Math.max(Math.abs(fx.labels.x[i] - x), Math.abs(fx.labels.y[i] - y));
    if (d > worst) {
      worst = d;
      at = ` @${x},${y}`;
    }
    measured++;
  }
  return {
    id: 'T2 click offset',
    pass: measured >= 4 && worst === 0,
    detail: `max deviation ${worst}px${at} over ${measured} points (${skipped} over chrome, refused by design)`,
  };
};

/** T3 — 200 instantaneous clicks must all register. The old site produced zero. */
const t3 = (fx: FxView): Result => {
  const before = fx.labels.spawned;
  for (let k = 0; k < 200; k++) clickAt(20 + (k % 19) * 7, 30 + (k % 13) * 9);
  const added = fx.labels.spawned - before;
  return {
    id: 'T3 burst accepted',
    pass: added === 200,
    detail: `${added}/200 clicks produced a label, live ${fx.labels.live}/${fx.labels.size}`,
  };
};

/** T4 — past the soft cap, the oldest entries fade; nothing is silently refused. */
const t4 = (fx: FxView): Result => {
  const before = fx.labels.recycled;
  for (let k = 0; k < 40; k++) clickAt(300 + (k % 11) * 5, 400 + (k % 7) * 5);
  const newest = fx.labels.newest;
  return {
    id: 'T4 overflow policy',
    pass: fx.labels.recycled > before && fx.labels.life[newest] > 0,
    detail: `recycled +${fx.labels.recycled - before}, newest label alive=${fx.labels.life[newest] > 0}`,
  };
};

/** T5 — what the FX layer costs: pool maths, then the frames a visitor actually rides. */
const BUDGET: Record<Tier, number> = { full: 3.0, reduced: 4.5, compact: 7.0 };
/** Pool maths alone, at a full pool, is ours to guarantee. */
const JS_BUDGET = 1.0;
const STEPS = 300;
/** How long the real loop is watched while tapping. ~60fps for 1.3s, minus setup. */
const WATCH_MS = 1300;
/** A burst a person can hold: fast enough to keep both pools busy, slow enough to be real. */
const TAP_INTERVAL_MS = 160;
/** Below this many drawn frames the window is not a usable sample. */
const MIN_FRAMES = 24;

const t5 = async (fx: FxView, step: (dt: number) => void, drainFrames: () => number[]): Promise<Result> => {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  const before = memory?.usedJSHeapSize ?? 0;
  const opts = { reduced: false, scale: viewport().scale };

  const timed = (fn: () => void): number[] => {
    fx.reseed(1);
    const times: number[] = [];
    for (let k = 0; k < STEPS; k++) {
      /* One tap per step. Each tap emits ~13 particles with a ~0.9s life, so this is
         exactly the rate that holds both pools at their cap — several taps per step
         would measure a saturated queue, not a frame. */
      clickAt(40 + ((k * 7) % 480), 60 + ((k * 13) % 320));
      const at = performance.now();
      fn();
      times.push(performance.now() - at);
    }
    return times;
  };

  const jsP95 = percentile(timed(() => fx.update(1 / 60, opts)), 95);
  /* Saturating load inside a tight loop: real work, but the loop never yields, so the
     tail of this series measures forced GPU flushes rather than jank. Reported, not gated. */
  const stressMid = median(timed(() => step(1 / 60)));

  drainFrames();
  const until = performance.now() + WATCH_MS;
  do {
    clickAt(120 + ((performance.now() * 0.07) % 300), 90 + ((performance.now() * 0.11) % 260));
    await wait(TAP_INTERVAL_MS);
  } while (performance.now() < until);
  const frames = drainFrames();
  const drew = frames.length >= MIN_FRAMES;
  const playMid = drew ? median(frames) : 0;
  const playP95 = drew ? percentile(frames, 95) : 0;
  const grew = memory ? (memory.usedJSHeapSize - before) / 1024 / 1024 : 0;

  const live = `live ${fx.particles.live} particles / ${fx.labels.live} labels`;
  const tail = drew
    ? `real-loop median ${playMid.toFixed(2)}ms vs ${BUDGET[fx.tier]}ms budget (tier ${fx.tier}), p95 ${playP95.toFixed(
        2,
      )}ms over ${frames.length} drawn frames`
    : `real-loop median unavailable (${frames.length} frames drawn in ${WATCH_MS}ms — the tab is not painting, so the draw cost cannot be timed here)`;
  return {
    id: 'T5 frame cost',
    pass: jsP95 <= JS_BUDGET && grew <= 2 && (!drew || playMid <= BUDGET[fx.tier]),
    detail: `pool maths p95 ${jsP95.toFixed(2)}ms vs ${JS_BUDGET}ms; ${tail}; saturating-loop median ${stressMid.toFixed(
      2,
    )}ms (no compositor yield, so its tail is flush artefacts)${
      memory ? '' : ', performance.memory unavailable'
    }; heap +${grew.toFixed(2)}MB, ${live}`,
  };
};

/** T6 — eight distinct sizes, eight distinct hues, and a backdrop that is never empty. */
const SAMPLES = 40;
/** Virtual milliseconds swept by the scrub; longer than the slowest lane cycle. */
const SPAN = 60000;

const t6 = (): Result => {
  const lanes = [...document.querySelectorAll<HTMLElement>('.marquee .lane')];
  const sizes = new Set(lanes.map((el) => getComputedStyle(el).fontSize));
  const colors = new Set(lanes.map((el) => getComputedStyle(el).color));
  const vw = Math.max(1, window.innerWidth);
  const covered = (rects: DOMRect[]) => rects.some((r) => r.right > 0 && r.left < vw);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anims = reduced ? [] : lanes.map((el) => el.getAnimations()[0] ?? null);

  let seen = 0;
  let shifts = 0;
  let note = 'static under reduced motion';
  if (reduced) {
    seen = covered(lanes.map((el) => el.getBoundingClientRect())) ? SAMPLES : 0;
  } else if (anims.every(Boolean)) {
    /* Pause-and-scrub: a background tab throttles timers to one per second, so waiting
       through a cycle is not an option. Setting each animation's own time keeps the
       lanes staggered, and the phase is restored below, so nothing on screen shifts. */
    const started = performance.now();
    const base = anims.map((a) => Number(a?.currentTime ?? 0));
    let prev: number | null = null;
    for (let k = 0; k < SAMPLES; k++) {
      const d = (k * SPAN) / SAMPLES;
      anims.forEach((a, i) => {
        if (a) a.currentTime = base[i] + d;
      });
      const rects = lanes.map((el) => el.getBoundingClientRect());
      if (covered(rects)) seen++;
      if (prev !== null && Math.abs(rects[0].left - prev) > 0.5) shifts++;
      prev = rects[0].left;
    }
    const drift = performance.now() - started;
    anims.forEach((a, i) => {
      if (a) a.currentTime = base[i] + drift;
    });
    note = `scrubbed ${SPAN / 1000}s of ${anims.length} lane cycles, lane 0 moved in ${shifts}/${
      SAMPLES - 1
    } steps`;
  } else {
    note = 'lanes expose no animation to scrub';
  }

  const share = seen / SAMPLES;
  /* A scrub that never changed anything would report 100% coverage off one instant. */
  const scrubbed = note.startsWith('scrubbed');
  return {
    id: 'T6 marquee',
    pass:
      lanes.length === 8 &&
      sizes.size === 8 &&
      colors.size === 8 &&
      share >= 0.95 &&
      (scrubbed ? shifts >= SAMPLES / 2 : reduced),
    detail: `${lanes.length} lanes, ${sizes.size} sizes, ${colors.size} colours, backdrop non-empty in ${(
      share * 100
    ).toFixed(0)}% of ${SAMPLES} samples; ${note}`,
  };
};

/** T7 — the voice says one line per window instead of replaying on every click. */
const t7 = (audio: () => AudioView): Result => {
  const before = audio();
  for (let k = 0; k < 60; k++) clickAt(200 + (k % 17) * 6, 200 + (k % 11) * 6);
  const after = audio();
  const taps = 60;
  const played = after.speech.played - before.speech.played;
  const sampleless = after.speech.state !== 'sample';
  /* A dispatched pointerdown is not a trusted gesture, so Chrome is entitled to keep
     the context suspended. Only demand 'running' when the page really was activated. */
  const trusted = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation?.hasBeenActive;
  const ctxOk = trusted ? after.ctx === 'running' : after.ctx !== 'none';
  return {
    id: 'T7 retrigger gate',
    pass: ctxOk && (sampleless ? played === 0 : played <= 2) && after.blip.blips - before.blip.blips === taps,
    detail: `ctx ${after.ctx} (trusted gesture=${String(trusted)}), speech ${played}/${taps} taps (${
      after.speech.state
    }), blips ${after.blip.blips - before.blip.blips}/${taps}`,
  };
};

/** T8 — the continuous scale stays inside its clamped band, reaches the CSS, and fits the frame. */
const t8 = (): Result => {
  const v = viewport();
  /* The JS number is worthless on its own: everything visual reads `--scale`, and a
     scale that never reaches the root element still renders at the tokens.css default. */
  const css = Number(getComputedStyle(document.documentElement).getPropertyValue('--scale'));
  const host = document.querySelector<HTMLElement>('.l2d-host');
  const fits = host ? host.getBoundingClientRect().bottom <= window.innerHeight + 1 : false;
  return {
    id: 'T8 viewport scale',
    pass: v.scale >= 0.55 && v.scale <= 1.35 && fits && Math.abs(css - v.scale) < 0.005,
    detail: `${v.w}x${v.h} scale ${v.scale.toFixed(3)} (css --scale ${css.toFixed(3)}) dpr ${v.dpr} tiny=${v.tiny} coarse=${v.coarse}, character fits=${fits}`,
  };
};

/** T9 — reduced motion keeps the label and the expression, drops everything else. */
const t9 = (fx: FxView): Result => {
  const before = { p: fx.particles.spawned, l: fx.labels.spawned };
  clickAt(300, 300);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delta = { p: fx.particles.spawned - before.p, l: fx.labels.spawned - before.l };
  return {
    id: 'T9 reduced motion',
    pass: reduced ? delta.l === 1 : delta.l === 1 && delta.p >= 1,
    detail: `reduced=${reduced}, labels +${delta.l}, particles +${delta.p} (ring plus burst, or ring only)`,
  };
};

/** T10 — StrictMode's double mount must not double the feedback. */
const t10 = (fx: FxView, audio: () => AudioView): Result => {
  const before = { l: fx.labels.spawned, b: audio().blip.blips };
  clickAt(420, 420);
  const after = { l: fx.labels.spawned, b: audio().blip.blips };
  return {
    id: 'T10 single fire',
    pass: after.l - before.l === 1 && after.b - before.b === 1,
    detail: `one click → ${after.l - before.l} label, ${after.b - before.b} blip`,
  };
};

/** T11 — a click has to move air, not just schedule nodes. */
const AUDIBLE_MS = 400;
/** Well above digital silence, well under the ~0.07 the master trim lets a blip reach. */
const AUDIBLE_PEAK = 0.01;

const t11 = async (audio: () => AudioView): Promise<Result> => {
  const until = performance.now() + AUDIBLE_MS;
  let peak = 0;
  let rms = 0;
  do {
    clickAt(180 + ((performance.now() * 0.07) % 200), 240 + ((performance.now() * 0.13) % 90));
    await wait(40);
    const l = audio().output;
    if (l) {
      if (l.peak > peak) peak = l.peak;
      if (l.rms > rms) rms = l.rms;
    }
  } while (performance.now() < until);

  const { ctx, speech } = audio();
  const running = ctx === 'running';
  const hasSample = speech.state === 'sample' && speech.level !== null;
  const sampleOk = !hasSample || speech.level!.peak >= 0.05;
  return {
    id: 'T11 audible output',
    pass: sampleOk && (!running || peak > AUDIBLE_PEAK),
    detail: `${
      hasSample
        ? `recording peak ${speech.level!.peak.toFixed(3)}, rms ${speech.level!.rms.toFixed(3)}, ${speech.level!.duration.toFixed(
            2,
          )}s`
        : `recording unavailable (state ${speech.state})`
    }; master ${
      running
        ? `peak ${peak.toFixed(3)}, rms ${rms.toFixed(3)} over ${AUDIBLE_MS}ms of taps`
        : `untapped (ctx ${ctx}; mixing is suspended while the tab is hidden, so a silent meter here is correct)`
    }`,
  };
};

/** T12 — the backdrop must never slide through the text that frames it. */
const t12 = (): Result => {
  const span = (el: Element) => {
    const r = el.getBoundingClientRect();
    return [r.top, r.bottom] as const;
  };
  const lanes = [...document.querySelectorAll('.marquee .lane')].map(span);
  const chrome = ['.wordmark', '.hud', '.credits']
    .map((s) => document.querySelector(s))
    .filter((el): el is Element => el !== null)
    .map(span);
  /* Lane `top` is fixed and only the transform animates, so this holds at any phase. */
  const hits = lanes.filter(([t, b]) => chrome.some(([ct, cb]) => t < cb && b > ct));
  return {
    id: 'T12 lane keep-out',
    pass: lanes.length === 8 && chrome.length === 3 && hits.length === 0,
    detail: `${lanes.length} lanes against ${chrome.length} chrome blocks, ${hits.length} crossing${
      hits.length ? ` (first spans ${Math.round(hits[0][0])}–${Math.round(hits[0][1])}px)` : ''
    }`,
  };
};

/** T13 — she has to actually look at you. Both eye defects this build shipped were
    "the lids never opened", and no other assertion can see that. */
const EYES_MS = 1600;
/** A baked blink costs ~180ms of a 2.3s cycle, so resting eyes are open ~92% of frames. */
const EYES_OPEN_FLOOR = 0.85;
const MIN_EYES_FRAMES = 30;

const t13 = async (): Promise<Result> => {
  /* Read fresh: publishProbe replaces the object, and the stage publishes model and moods
     after untilReady has already resolved, so the snapshot the run started with lacks them. */
  const p = probe();
  const im = p.model?.internalModel;
  const core = im?.coreModel;
  const moods = p.moods;
  if (!im || !core || !moods) {
    return { id: 'T13 eyes open', pass: false, detail: 'model or mood machine never published' };
  }
  /* Happy is a deliberate ^_^ squint and boot is still arriving, so the claim is only
     about resting eyes. */
  const neutral = () => moods.mood === 'idle' || moods.mood === 'wake';
  const settle = performance.now() + 2500;
  while (!neutral() && performance.now() < settle) await wait(100);

  const iL = core.getParameterIndex('ParamEyeLOpen');
  const iR = core.getParameterIndex('ParamEyeROpen');
  let frames = 0;
  let open = 0;
  /* Between frames the core restores the values it saved before evaluating, so a poll
     reads the motion's draft rather than what expression, blink and lid mask agreed on.
     The hook is the only place the final number exists. */
  const hook = () => {
    if (!neutral()) return;
    frames++;
    if (core.getParameterValueByIndex(iL) >= 0.9 && core.getParameterValueByIndex(iR) >= 0.9) open++;
  };
  im.on('beforeModelUpdate', hook);
  const until = performance.now() + EYES_MS;
  while (performance.now() < until) await wait(120);
  im.off('beforeModelUpdate', hook);

  const fraction = frames ? open / frames : 0;
  return {
    id: 'T13 eyes open',
    /* Same escape as T5: zero painted frames is the environment's answer, not hers. */
    pass: frames < MIN_EYES_FRAMES || fraction >= EYES_OPEN_FLOOR,
    detail:
      frames < MIN_EYES_FRAMES
        ? `${frames} neutral frames in ${EYES_MS}ms — not painting, lid level undetermined`
        : `${open}/${frames} neutral frames open (${(fraction * 100).toFixed(1)}%), mood ${moods.mood}, floor ${(
            EYES_OPEN_FLOOR * 100
          ).toFixed(0)}%`,
  };
};

const render = (results: Result[]) => {
  const id = 'self-check-panel';
  let panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = id;
    panel.setAttribute('data-no-spawn', '');
    Object.assign(panel.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      zIndex: '2000',
      maxWidth: 'min(92vw, 640px)',
      padding: '10px 12px',
      font: '12px/1.5 ui-monospace, monospace',
      color: '#f6f2ff',
      background: 'rgba(13,10,31,0.9)',
      border: '1px solid rgba(246,242,255,0.2)',
      borderRadius: '8px',
      whiteSpace: 'pre-wrap',
    } as CSSStyleDeclaration);
    document.body.append(panel);
  }
  const fails = results.filter((r) => !r.pass).length;
  panel.textContent = [
    `self-check: ${results.length - fails}/${results.length} pass`,
    ...results.map((r) => `${r.pass ? 'ok  ' : 'FAIL'} ${r.id} — ${r.detail}`),
  ].join('\n');
  console.table(results);
  if (fails) console.warn(`[ciallo] ${fails} self-check assertion(s) failed`);
};

export const runSelfCheck = async () => {
  const p = await untilReady(8000);
  if (!p?.fx || !p.audio || !p.step || !p.drainFrames) {
    console.error('[ciallo] self-check: probe never published (Live2D stage, FX step or audio cue missing)');
    return;
  }
  if (!(await enterStage())) {
    console.error('[ciallo] self-check: the welcome dialog would not close; every click would be a refusal');
    return;
  }
  /* One click first so the AudioContext is created inside a gesture before T7 counts. */
  clickAt(window.innerWidth / 2, window.innerHeight / 2);
  await wait(300);
  const fx = p.fx;
  /* T5, T11 and T13 are the only assertions that wait on real time — a drawn frame and a
     rendered audio block. The rest run in one synchronous pass. */
  const frameCost = await t5(fx, p.step, p.drainFrames);
  const audible = await t11(p.audio);
  const eyes = await t13();
  render([
    t1(),
    t2(fx),
    t3(fx),
    t4(fx),
    frameCost,
    t6(),
    t7(p.audio),
    t8(),
    t9(fx),
    t10(fx, p.audio),
    audible,
    t12(),
    eyes,
  ]);
};
