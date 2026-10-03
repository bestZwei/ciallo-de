import { clamp } from '../lib/anim';
import type { Bus } from './engine';

/** Pentatonic walk capped at one octave: every step is consonant with the previous
    one, and the ceiling keeps a 50-combo burst from turning into a siren. */
const PENTATONIC = [0, 2, 4, 7, 9, 12];
const BASE_HZ = 523.25;
const MAX_BLIPS = 12;

type Voice = { gain: GainNode; src: OscillatorNode };

const active: Voice[] = [];

let blips = 0;
let chimes = 0;

export const blipStats = () => ({ blips, chimes, active: active.length });

const finish = (voice: Voice) => {
  const k = active.indexOf(voice);
  if (k >= 0) active.splice(k, 1);
  /* Explicit disconnect: an ended node stays in the graph until it is told to leave,
     which is how a node-graph leak looks on a long session. */
  voice.src.disconnect();
  voice.gain.disconnect();
};

const preemptOldest = (at: number) => {
  const oldest = active.shift();
  if (!oldest) return;
  oldest.gain.gain.cancelScheduledValues(at);
  oldest.gain.gain.setTargetAtTime(0, at, 0.008);
  oldest.src.stop(at + 0.03);
};

/**
 * Synthesised click tone. This is the guarantee that a tap is never silent: it needs
 * no asset, no decode and no network, so it survives whatever happens to the sample.
 */
export const playBlip = (bus: Bus, combo: number) => {
  const at = bus.ctx.currentTime;
  if (active.length >= MAX_BLIPS) preemptOldest(at);
  const osc = bus.ctx.createOscillator();
  const gain = bus.ctx.createGain();
  const semitone = PENTATONIC[clamp(combo - 1, 0, PENTATONIC.length - 1)];
  osc.type = 'triangle';
  osc.frequency.value = BASE_HZ * 2 ** (semitone / 12);
  /* Ramp in rather than step: a discontinuity at the head of every click is the
     "咔" the old hard-cut playback was known for. */
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.34, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.1);
  osc.connect(gain);
  gain.connect(bus.input);
  const voice: Voice = { gain, src: osc };
  osc.onended = () => finish(voice);
  osc.start(at);
  osc.stop(at + 0.12);
  active.push(voice);
  blips++;
};

/** Two-note rise for a combo threshold, long enough to be heard over the burst. */
export const playChime = (bus: Bus) => {
  const at = bus.ctx.currentTime;
  if (active.length >= MAX_BLIPS) preemptOldest(at);
  const osc = bus.ctx.createOscillator();
  const gain = bus.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(BASE_HZ * 2, at);
  osc.frequency.setValueAtTime(BASE_HZ * 3, at + 0.09);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.3, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.42);
  osc.connect(gain);
  gain.connect(bus.input);
  const voice: Voice = { gain, src: osc };
  osc.onended = () => finish(voice);
  osc.start(at);
  osc.stop(at + 0.45);
  active.push(voice);
  chimes++;
};
