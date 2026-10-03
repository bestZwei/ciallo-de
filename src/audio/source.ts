/**
 * Candidate order matters: a properly framed mp3 decodes everywhere, while the
 * shipped `.aac` is bare ADTS, which Firefox has historically refused to hand back
 * from `decodeAudioData`. Dropping an mp3 into `public/` later needs no code change.
 */
const CANDIDATES = ['/meguru.mp3', '/meguru.aac'];

/** Some engines only implement the callback form, others only the promise form. */
const decode = (ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> =>
  new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const done = (buffer: AudioBuffer) => {
      if (!settled) {
        settled = true;
        resolve(buffer);
      }
    };
    const fail = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    try {
      const returned = ctx.decodeAudioData(data, done, fail);
      if (returned && typeof returned.then === 'function') returned.then(done, fail);
    } catch (err) {
      fail(err);
    }
  });

export type Sample = { buffer: AudioBuffer; url: string };

/** Resolves to null only after every candidate has failed; never throws. */
export const fetchSample = async (ctx: AudioContext): Promise<Sample | null> => {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = await decode(ctx, await res.arrayBuffer());
      return { buffer, url };
    } catch {
      /* A missing candidate is the expected case today, so this stays quiet. */
    }
  }
  return null;
};
