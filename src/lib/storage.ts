const memory = new Map<string, string>();

let persistent = true;

const pending = new Map<string, string>();

let flushScheduled = false;

const flush = () => {
  flushScheduled = false;
  if (!persistent) {
    pending.clear();
    return;
  }
  for (const [k, v] of pending) {
    try {
      localStorage.setItem(k, v);
    } catch {
      persistent = false;
      break;
    }
  }
  pending.clear();
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  try {
    localStorage.setItem('ciallo.probe', '1');
    localStorage.removeItem('ciallo.probe');
  } catch {
    persistent = false;
  }
}

export const readJSON = <T>(key: string, fallback: T): T => {
  const raw = pending.get(key) ?? (persistent ? safeGet(key) : memory.get(key));
  if (raw === undefined || raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeGet = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    persistent = false;
    return memory.get(key);
  }
};

/**
 * Writes are coalesced into one frame: combo and best-score updates land many
 * times per second during a burst and a synchronous setItem each time is measurable.
 */
export const writeJSON = (key: string, value: unknown): void => {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  if (!persistent) return;
  pending.set(key, raw);
  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(flush);
};

export const keys = {
  seen: 'ciallo.seen',
  muted: 'ciallo.muted',
  comboBest: 'ciallo.comboBest',
  /** Only a visitor's explicit `?tier=` lands here; an automatic downgrade is
      session-scoped, so one slow afternoon cannot pin every later visit to a lower tier. */
  forcedTier: 'ciallo.tierForced',
} as const;
