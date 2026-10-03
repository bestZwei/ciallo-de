export type Mood = 'boot' | 'idle' | 'happy' | 'surprised' | 'drowsy' | 'asleep' | 'wake';

/** Higher wins when two triggers land in the same frame. */
const PRIORITY: Record<Mood, number> = {
  idle: 0,
  drowsy: 1,
  asleep: 1,
  happy: 2,
  surprised: 3,
  wake: 4,
  boot: 5,
};

const DURATIONS: Record<Mood, number> = {
  boot: 900,
  idle: Infinity,
  happy: 900,
  surprised: 700,
  drowsy: 1200,
  asleep: Infinity,
  wake: 420,
};

/** Combo values that earn a jolt and an announcement. Every click would be noise. */
export const COMBO_THRESHOLDS: readonly number[] = [5, 10, 20, 50];

/** Pure function of the combo, so consumers need no callback ordering guarantees. */
export const isThreshold = (combo: number): boolean => COMBO_THRESHOLDS.includes(combo);

const COMBO_GAP_MS = 700;
const IDLE_TO_DROWSY_FINE = 12000;
const IDLE_TO_DROWSY_COARSE = 8000;
const DROWSY_TO_ASLEEP = 3000;

const happyDuration = (combo: number) => Math.min(900 + Math.min(combo, 5) * 140, 1600);

export class MoodMachine {
  private state: Mood = 'boot';
  private expiresAt = Infinity;
  private lastPointerAt = 0;
  private lastTapAt = 0;

  combo = 0;

  onMood: ((next: Mood, prev: Mood) => void) | null = null;

  get mood(): Mood {
    return this.state;
  }

  /** Startled or entering eyes look wrong when cross-eyed by pointer tracking. */
  get gazePinned(): boolean {
    return this.state === 'surprised' || this.state === 'boot';
  }

  /** Multiplier the rig layers on top of whatever the expression opened to. */
  get lidMask(): number {
    switch (this.state) {
      case 'asleep':
        return 0;
      case 'drowsy':
        return 0.25;
      default:
        return 1;
    }
  }

  start(at: number) {
    this.lastPointerAt = at;
    this.lastTapAt = at;
    this.set('boot', at, DURATIONS.boot);
  }

  pointerMoved(at: number) {
    this.lastPointerAt = at;
    this.onInput(at);
  }

  tap(at: number, opts: { onCharacter: boolean; nearCharacter: boolean }) {
    this.lastPointerAt = at;
    this.combo = at - this.lastTapAt < COMBO_GAP_MS ? this.combo + 1 : 1;
    this.lastTapAt = at;

    if (isThreshold(this.combo)) {
      this.set('surprised', at, 900);
      return;
    }

    this.onInput(at);
    if (this.state === 'asleep' || this.state === 'wake') return;

    if (opts.onCharacter) this.set('happy', at, happyDuration(this.combo));
    else if (opts.nearCharacter) this.set('surprised', at, DURATIONS.surprised);
  }

  /** Call every frame; owns the drowsy → asleep fall-off and all expiries. */
  tick(at: number, coarse: boolean) {
    if (at >= this.expiresAt) {
      if (this.state === 'drowsy') this.set('asleep', at, DURATIONS.asleep);
      else if (this.state === 'wake') this.set('idle', at, DURATIONS.idle);
      else if (this.state !== 'asleep' && this.state !== 'idle') {
        this.combo = 0;
        this.set('idle', at, DURATIONS.idle);
      }
    }
    if (this.state === 'idle' || this.state === 'boot') {
      const quiet = at - Math.max(this.lastPointerAt, this.lastTapAt);
      const limit = coarse ? IDLE_TO_DROWSY_COARSE : IDLE_TO_DROWSY_FINE;
      if (quiet >= limit) this.set('drowsy', at, DROWSY_TO_ASLEEP);
    }
  }

  private onInput(at: number) {
    if (this.state === 'asleep' || this.state === 'drowsy') {
      this.combo = 0;
      this.set('wake', at, DURATIONS.wake);
      return;
    }
    if (at >= this.expiresAt && this.state !== 'idle' && this.state !== 'boot') {
      this.combo = 0;
      this.set('idle', at, DURATIONS.idle);
    }
  }

  /** Late arrivals replace the target outright — a queue would just be input lag.
      A live higher-priority mood is never downgraded by a lower-priority trigger. */
  private set(next: Mood, at: number, duration: number) {
    const prev = this.state;
    if (prev !== next && at < this.expiresAt && PRIORITY[next] < PRIORITY[prev]) return;
    this.state = next;
    this.expiresAt = Number.isFinite(duration) ? at + duration : Infinity;
    if (prev !== next) this.onMood?.(next, prev);
  }
}
