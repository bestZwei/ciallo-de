import { clamp, expDamp } from '../lib/anim';
import type { MoodMachine } from './mood';

const LOOKUP = {
  eyeLOpen: 'ParamEyeLOpen',
  eyeROpen: 'ParamEyeROpen',
  eyeBallX: 'ParamEyeBallX',
  eyeBallY: 'ParamEyeBallY',
} as const;

/** The slice of Cubism's core model the rig touches. Keeps the casts in one place. */
export type CubismCoreModel = {
  getParameterValueByIndex(index: number): number;
  setParameterValueByIndex(index: number, value: number): void;
};

type Look = { [K in keyof typeof LOOKUP]: number };

const EYE_LEAD_CAP = 0.55;

export class CharacterRig {
  private fastX = 0;
  private fastY = 0;
  private mask = 1;
  private pulse = 0;
  private readonly look: Look;

  constructor(
    private readonly core: CubismCoreModel,
    resolveId: (id: string) => number,
    private readonly moods: MoodMachine,
  ) {
    this.look = Object.fromEntries(
      Object.entries(LOOKUP).map(([key, id]) => [key, resolveId(id)]),
    ) as Look;
  }

  /** Scale multiplier the host applies on top of the fitted base scale. */
  get scalePulse(): number {
    return 1 + this.pulse * 0.035;
  }

  impact(strength: number) {
    this.pulse = clamp(strength, 0, 1);
  }

  /**
   * Runs after motion, expression, physics and pose have written, immediately
   * before the core evaluates the frame. The rig reads what the framework produced
   * and scales it, so an expression keeps owning the eye level while the rig owns
   * only the closed/open mask.
   */
  update(dt: number, head: { x: number; y: number }, target: { x: number; y: number }) {
    this.fastX = expDamp(this.fastX, target.x, dt, 90);
    this.fastY = expDamp(this.fastY, target.y, dt, 90);
    this.addLead(this.look.eyeBallX, this.fastX - head.x);
    this.addLead(this.look.eyeBallY, this.fastY - head.y);
    this.applyLidMask(dt);
    this.pulse = expDamp(this.pulse, 0, dt, 90);
  }

  /**
   * The library's spring drives the head, which is what the hair physics reads, so
   * the head is left to it. Damping a second copy toward the same target and adding
   * only the difference produces "pupils move first, head catches up".
   */
  private addLead(index: number, delta: number) {
    if (index < 0) return;
    const base = this.core.getParameterValueByIndex(index);
    this.core.setParameterValueByIndex(index, clamp(base + clamp(delta, -EYE_LEAD_CAP, EYE_LEAD_CAP), -1.2, 1.2));
  }

  /**
   * Mao's motions bake their own blinks — mtn_01 closes both lids twice per its 5.57s
   * loop — so a rig-scheduled blink on top measured one every ~1.6s. The animation owns
   * the blink; this only scales it, which is what leaves drowsy half-lidded and asleep
   * shut without fighting the curve that produced the eye.
   */
  private applyLidMask(dt: number) {
    this.mask = expDamp(this.mask, this.moods.lidMask, dt, 110);
    const factor = clamp(this.mask, 0, 1);
    for (const index of [this.look.eyeLOpen, this.look.eyeROpen]) {
      if (index < 0) continue;
      this.core.setParameterValueByIndex(index, this.core.getParameterValueByIndex(index) * factor);
    }
  }
}
