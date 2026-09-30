import { useEffect, useRef, useState } from 'react';
import Ciallo from './components/Ciallo';
import Jumper from './components/Jumper';
import WelcomeModal from './components/WelcomeModal';

// ---- Types ----
interface Track {
  id: number;
  topPosition: number;
  bottomPosition: number;
  lastUsedTime: number;
  cooldownPeriod: number;
  activeElements: Set<HTMLElement>;
}

interface ColorConfig {
  dur: number;
  color: string;
  size: string;
  lane: number;
  delay: number;
}

const AUDIO_SRC = '/meguru.aac';
const audioList = [AUDIO_SRC];

const CLICK_THROTTLE_MS = 80;
const TEXT_WIDTH = 200;
const TEXT_HEIGHT = 50;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Build a vertical lane system used to avoid overlapping spawned texts.
const createTrackSystem = (): Track[] => {
  const screenHeight = window.innerHeight;
  const trackCount = Math.max(6, Math.floor(screenHeight / 80)); // min 6 lanes, ~1 per 80px
  const trackHeight = screenHeight / trackCount;

  return Array.from({ length: trackCount }, (_, index) => ({
    id: index,
    topPosition: Math.floor(index * trackHeight + trackHeight * 0.1), // 10% padding
    bottomPosition: Math.floor((index + 1) * trackHeight - trackHeight * 0.1),
    lastUsedTime: 0,
    cooldownPeriod: 5000, // 5s cooldown per lane
    activeElements: new Set<HTMLElement>(),
  }));
};

// Background floating texts. `top` is intentionally NOT set here — the Ciallo
// component derives its own responsive position from `lane`.
const colorMap: ColorConfig[] = [
  { dur: 15, color: 'red', size: 'clamp(15px, 4vw, 35px)', lane: 0, delay: 0 },
  { dur: 20, color: 'aqua', size: 'clamp(18px, 4.5vw, 40px)', lane: 1, delay: 3 },
  { dur: 16, color: 'coral', size: 'clamp(12px, 3vw, 25px)', lane: 2, delay: 1 },
  { dur: 22, color: 'greenyellow', size: 'clamp(14px, 3.5vw, 29px)', lane: 3, delay: 5 },
  { dur: 14, color: 'gold', size: 'clamp(10px, 2.5vw, 18px)', lane: 4, delay: 2 },
  { dur: 19, color: 'orange', size: 'clamp(20px, 5vw, 50px)', lane: 5, delay: 6 },
  { dur: 17, color: 'pink', size: 'clamp(25px, 6vw, 60px)', lane: 6, delay: 4 },
  { dur: 21, color: 'cyan', size: 'clamp(14px, 3.5vw, 29px)', lane: 7, delay: 7 },
];

const CialloText = [
  'Ciallo～(∠・ω< )⌒★',
  'Ciallo～♪(∠・ω< )⌒☆',
  'Ciallo～✨(∠・ω< )⌒★',
  'Ciallo～💫(∠・ω< )⌒☆',
  'Ciallo～🌟(∠・ω< )⌒★',
];

