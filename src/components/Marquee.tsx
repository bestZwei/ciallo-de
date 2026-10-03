import type { CSSProperties } from 'react';
import { SWATCHES } from '../palette';
import './Marquee.css';

/**
 * Eight lanes. Size, speed and phase differ per lane so the field has depth instead of
 * eight identical ribbons, and every lane takes a different palette entry — the old
 * site had `aqua` and `cyan` both resolving to rgb(0,255,255), so eight lanes were
 * really seven colours.
 */
const LANES = [
  { text: 'Ciallo～(∠・ω< )⌒★', k: 1, dur: 21, delay: -3, hue: 0 },
  { text: 'お、お嬢様、Ciallo～？', k: 0.72, dur: 27, delay: -14, hue: 7 },
  { text: '(∠・ω< )⌒★', k: 1.34, dur: 17, delay: -8, hue: 2 },
  { text: 'Peach～？', k: 0.64, dur: 31, delay: -22, hue: 5 },
  { text: 'Ciallo～', k: 1.12, dur: 19, delay: -1, hue: 8 },
  { text: '巡です、巡です～', k: 0.8, dur: 25, delay: -17, hue: 9 },
  { text: '(∠・ω< )', k: 1.5, dur: 15, delay: -11, hue: 1 },
  { text: 'お嬢様～', k: 0.9, dur: 23, delay: -6, hue: 3 },
];

const Marquee = () => (
  <div className="marquee" aria-hidden="true">
    {LANES.map((lane, i) => (
      <span
        className="lane"
        key={lane.text}
        style={
          {
            '--k': lane.k,
            '--lane': i,
            color: SWATCHES[lane.hue].hex,
            animationDuration: `${lane.dur}s`,
            animationDelay: `${lane.delay}s`,
          } as CSSProperties
        }
      >
        {lane.text}
      </span>
    ))}
  </div>
);

export default Marquee;
