import type { Bus } from './engine';
import { fetchSample, type Sample } from './source';

/**
 * Inside the gate a tap gets the synthesised blip only. One 1.2s phrase replayed on
 * every click is what made the old site sound like a jammed tape; the gate lets the
 * voice say a line and leaves the rhythm to the blip.
 */
const GATE_MS = 280;
const MAX_VOICES = 4;
/** ±3%: enough that twenty clicks are not bit-identical, short of a chipmunk. */
const RATES = [0.94, 1, 1.06];
const FADE_IN_S = 0.005;
const TAIL_S = 0.04;
const PREEMPT_S = 0.025;
const MAX_OFFSET_S = 0.06;

export type SpeechState = 'idle' | 'loading' | 'sample' | 'synth-only';

type Voice = { src: AudioBufferSourceNode; nodes: AudioNode[] };

const active: Voice[] = [];

let sample: Sample | null = null;
let state: SpeechState = 'idle';
let level: { peak: number; rms: number; duration: number } | null = null;
let loading: Promise<void> | null = null;
let lastSpeechAt = -Infinity;
let rateCursor = 0;

let played = 0;
let gated = 0;

/** The gate assertion: played should be about taps/GATE_MS×1000, not equal to taps. */
export const speechStats = () => ({ played, gated, active: active.length, state, level });

/** A decode that succeeds on silence would still leave the toy mute, so measure it. */
const measure = (buffer: AudioBuffer) => {
  const ch = buffer.getChannelData(0);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < ch.length; i++) {
    const v = ch[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, ch.length)), duration: buffer.duration };
};

/** Kicked off by the unlock gesture, so the decode is usually done by the first tap. */
export const prepare = (ctx: AudioContext): void => {
  if (loading) return;
  state = 'loading';
  loading = fetchSample(ctx).then((found) => {
    sample = found;
    level = found ? measure(found.buffer) : null;
    state = found ? 'sample' : 'synth-only';
  });
};

const remove = (voice: Voice) => {
  const k = active.indexOf(voice);
  if (k >= 0) active.splice(k, 1);
  voice.src.disconnect();
  for (const n of voice.nodes) n.disconnect();
};

const preemptOldest = (at: number) => {
  const oldest = active.shift();
  if (!oldest) return;
  const gain = oldest.nodes[0];
  if (gain instanceof GainNode) {
    gain.gain.cancelScheduledValues(at);
    gain.gain.setValueAtTime(gain.gain.value, at);
    gain.gain.linearRampToValueAtTime(0, at + PREEMPT_S);
  }
  /* Never an instant stop: cutting at an arbitrary phase of the waveform is a click. */
  oldest.src.stop(at + PREEMPT_S);
};

/**
 * Returns false when the phrase was withheld — either the gate is still closed or the
 * asset never decoded, in which case the caller's blip is the whole feedback sound.
 */
export const playSpeech = (bus: Bus, at: number): boolean => {
  if (!sample) return false;
  if (at - lastSpeechAt < GATE_MS) {
    gated++;
    return false;
  }
  lastSpeechAt = at;

  const { ctx } = bus;
  const now = ctx.currentTime;
  if (active.length >= MAX_VOICES) preemptOldest(now);

  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const rate = RATES[rateCursor++ % RATES.length];
  src.buffer = sample.buffer;
  src.playbackRate.value = rate;
  /* A few tens of milliseconds of head skip, so consecutive phrases do not start on
     the identical transient. */
  const offset = Math.random() * Math.min(MAX_OFFSET_S, sample.buffer.duration * 0.1);
  const duration = (sample.buffer.duration - offset) / rate;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.9, now + FADE_IN_S);
  gain.gain.setValueAtTime(0.9, now + Math.max(FADE_IN_S, duration - TAIL_S));
  gain.gain.linearRampToValueAtTime(0, now + duration);

  src.connect(gain);
  const nodes: AudioNode[] = [gain];
  let out: AudioNode = gain;
  if (typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 0.7 - 0.35;
    gain.connect(pan);
    nodes.push(pan);
    out = pan;
  }
  out.connect(bus.input);

  const voice: Voice = { src, nodes };
  src.onended = () => remove(voice);
  /* start() has to happen synchronously inside the gesture or iOS refuses the call.
     No scheduled stop: an unlooped buffer ends on its own, and preemption is the only
     case that needs one, so there is never a second stop call to reconcile. */
  src.start(now, offset);
  active.push(voice);
  played++;
  return true;
};
