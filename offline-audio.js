// Offline listening: which recordings to keep on the device, and nothing
// else. Pure, so the tests can run it in Node; app.js does the caching.
//
// A browser global (loaded before app.js) and a CommonJS module, like
// logic.js. It needs dayItemId and sosItemId from narration.js, which is a
// global in the browser and a require here.

const OFFLINE_CACHE = "stand-audio-offline-v1";
// Today and the six days after it: a week of the journey the reader is on.
const OFFLINE_DAYS = 7;

const offlineIdsFor = (typeof module !== "undefined" && module.exports)
  ? require("./narration.js")
  : { dayItemId: (...a) => dayItemId(...a), sosItemId: (...a) => sosItemId(...a) };

/**
 * Manifest ids to keep offline: the current day and the six after it in the
 * reader's journey and language (not wrapping past the last day), and every
 * SOS set in that language, since fear does not wait for a connection.
 */
function offlineIds({ lang, track, day, days, sosCount }) {
  const ids = [];
  const last = Math.min(days, day + OFFLINE_DAYS);
  for (let d = Math.max(0, day); d < last; d++) ids.push(offlineIdsFor.dayItemId(lang, track, d));
  for (let i = 0; i < sosCount; i++) ids.push(offlineIdsFor.sosItemId(lang, i));
  return ids;
}

/**
 * What to hold for those ids: one entry per distinct recording the manifest
 * has, with its URL and size. Ids without a recording are skipped (they play
 * with the device voice, which needs no download). Returns { keep, bytes }.
 */
function offlinePlan(manifest, ids) {
  const keep = [];
  const seen = new Set();
  if (!manifest || manifest.enabled === false || !manifest.base) return { keep, bytes: 0 };
  const base = String(manifest.base).replace(/\/+$/, "");
  for (const id of ids) {
    const item = manifest.items && manifest.items[id];
    if (!item || !item.key) continue;
    const url = `${base}/${item.key}`;
    if (seen.has(url)) continue;
    seen.add(url);
    keep.push({ id, url, bytes: Number(item.bytes) || 0 });
  }
  return { keep, bytes: keep.reduce((n, k) => n + k.bytes, 0) };
}

/** "8.1" for a byte count, as the status line shows it. */
const megabytes = bytes => (Math.round((bytes / 1048576) * 10) / 10).toFixed(1);

if (typeof module !== "undefined" && module.exports) module.exports = { OFFLINE_CACHE, OFFLINE_DAYS, offlineIds, offlinePlan, megabytes };
