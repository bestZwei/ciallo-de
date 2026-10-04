/**
 * Two locales, two URLs (`/` and `/zh/`), so the path is the only source of truth for
 * which language is on screen. Nothing is stored: a `localStorage` preference would let
 * `/` render Chinese text under an `<html lang="en">`, which is exactly the mismatch
 * crawlers and screen readers both punish.
 */
export type Locale = 'en' | 'zh';

export const LOCALE: Locale = /^\/zh(?:\/|$)/i.test(location.pathname) ? 'zh' : 'en';

/** Absolute, root-relative paths — used verbatim as hreflang alternates too. */
export const LOCALE_PATH: Record<Locale, string> = { en: '/', zh: '/zh/' };

export const OTHER_LOCALE: Record<Locale, Locale> = { en: 'zh', zh: 'en' };

/** BCP 47 tags as they appear on <html lang> and on hreflang / the switch link. */
export const LOCALE_TAG: Record<Locale, string> = { en: 'en', zh: 'zh-Hans' };

export type Dict = {
  combo: string;
  best: string;
  soundOn: string;
  soundOff: string;
  comboAnnounce: (combo: number) => string;
  figureAria: string;
  loadFailed: string;
  gateNote: [string, string];
  gateEnter: string;
  gateLegal: string;
  crashed: string;
  reload: string;
  switchTo: string;
  switchAria: string;
};

export const STRINGS: Record<Locale, Dict> = {
  en: {
    combo: 'Combo',
    best: 'Best',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    comboAnnounce: (combo) => `${combo} combo`,
    figureAria: 'Ciallo～ character artwork, clickable',
    loadFailed: 'The character failed to load — click to retry',
    gateNote: [
      'Click anywhere on the screen and she answers.',
      'Click her directly and it is much stronger.',
    ],
    gateEnter: 'Enter',
    gateLegal: 'Character artwork is copyright Live2D Inc. — see the credit in the footer.',
    crashed: 'Ciallo fell over (∠・ω< )⌒★',
    reload: 'Reload',
    switchTo: '中文',
    switchAria: '切换到中文',
  },
  zh: {
    combo: '连击',
    best: '最高',
    soundOn: '音效开启',
    soundOff: '音效关闭',
    comboAnnounce: (combo) => `${combo} 连击`,
    figureAria: 'Ciallo～ 的角色立绘，可点击',
    loadFailed: '角色载入失败，点击重试',
    gateNote: ['点屏幕的任何地方，她都会回应你。', '点她本人，效果更明显。'],
    gateEnter: '进入',
    gateLegal: '角色素材版权归 Live2D Inc. 所有，详见页脚署名。',
    crashed: 'Ciallo 摔倒了 (∠・ω< )⌒★',
    reload: '刷新',
    switchTo: 'English',
    switchAria: 'Switch to English',
  },
};

export const t = (): Dict => STRINGS[LOCALE];
