import { onTap } from '../character/controller';
import { isThreshold } from '../character/mood';
import { SELF_CHECK, publishProbe } from '../lib/devflag';
import { blipStats, playBlip, playChime } from './blip';
import { currentBus, ensure, outputLevel } from './engine';
import { playSpeech, prepare, speechStats } from './voice';

/**
 * Audio cannot be unlocked from the first-visit dialog alone: returning visitors get
 * no dialog, so a dialog-only path would leave them permanently silent. These two
 * capture-phase listeners are idempotent and cover every gesture, including the ones
 * on controls that deliberately do not spawn particles.
 */
export const attachAudioCues = (): (() => void) => {
  const unlock = () => {
    const bus = ensure();
    if (bus) prepare(bus.ctx);
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  const offTap = onTap((t) => {
    const bus = ensure();
    if (!bus) return;
    /* Everything below runs synchronously inside the gesture: iOS will not start a
       source that was scheduled from a later frame. */
    playSpeech(bus, performance.now());
    playBlip(bus, t.combo);
    if (isThreshold(t.combo)) playChime(bus);
  });

  if (SELF_CHECK) {
    publishProbe({
      audio: () => ({
        ctx: currentBus()?.ctx.state ?? 'none',
        speech: speechStats(),
        blip: blipStats(),
        output: outputLevel(),
      }),
    });
  }

  return () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    offTap();
  };
};
