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
      <p className="hud-readout">
        <span className="hud-num" ref={comboRef}>
          0
        </span>
        <span className="hud-cap">{strings.combo}</span>
        <span className="hud-best">
          {strings.best} <span ref={bestRef}>0</span>
        </span>
      </p>
      <div className="hud-controls">
        {hasWebAudio() && (
          <button
            className="hud-mute"
            type="button"
            aria-pressed={muted}
            aria-label={muted ? strings.soundOff : strings.soundOn}
            onClick={() => setMuted(toggleMuted())}
          >
            <SpeakerIcon muted={muted} />
          </button>
        )}
        <LanguageSwitch />
      </div>
      <p className="sr-only" aria-live="polite" ref={liveRef} />
    </div>
  );
};

/** State has to read at 20px, so the waves and the cross are different shapes rather
    than two shades of the same glyph. Text is carried by aria-label instead. */
const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    {muted ? (
      <path
        d="M16.5 9.5l5 5m0-5l-5 5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
    ) : (
      <path
        d="M16 9.5a4 4 0 0 1 0 5m2.8-7.5a7.5 7.5 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        fill="none"
      />
    )}
  </svg>
);

export default Hud;
