import './Wordmark.css';

/** One element, not a span per glyph: the old Jumper animated each character and paid
    for it in layout on every frame. */
const Wordmark = () => (
  <h1 className="wordmark" aria-label="Ciallo">
    <span className="wordmark-main">ciallo</span>
    <span className="wordmark-tld" aria-hidden="true">
      .de
    </span>
  </h1>
);

export default Wordmark;