const App = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const audioIndexRef = useRef(0);
  const activeAnimationsRef = useRef(0);
  const audioObjectsRef = useRef<HTMLAudioElement[]>([]);
  const audioInitializedRef = useRef(false);
  const occupiedAreasRef = useRef<Set<string>>(new Set());
  const trackSystemRef = useRef<Track[]>(createTrackSystem());
  const lastClickRef = useRef(0);

  // Grid used for rough collision detection.
  const gridCols = 20;
  const gridRows = 15;

  const isAreaOccupied = (x: number, y: number, width = TEXT_WIDTH, height = TEXT_HEIGHT) => {
    const startCol = Math.floor((x / window.innerWidth) * gridCols);
    const endCol = Math.floor(((x + width) / window.innerWidth) * gridCols);
    const startRow = Math.floor((y / window.innerHeight) * gridRows);
    const endRow = Math.floor(((y + height) / window.innerHeight) * gridRows);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        if (occupiedAreasRef.current.has(`${col}-${row}`)) return true;
      }
    }
    return false;
  };

  const occupyArea = (x: number, y: number, width = TEXT_WIDTH, height = TEXT_HEIGHT) => {
    const keys: string[] = [];
    const startCol = Math.floor((x / window.innerWidth) * gridCols);
    const endCol = Math.floor(((x + width) / window.innerWidth) * gridCols);
    const startRow = Math.floor((y / window.innerHeight) * gridRows);
    const endRow = Math.floor(((y + height) / window.innerHeight) * gridRows);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        const key = `${col}-${row}`;
        keys.push(key);
        occupiedAreasRef.current.add(key);
      }
    }
    return keys;
  };

  const freeArea = (keys: string[]) => {
    keys.forEach((key) => occupiedAreasRef.current.delete(key));
  };

  const findAvailableTrack = (preferredY: number): Track | null => {
    const currentTime = Date.now();
    const tracks = trackSystemRef.current;

    let bestTrack: Track | null = null;
    let minDistance = Infinity;

    for (const track of tracks) {
      if (currentTime - track.lastUsedTime < track.cooldownPeriod) continue;
      const trackCenterY = (track.topPosition + track.bottomPosition) / 2;
      const distance = Math.abs(preferredY - trackCenterY);
      if (distance < minDistance) {
        minDistance = distance;
        bestTrack = track;
      }
    }

    // No idle lane: pick the one cooling down the soonest.
    if (!bestTrack) {
      let shortestCooldown = Infinity;
      for (const track of tracks) {
        const remaining = track.cooldownPeriod - (currentTime - track.lastUsedTime);
        if (remaining < shortestCooldown) {
          shortestCooldown = remaining;
          bestTrack = track;
        }
      }
    }
    return bestTrack;
  };

  const isInCenterZone = (x: number, y: number) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const exclusionWidth = Math.min(600, window.innerWidth * 0.8);
    const exclusionHeight = Math.min(200, window.innerHeight * 0.3);

    return (
      x > centerX - exclusionWidth / 2 &&
      x < centerX + exclusionWidth / 2 &&
      y > centerY - exclusionHeight / 2 &&
      y < centerY + exclusionHeight / 2
    );
  };

  const findSafePosition = (originalX: number, originalY: number) => {
    const track = findAvailableTrack(originalY);

    if (!track) {
      // Fallback: random search avoiding center + occupied cells.
      for (let i = 0; i < 20; i++) {
        let x = originalX;
        let y = originalY;
        if (i > 0) {
          const offsetX = (Math.random() - 0.5) * 300;
          const offsetY = (Math.random() - 0.5) * 200;
          x = Math.max(0, Math.min(window.innerWidth - TEXT_WIDTH, originalX + offsetX));
          y = Math.max(0, Math.min(window.innerHeight - TEXT_HEIGHT, originalY + offsetY));
        }
        if (!isInCenterZone(x, y) && !isAreaOccupied(x, y)) {
          return { x, y, track: null };
        }
      }
      return { x: originalX, y: originalY, track: null };
    }

    const safeY = track.topPosition + Math.random() * (track.bottomPosition - track.topPosition);
    const safeX = Math.max(50, Math.min(window.innerWidth - 250, originalX + (Math.random() - 0.5) * 200));
    track.lastUsedTime = Date.now();
    return { x: safeX, y: safeY, track };
  };

  const randomColor = () => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const initAudio = () => {
    audioList.forEach((audioSrc, index) => {
      const audio = new Audio(audioSrc);
      audio.preload = 'auto';
      audio.volume = 0.7;
      audioObjectsRef.current[index] = audio;
    });
    audioInitializedRef.current = true;
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    if (!audioInitializedRef.current) initAudio();
  };

  const cialloAppend = (event: Event) => {
    // Ignore clicks on links (e.g. the GitHub footer).
    const target = event.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' && target.closest('a')) return;

    // Simple time-based throttle to avoid spamming on rapid input.
    const now = Date.now();
    if (now - lastClickRef.current < CLICK_THROTTLE_MS) return;
    lastClickRef.current = now;

    const isMobile = window.innerWidth <= 768;
    const maxAnimations = isMobile ? 3 : 8;
    if (activeAnimationsRef.current >= maxAnimations) return;

    const mouseEvent = event as MouseEvent;
    const touchEvent = event as TouchEvent;
    const x = mouseEvent.pageX || (touchEvent.touches && touchEvent.touches[0]?.pageX) || 0;
    const y = mouseEvent.pageY || (touchEvent.touches && touchEvent.touches[0]?.pageY) || 0;
    if (!x || !y) return;

    const safePosition = findSafePosition(x, y);
    const span = document.createElement('span');

    span.textContent = CialloText[Math.floor(Math.random() * CialloText.length)];

    const fontSize = isMobile ? Math.random() * 8 + 14 : Math.random() * 15 + 18;
    const rotation = (Math.random() - 0.5) * 30;
    const reduceMotion = prefersReducedMotion();

    span.style.cssText = `
      position: fixed;
      left: ${safePosition.x}px;
      top: ${safePosition.y - 20}px;
      color: ${randomColor()};
      font-weight: bold;
      font-size: ${fontSize}px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3), 0 0 10px currentColor;
      z-index: 1500;
      pointer-events: none;
      user-select: none;
      will-change: transform, opacity;
      transform: rotate(${rotation}deg);
      filter: drop-shadow(0 0 5px currentColor);
    `;
    document.body.appendChild(span);

    activeAnimationsRef.current++;

    const occupiedKeys = occupyArea(safePosition.x, safePosition.y - 20);
    if (safePosition.track) safePosition.track.activeElements.add(span);

    const bounceHeight = Math.random() * 30 + 20;
    const moveDistance = isMobile ? 120 : 200;
    const animationDuration = reduceMotion ? 1200 : isMobile ? 1800 : 2500;

    // Reduced motion: no translation, just a gentle fade.
    const keyframes = reduceMotion
      ? [
          { transform: `scale(1) rotate(${rotation}deg)`, opacity: 1 },
          { transform: `scale(1) rotate(${rotation}deg)`, opacity: 0 },
        ]
      : [
          {
            transform: `scale(0) rotate(${rotation}deg) translateY(0px)`,
            opacity: 1,
            filter: 'drop-shadow(0 0 5px currentColor) hue-rotate(0deg)',
          },
          {
            transform: `scale(1.2) rotate(${rotation + 10}deg) translateY(-${bounceHeight}px)`,
            opacity: 1,
            filter: 'drop-shadow(0 0 15px currentColor) hue-rotate(180deg)',
          },
          {
            transform: `scale(1) rotate(${rotation - 5}deg) translateY(-${moveDistance}px)`,
            opacity: 0.8,
            filter: 'drop-shadow(0 0 10px currentColor) hue-rotate(360deg)',
          },
          {
            transform: `scale(0.8) rotate(${rotation + 15}deg) translateY(-${moveDistance + 50}px)`,
            opacity: 0,
            filter: 'drop-shadow(0 0 5px currentColor) hue-rotate(180deg)',
          },
        ];

    const animation = span.animate(keyframes, {
      duration: animationDuration,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    });

    if (audioInitializedRef.current && audioObjectsRef.current.length > 0) {
      const audio = audioObjectsRef.current[audioIndexRef.current];
      if (audio) {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => console.log('Audio play failed:', error));
        }
        audioIndexRef.current = (audioIndexRef.current + 1) % audioObjectsRef.current.length;
      }
    }

    animation.onfinish = () => {
      activeAnimationsRef.current--;
      freeArea(occupiedKeys);
      if (safePosition.track) safePosition.track.activeElements.delete(span);
      span.remove();
    };
  };

  useEffect(() => {
    const handleResize = () => {
      trackSystemRef.current = createTrackSystem();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!showWelcome) {
      const handleTouch = (e: TouchEvent) => {
        e.preventDefault();
        cialloAppend(e);
      };
      document.body.addEventListener('click', cialloAppend);
      document.body.addEventListener('touchstart', handleTouch, { passive: false });
      return () => {
        document.body.removeEventListener('click', cialloAppend);
        document.body.removeEventListener('touchstart', handleTouch);
      };
    }
  }, [showWelcome]);

  return (
    <div style={{
      background: 'linear-gradient(45deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
      minHeight: '100dvh', // Dynamic viewport height (falls back to 100vh where unsupported)
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden',
      touchAction: 'manipulation',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      {showWelcome && <WelcomeModal onClose={handleWelcomeClose} />}

      <Jumper />
      <div>
        {colorMap.map((item, index) => <Ciallo key={index} {...item} />)}
      </div>
      <footer style={{
        position: 'fixed',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        right: '15px',
        fontSize: 'clamp(10px, 2.5vw, 12px)',
        color: 'rgba(255, 255, 255, 0.6)',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        padding: '5px 10px',
        borderRadius: '15px',
        backdropFilter: 'blur(5px)',
        zIndex: 10001,
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}>
        <a
          href="https://github.com/bestZwei/ciallo-de"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'inherit',
            textDecoration: 'none',
            transition: 'all 0.3s ease',
            display: 'inline-block',
            padding: '2px 4px',
            borderRadius: '8px',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
            e.currentTarget.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            e.currentTarget.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          GitHub
        </a>
      </footer>
    </div>
  );
};

export default App;
