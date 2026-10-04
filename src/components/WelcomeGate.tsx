import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import './WelcomeGate.css';

type Props = {
  onEnter: () => void;
};

/**
 * Shown once. The audio unlock deliberately does not live here: returning visitors
 * never see this, and an unlock tied to the dialog would leave them permanently
 * silent. `cue.ts` unlocks from any gesture instead.
 */
const WelcomeGate = ({ onEnter }: Props) => {
  const strings = t();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEnter();
        return;
      }
      /* One focusable element, so wrapping is just holding focus on it. */
      if (e.key === 'Tab') {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onEnter]);

  return (
    <div className="gate" data-no-spawn role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <p className="gate-title" id="gate-title">
        {'Ciallo～(∠・ω< )⌒★'}
      </p>
      <p className="gate-note">
        {strings.gateNote[0]}
        <br />
        {strings.gateNote[1]}
      </p>
      <button className="gate-enter" type="button" ref={buttonRef} onClick={onEnter}>
        {strings.gateEnter}
      </button>
      <p className="gate-legal">{strings.gateLegal}</p>
    </div>
  );
};

export default WelcomeGate;
