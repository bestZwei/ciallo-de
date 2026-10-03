import { useEffect, useRef } from 'react';
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
        点屏幕的任何地方，她都会回应你。
        <br />
        点她本人，效果更明显。
      </p>
      <button className="gate-enter" type="button" ref={buttonRef} onClick={onEnter}>
        进入
      </button>
      <p className="gate-legal">角色素材版权归 Live2D Inc. 所有，详见页脚署名。</p>
    </div>
  );
};

export default WelcomeGate;
