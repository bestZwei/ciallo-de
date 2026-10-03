import { clamp, mulberry32 } from '../lib/anim';
import { keys, readJSON, writeJSON } from '../lib/storage';
import { SWATCHES } from '../palette';

export type Tier = 'full' | 'reduced' | 'compact';

/** Concurrency budgets. Slots beyond the cap let an evicted entry finish fading
    instead of popping; a burst that fills even the headroom pops whichever entry was
    closest to death, which is the most a fixed pool can honestly do. */
export const CAPS: Record<Tier, { particles: number; labels: number }> = {
  full: { particles: 900, labels: 64 },
  reduced: { particles: 420, labels: 32 },
  compact: { particles: 160, labels: 14 },
};

export const isValidTier = (t: unknown): t is Tier => typeof t === 'string' && t in CAPS;

/**
 * Shared by the FX pools and the character's render resolution, because a device that
 * was too slow for one is too slow for the other. An explicit `?tier=` is remembered;
 * the watchdog's automatic downgrade is not, so a single slow session cannot pin every
 * later visit to a lower tier.
 */
export const resolveTier = (): Tier => {
  const fromUrl = new URLSearchParams(location.search).get('tier');
  if (isValidTier(fromUrl)) {
    writeJSON(keys.forcedTier, fromUrl);
    return fromUrl;
  }
  const saved = readJSON<unknown>(keys.forcedTier, null);
  return isValidTier(saved) ? saved : 'full';
};

const HEADROOM = 1.5;
/** Remaining seconds handed to an entry once the soft cap pushes it out. */
const FADE_REMAIN = 0.15;
const FLAG_RING = 1;

export const COLOR_HEX = SWATCHES.map((s) => s.hex);

/** Signature line dominates; the short forms are punctuation inside the burst. */
export const TEXTS = ['Ciallo～(∠・ω< )⌒★', 'Ciallo～', 'お、お嬢様', '(∠・ω< )', 'Ciallo～？'];
const TEXT_CUMULATIVE = [0.5, 0.68, 0.83, 0.95, 1];

const MIN_FONT = 15;
const MAX_FONT = 34;
/** Sparks leave on this cadence, so trail density does not depend on refresh rate. */
const EMIT_MS = 60;

export type TapOptions = {
  reduced: boolean;
  scale: number;
};

export type Entry = {
  x: number;
  y: number;
  /** Seconds. */
  life: number;
  /** Shared channel: particle radius, or label font size, in CSS px. */
  dim: number;
  vx: number;
  vy: number;
  color: number;
  /** Ring marker for particles, text index for labels. */
  tag: number;
};

/**
 * One structure-of-arrays shape shared by both pools: particles ignore `nextEmit`
 * and `tag`, labels ignore `flags`. Carrying two unused channels costs a few kB and
 * saves the pools from drifting apart as separate near-copies. `life > 0` doubles as
 * the occupancy flag, so a free slot costs one float check.
 */
class Pool {
  cap: number;
  readonly size: number;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly dim: Float32Array;
  readonly nextEmit: Float32Array;
  readonly color: Uint8Array;
  readonly flags: Uint8Array;
  readonly tag: Uint8Array;

  live = 0;
  /** Counts every accepted click, including entries evicted before they were drawn. */
  spawned = 0;
  recycled = 0;
  /** Index of the most recent claim, so a probe can read back one click's entry. */
  newest = -1;
  private cursor = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.size = Math.max(1, Math.ceil(cap * HEADROOM));
    const n = this.size;
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.dim = new Float32Array(n);
    this.nextEmit = new Float32Array(n);
    this.color = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.tag = new Uint8Array(n);
  }

  spawn(s: Entry, ring: boolean) {
    const i = this.claim();
    this.spawned++;
    this.newest = i;
    this.life[i] = s.life;
    this.maxLife[i] = s.life;
    this.x[i] = s.x;
    this.y[i] = s.y;
    this.px[i] = s.x;
    this.py[i] = s.y;
    this.vx[i] = s.vx;
    this.vy[i] = s.vy;
    this.dim[i] = s.dim;
    this.color[i] = s.color;
    this.flags[i] = ring ? FLAG_RING : 0;
    this.tag[i] = s.tag;
    this.nextEmit[i] = EMIT_MS;
    return i;
  }

  /** Decays one entry; returns false once it is expired or was already free. */
  advance(p: number, dt: number): boolean {
    if (this.life[p] <= 0) return false;
    const left = this.life[p] - dt;
    if (left <= 0) {
      this.life[p] = 0;
      this.live--;
      return false;
    }
    this.life[p] = left;
    return true;
  }

  isRing(p: number): boolean {
    return (this.flags[p] & FLAG_RING) !== 0;
  }

  private claim(): number {
    const n = this.size;
    for (let k = 0; k < n; k++) {
      const slot = (this.cursor + k) % n;
      if (this.life[slot] > 0) continue;
      this.cursor = (slot + 1) % n;
      this.live++;
      this.fadeOldest();
      return slot;
    }
    let soonest = 0;
    let min = Infinity;
    for (let i = 0; i < n; i++) {
      if (this.life[i] < min) {
        min = this.life[i];
        soonest = i;
      }
    }
    this.recycled++;
    return soonest;
  }

  /**
   * The cursor marks the next slot to claim, so slots ahead of it were claimed
   * longest ago: walking forward reaches the oldest entries first. Past the soft cap
   * those oldest get a short remaining life, fading out on screen instead of
   * vanishing, and freeing up within FADE_REMAIN.
   */
  private fadeOldest() {
    let excess = this.live - this.cap;
    if (excess <= 0) return;
    const n = this.size;
    for (let k = 0; k < n - 1 && excess > 0; k++) {
      const slot = (this.cursor + k) % n;
      if (this.life[slot] <= FADE_REMAIN) continue;
      this.life[slot] = FADE_REMAIN;
      this.recycled++;
      excess--;
    }
  }

  reset() {
    this.life.fill(0);
    this.live = 0;
    this.spawned = 0;
    this.recycled = 0;
    this.cursor = 0;
  }
}

