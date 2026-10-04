import { LOCALE, LOCALE_PATH, LOCALE_TAG, OTHER_LOCALE, t } from '../i18n';
import './LanguageSwitch.css';

/**
 * A plain link, not a state toggle: the two languages are two URLs, so navigating is a
 * normal document load and crawlers see the same pair the hreflang block advertises.
 */
const LanguageSwitch = () => {
  const target = OTHER_LOCALE[LOCALE];
  return (
    <a
      className="lang-switch"
      href={LOCALE_PATH[target]}
      hrefLang={LOCALE_TAG[target]}
      lang={LOCALE_TAG[target]}
      data-no-spawn
      aria-label={t().switchAria}
    >
      {t().switchTo}
    </a>
  );
};

export default LanguageSwitch;
