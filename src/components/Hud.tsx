import { useEffect, useRef, useState } from 'react';
import { hasWebAudio, isMuted, toggleMuted } from '../audio/engine';
import { t } from '../i18n';
import { moods, onMoodChange, onTap } from '../character/controller';
import { isThreshold } from '../character/mood';
import { keys, readJSON, writeJSON } from '../lib/storage';
import LanguageSwitch from './LanguageSwitch';
import './Hud.css';

/**
 * Combo and best are written through refs, not state: a burst is a dozen discrete
 * events a second, and re-rendering the tree for each one is exactly how the old site
 * lost clicks. React still owns the structure; only the numbers move.
 */
const Hud = () => {
  const strings = t();
  const comboRef = useRef<HTMLSpanElement>(null);
  const bestRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [muted, setMuted] = useState(isMuted);

  useEffect(() => {
    let best = readJSON<number>(keys.comboBest, 0);
    const comboEl = comboRef.current;
    const bestEl = bestRef.current;
    const liveEl = liveRef.current;
    if (!comboEl || !bestEl || !liveEl) return;
    bestEl.textContent = String(best);

    const offTap = onTap((t) => {
      comboEl.textContent = String(t.combo);
      if (t.combo > best) {
        best = t.combo;
        bestEl.textContent = String(best);
        writeJSON(keys.comboBest, best);
      }
      /* Announce thresholds only. A live region that updates on every click turns the
         whole screen into a stream of numbers for a screen-reader user. */
      if (isThreshold(t.combo)) liveEl.textContent = strings.comboAnnounce(t.combo);
    });

    const offMood = onMoodChange(() => {
      if (moods.combo === 0) {
        comboEl.textContent = '0';
        liveEl.textContent = '';
      }
    });

    return () => {
      offTap();
      offMood();
    };
  }, []);

  return (
    <div className="hud" data-no-spawn>
      <p className="hud-combo">
        <span className="hud-num" ref={comboRef}>
          0
        </span>
        <span className="hud-cap">{strings.combo}</span>
      </p>
      <p className="hud-best">
        {strings.best} <span ref={bestRef}>0</span>
      </p>
      {hasWebAudio() && (
        <button
          className="hud-mute"
          type="button"
          aria-pressed={muted}
          onClick={() => setMuted(toggleMuted())}
        >
          {muted ? strings.soundOff : strings.soundOn}
        </button>
      )}
      <LanguageSwitch />
      <p className="sr-only" aria-live="polite" ref={liveRef} />
    </div>
  );
};

export default Hud;
