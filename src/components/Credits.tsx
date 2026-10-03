import './Credits.css';

/**
 * Live2D's free-material licence requires a visible credit wherever the sample data
 * is used. Short form is what the EULA allows outside of a dedicated credits page, so
 * this stays one line of prose plus the model attribution.
 */
const Credits = () => (
  <footer className="credits" data-no-spawn>
    <p className="credits-line">
      This content uses sample data owned and copyrighted by{' '}
      <a href="https://www.live2d.com/en/learn/sample/" rel="noopener" target="_blank">
        Live2D Inc.
      </a>
    </p>
    <p className="credits-sub">Niziiro Mao — Illustration &amp; Modeling: Live2D Inc.</p>
  </footer>
);

export default Credits;
