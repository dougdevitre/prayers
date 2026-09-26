// The share targets a page offers, as plain URLs. No SDKs, no scripts from
// the platforms, no tracking parameters: an intent link is an ordinary anchor
// that works with JavaScript off, and the reader's own app finishes the job.
//
// Shared by scripts/build-day-pages.js (which bakes the links into every day
// page) and the tests, so the two cannot drift. Browser-side behaviour (copy
// link, the native share sheet) lives in share.js.

// X truncates at 280 characters including the shortened URL (23 today) and a
// space; the caption is cut with an ellipsis well inside that.
const X_TEXT_LIMIT = 240;

function truncate(text, limit = X_TEXT_LIMIT) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > limit / 2 ? cut.slice(0, atSpace) : cut).trimEnd()}…`;
}

/** { x, facebook, whatsapp, email } for a page. `text` is the caption (verse + reference). */
function shareLinks({ url, title, text }) {
  const enc = encodeURIComponent;
  return {
    x: `https://twitter.com/intent/tweet?text=${enc(truncate(text))}&url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
    email: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n${url}`)}`
  };
}

module.exports = { X_TEXT_LIMIT, truncate, shareLinks };
