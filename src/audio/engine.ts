import { SELF_CHECK } from '../lib/devflag';
import { keys, readJSON, writeJSON } from '../lib/storage';

type ContextCtor = typeof AudioContext;
type WebkitWindow = Window & { webkitAudioContext?: ContextCtor };

/** Fixed output trim: the pieces peak near unity and 0.22 keeps the compressor idle. */
const MASTER_TRIM = 0.22;

export type Bus = {
  ctx: AudioContext;
  /** Every voice connects here; mute and volume live on it. */
  input: GainNode;
};

let bus: Bus | null = null;

/** Present only under `?selfcheck`: proof that samples reached the output, not just a graph. */
let meter: AnalyserNode | null = null;
let meterData: Float32Array<ArrayBuffer> | null = null;

export const outputLevel = (): { peak: number; rms: number } | null => {
  if (!meter || !meterData) return null;
  meter.getFloatTimeDomainData(meterData);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < meterData.length; i++) {
    const v = meterData[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / meterData.length) };
};

let muted = readJSON<boolean>(keys.muted, false);

const ctor = (): ContextCtor | undefined =>
  window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;

const applyGain = (ctx: AudioContext, gain: GainNode) => {
  /* setTargetAtTime rather than gain.value = 0: cutting at an arbitrary phase of the
     waveform is a click, and mute is the one action users expect to be silent. */
  gain.gain.setTargetAtTime(muted ? 0 : MASTER_TRIM, ctx.currentTime, 0.02);
};

const publishState = () => {
  /* Recorded, not retried: a context suspended from outside cannot be resumed without
     a gesture, and a retry loop is how a tab ends up buzzing and draining battery. */
  if (bus) document.documentElement.dataset.audio = bus.ctx.state;
};

/**
 * Must be called from inside a user gesture. Creating the context eagerly would show
 * Chrome a suspended tab and claim a hardware audio stream for nothing.
 */
export const ensure = (): Bus | null => {
  if (bus) {
    // iOS drops the context to suspended on system interruption; resume only when the
    // visitor is already touching something, never from a retry loop.
    if (bus.ctx.state !== 'running') void bus.ctx.resume().catch(() => {});
    return bus;
  }
  const C = ctor();
  if (!C) return null;
  try {
    const ctx = new C();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 24;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    const input = ctx.createGain();
    input.connect(comp);
    if (SELF_CHECK) {
      const tap = ctx.createAnalyser();
      tap.fftSize = 2048;
      meterData = new Float32Array(tap.fftSize);
      comp.connect(tap);
      tap.connect(ctx.destination);
      meter = tap;
    } else {
      comp.connect(ctx.destination);
    }
    applyGain(ctx, input);
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    bus = { ctx, input };
    ctx.addEventListener('statechange', publishState);
    publishState();
    return bus;
  } catch {
    return null;
  }
};

export const currentBus = (): Bus | null => bus;

export const hasWebAudio = (): boolean => ctor() !== undefined;

export const isMuted = (): boolean => muted;

export const setMuted = (next: boolean): boolean => {
  muted = next;
  writeJSON(keys.muted, next);
  if (bus) applyGain(bus.ctx, bus.input);
  return muted;
};

export const toggleMuted = (): boolean => setMuted(!muted);

/**
 * Suspends on hide so a background tab does not keep mixing, and resumes when the
 * visitor comes back — a resume outside a gesture is allowed once the context has
 * already been unlocked by one.
 */
export const attachAudioLifecycle = (): (() => void) => {
  const onVisibility = () => {
    if (!bus) return;
    const wanted = document.visibilityState === 'hidden' ? bus.ctx.suspend() : bus.ctx.resume();
    void wanted.catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
};
