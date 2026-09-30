import { useEffect, useRef } from 'react';
import './index.css';

interface CialloProps {
  dur?: number;
  color?: string;
  size?: string;
  lane?: number;
  delay?: number;
}

const Ciallo = ({ dur = 18, color = 'red', size = '15px', lane = 0, delay = 0 }: CialloProps) => {
  const elementRef = useRef<HTMLParagraphElement>(null);

  // Position is expressed in vh so it stays correct after resize / rotate.
  const laneHeight = 100 / 8; // 8 lanes, matching colorMap length
  const laneOffset = Math.random() * (laneHeight * 0.6) + laneHeight * 0.2;
  const adjustedTop = `${lane * laneHeight + laneOffset}vh`;

  const startDelay = delay + Math.random() * 2;
  const verticalDrift = (Math.random() - 0.5) * 20;

  useEffect(() => {
    elementRef.current?.style.setProperty('--vertical-drift', `${verticalDrift}px`);
  }, [verticalDrift]);

  return (
    <p
      ref={elementRef}
      className="ciallo"
      style={{
        animationDuration: `${dur}s`,
        animationDelay: `${startDelay}s`,
        color,
        fontSize: size,
        top: adjustedTop,
        zIndex: 500 - lane,
      }}
    >
      Ciallo～(∠・ω&lt; )⌒★
    </p>
  );
};

export default Ciallo;
