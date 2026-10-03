/* Foreground palette. Every entry is measured against --bg-hot (#482057), the
 * brightest point of the stage gradient, with the label halo composited in.
 * Contrast is a hard constraint, not a styling preference: the previous site
 * shipped colors that measured 1.00 against their own background.
 */

export interface Swatch {
  hex: string;
  /** Worst-case contrast against the lightest background pixel, halo included. */
  contrast: number;
}

const H = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const luminance = (rgb: [number, number, number]): number => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};

export const contrastRatio = (a: string, b: string): number => {
  const x = luminance(H(a));
  const y = luminance(H(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const composite = (fg: string, bg: string, alpha: number): string => {
  const f = H(fg);
  const b = H(bg);
  const mix = f.map((v, i) => Math.round(v * alpha + (1 - alpha) * b[i]));
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
};

/** The effective background behind a haloed label: halo over the lightest stage pixel. */
export const HALO_OVER_HOT = composite('#0d0a1f', '#482057', 0.85);

const HEXES = [
  '#ffffff',
  '#a8ff78',
  '#7cffcb',
  '#ffd9ec',
  '#ffe066',
  '#86e7a2',
  '#ff9e64',
  '#5ad1ff',
  '#ff6fa5',
  '#b388ff',
];

export const SWATCHES: Swatch[] = HEXES.map((hex) => ({
  hex,
  contrast: Number(contrastRatio(hex, HALO_OVER_HOT).toFixed(2)),
}));

/** Minimum over the palette — the number the self-check asserts on. */
export const MIN_CONTRAST = Math.min(...SWATCHES.map((s) => s.contrast));

export const BG_HOT = '#482057';