export type World = ReturnType<typeof createWorld>;

export const createWorld = (startTier: Tier) => {
  const particles = new Pool(CAPS[startTier].particles);
  const labels = new Pool(CAPS[startTier].labels);
  let spark = mulberry32(0x9e3779b9);
  let rand = mulberry32(0xc1a110);

  const pickColor = () => Math.floor(rand() * COLOR_HEX.length);

  const pickText = () => {
    const r = rand();
    for (let i = 0; i < TEXT_CUMULATIVE.length; i++) if (r < TEXT_CUMULATIVE[i]) return i;
    return 0;
  };

  const updateParticles = (dt: number, scale: number) => {
    const drag = Math.exp(-dt / 0.5);
    for (let i = 0; i < particles.size; i++) {
      if (!particles.advance(i, dt) || particles.isRing(i)) continue;
      particles.px[i] = particles.x[i];
      particles.py[i] = particles.y[i];
      particles.vx[i] *= drag;
      /* Buoyancy, not gravity: the burst rises as it fades, which reads as sparkle. */
      particles.vy[i] = particles.vy[i] * drag - 62 * scale * dt;
      particles.x[i] += particles.vx[i] * dt;
      particles.y[i] += particles.vy[i] * dt;
    }
  };

  const emitSparks = (from: number, opts: TapOptions) => {
    const count = 1 + Math.floor(spark() * 3);
    for (let k = 0; k < count; k++) {
      const a = spark() * Math.PI * 2;
      const v = (12 + spark() * 42) * opts.scale;
      particles.spawn(
        {
          x: labels.x[from],
          y: labels.y[from],
          life: 0.3 + spark() * 0.4,
          dim: (1 + spark() * 1.8) * opts.scale,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          color: labels.color[from],
          tag: 0,
        },
        false,
      );
    }
  };

  const updateLabels = (dt: number, opts: TapOptions) => {
    const drag = Math.exp(-dt / 0.55);
    for (let i = 0; i < labels.size; i++) {
      if (!labels.advance(i, dt)) continue;
      if (opts.reduced) continue;
      labels.px[i] = labels.x[i];
      labels.py[i] = labels.y[i];
      labels.vx[i] *= drag;
      labels.vy[i] = labels.vy[i] * drag - 26 * opts.scale * dt;
      labels.x[i] += labels.vx[i] * dt;
      labels.y[i] += labels.vy[i] * dt;
      labels.nextEmit[i] -= dt * 1000;
      if (labels.nextEmit[i] <= 0 && labels.life[i] > 0.25) {
        labels.nextEmit[i] = EMIT_MS;
        emitSparks(i, opts);
      }
    }
  };

  let tier = startTier;

  return {
    get tier() {
      return tier;
    },
    particles,
    labels,

    /**
     * Tightens both pools without reallocating, so live entries keep their remaining
     * life and fade out on screen instead of vanishing when the tier steps down.
     */
    setTier(next: Tier) {
      tier = next;
      particles.cap = CAPS[next].particles;
      labels.cap = CAPS[next].labels;
    },

    /** Feedback is never withheld: overflow is absorbed by the pool, not by a `return`. */
    spawnTap(x: number, y: number, combo: number, center: { x: number; y: number }, opts: TapOptions) {
      const { scale, reduced } = opts;
      const color = pickColor();

      particles.spawn(
        {
          x,
          y,
          life: 0.42,
          dim: (reduced ? 42 : combo >= 5 ? 74 : 34) * scale,
          vx: 0,
          vy: 0,
          color,
          tag: 0,
        },
        true,
      );

      if (!reduced) {
        const count = 3 + Math.min(combo, 10);
        for (let k = 0; k < count; k++) {
          const a = rand() * Math.PI * 2;
          const v = (55 + rand() * 130) * scale;
          particles.spawn(
            {
              x,
              y,
              life: 0.45 + rand() * 0.5,
              dim: (1.6 + rand() * 2.6) * scale,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              color,
              tag: 0,
            },
            false,
          );
        }
      }

      /* The label lands exactly under the pointer. The old site displaced it up to
         200px, which is the single reason clicks read as ignored. */
      const dim = reduced
        ? 19 * scale
        : clamp(19 * scale * (1 + Math.min(combo, 20) * 0.015), MIN_FONT * scale, MAX_FONT * scale);
      let vx = 0;
      let vy = 0;
      if (!reduced) {
        const a = Math.atan2(y - center.y, x - center.x) + (rand() - 0.5) * 0.52;
        const v = (60 + rand() * 50) * scale;
        vx = Math.cos(a) * v;
        vy = Math.sin(a) * v;
      }
      labels.spawn(
        { x, y, life: reduced ? 0.2 : 1.15, dim, vx, vy, color, tag: pickText() },
        false,
      );
    },

    update(dt: number, opts: TapOptions) {
      updateParticles(dt, opts.scale);
      updateLabels(dt, opts);
    },

    /** Seeded replay, so the self-check compares identical FX sequences. */
    reseed(seed: number) {
      rand = mulberry32(seed);
      spark = mulberry32(seed ^ 0x5bf03635);
    },

    reset() {
      particles.reset();
      labels.reset();
    },

    stats() {
      return {
        particles: { live: particles.live, spawned: particles.spawned, recycled: particles.recycled },
        labels: { live: labels.live, spawned: labels.spawned, recycled: labels.recycled },
      };
    },
  };
};
