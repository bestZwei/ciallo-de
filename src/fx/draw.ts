import { COLOR_HEX, TEXTS, type World } from './world';

/** Bright core ends at this fraction of the sprite radius. */
const CORE_STOP = 0.28;
/** Sprite diameter, as a multiple of particle radius, that puts the core at ~1 radius. */
const GLOW_SPAN = 1 / (CORE_STOP / 2);
const TAU = Math.PI * 2;

const rgba = (hex: string, alpha: number): string =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;

/**
 * Glow is prebaked once per palette entry instead of using `ctx.shadowBlur`, which
 * costs roughly ten times more and is the easiest way to blow the frame budget.
 * OffscreenCanvas is not available in every engine we target, so this uses a canvas
 * detached from the DOM.
 */
export const buildGlowSprites = (px = 64): HTMLCanvasElement[] =>
  COLOR_HEX.map((hex) => {
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const g = c.getContext('2d');
    if (!g) return c;
    const r = px / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(CORE_STOP, rgba(hex, 0.8));
    grad.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, px, px);
    return c;
  });

const fonts = new Map<number, string>();

/** Per-label font strings would be ~4k short strings a second; sizes recur, so cache. */
const fontFor = (px: number, family: string): string => {
  const key = Math.round(px * 2) / 2;
  let s = fonts.get(key);
  if (s === undefined) {
    s = `${key}px ${family}`;
    fonts.set(key, s);
  }
  return s;
};

export type RenderOptions = {
  width: number;
  height: number;
  fontFamily: string;
  halo: string;
  /** Off on the lowest tier: the sprite is the widest thing we paint per particle. */
  glow: boolean;
};

export const renderWorld = (
  ctx: CanvasRenderingContext2D,
  world: World,
  sprites: HTMLCanvasElement[],
  opts: RenderOptions,
) => {
  ctx.clearRect(0, 0, opts.width, opts.height);
  const { particles, labels } = world;

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.size; i++) {
    const life = particles.life[i];
    if (life <= 0) continue;
    const fade = life / particles.maxLife[i];
    const hex = COLOR_HEX[particles.color[i]];
    const rest = particles.dim[i];

    if (particles.isRing(i)) {
      const p = 1 - fade;
      ctx.globalAlpha = fade * fade * 0.9;
      ctx.strokeStyle = hex;
      ctx.lineWidth = Math.max(1, rest * 0.1 * fade);
      ctx.beginPath();
      /* Expands fast then settles, which is what makes the impact read as a hit. */
      ctx.arc(particles.x[i], particles.y[i], rest * (0.25 + 0.75 * (1 - p * p * p)), 0, TAU);
      ctx.stroke();
      continue;
    }

    /* Segment, not point: a dot per frame strobes at 30fps, a streak does not. */
    ctx.globalAlpha = fade < 0.35 ? fade / 0.35 : 1;
    ctx.strokeStyle = hex;
    ctx.lineWidth = Math.max(0.6, rest * 0.9);
    ctx.beginPath();
    ctx.moveTo(particles.px[i], particles.py[i]);
    ctx.lineTo(particles.x[i], particles.y[i]);
    ctx.stroke();
    if (opts.glow) {
      const d = rest * GLOW_SPAN;
      ctx.drawImage(sprites[particles.color[i]], particles.x[i] - d / 2, particles.y[i] - d / 2, d, d);
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  for (let i = 0; i < labels.size; i++) {
    const life = labels.life[i];
    if (life <= 0) continue;
    const px = labels.dim[i];
    const p = 1 - life / labels.maxLife[i];
    ctx.globalAlpha = p < 0.08 ? p / 0.08 : p > 0.65 ? (1 - p) / 0.35 : 1;
    ctx.font = fontFor(px, opts.fontFamily);
    const text = TEXTS[labels.tag[i]];
    /* Halo first, every time. Contrast is guaranteed by this plate, never by luck. */
    ctx.lineWidth = Math.max(3, px * 0.24);
    ctx.strokeStyle = opts.halo;
    ctx.strokeText(text, labels.x[i], labels.y[i]);
    ctx.fillStyle = COLOR_HEX[labels.color[i]];
    ctx.fillText(text, labels.x[i], labels.y[i]);
  }
  ctx.globalAlpha = 1;
};
