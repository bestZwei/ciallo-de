import { useCallback, useEffect, useRef, useState } from 'react';
import Credits from './components/Credits';
import Hud from './components/Hud';
import Marquee from './components/Marquee';
import WelcomeGate from './components/WelcomeGate';
import Wordmark from './components/Wordmark';
import Live2DStage from './character/Live2DStage';
import ParticleLayer from './fx/ParticleLayer';
import { attachAudioCues } from './audio/cue';
import { attachAudioLifecycle } from './audio/engine';
import { attachCharacterInput } from './character/controller';
import { attachPointerSource } from './lib/input';
import { keys, readJSON, writeJSON } from './lib/storage';
import './styles/stage.css';

const App = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  /** Returning visitors are never asked to click through a dialog first. */
  const [gated, setGated] = useState(() => !readJSON<boolean>(keys.seen, false));

  const enter = useCallback(() => {
    writeJSON(keys.seen, true);
    setGated(false);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const detachSource = attachPointerSource(el);
    const detachCharacter = attachCharacterInput();
    const detachAudio = attachAudioCues();
    const detachLifecycle = attachAudioLifecycle();
    return () => {
      detachSource();
      detachCharacter();
      detachAudio();
      detachLifecycle();
    };
  }, []);

  return (
    <div className="stage" ref={stageRef}>
      <Marquee />
      <Wordmark />
      <div className="stage-center">
        <Live2DStage />
      </div>
      <ParticleLayer />
      <Hud />
      <Credits />
      {gated && <WelcomeGate onEnter={enter} />}
    </div>
  );
};

export default App;
