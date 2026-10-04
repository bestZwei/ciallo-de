import './Wordmark.css';

/** One element, not a span per glyph: the old Jumper animated each character and paid
    for it in layout on every frame. The trailing tilde is the whole point of the meme, so
    it is part of the name; aria-label keeps screen readers from announcing "fullwidth tilde". */
const Wordmark = () => (
  <h1 className="wordmark" aria-label="Ciallo">
    <span className="wordmark-main">
      Ciallo
      {'\uFF5E'}
    </span>
  </h1>
);

export default Wordmark;
