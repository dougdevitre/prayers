// Sharing, shared: the link builders every day page bakes in and the app's
// share dialog uses, plus the enhancement for the static pages' share row.
// A browser global (loaded before app.js, and by every day page) and a
// CommonJS module (the page generator and the tests), like logic.js.
//
// No SDKs, no scripts from the platforms, no tracking parameters: an intent
// link is an ordinary anchor that works with JavaScript off, and the reader's
// own app finishes the job.

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

// Inline SVG, so neither the pages nor the app load anything from a
// platform. The platform marks are from Simple Icons (CC0); link, share and
// email are drawn here. Every icon is aria-hidden: the control carries the
// label.
const shareIcons = {
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/></svg>'
};

if (typeof module !== "undefined" && module.exports) module.exports = { X_TEXT_LIMIT, truncate, shareLinks, shareIcons };

// Progressive enhancement for the share row on the static pages. The four
// platform links work without this; it adds the two things a link cannot do:
// copy the page URL, and open the device's own share sheet where one exists.
// Loaded with defer from the page, same origin, so the CSP's script-src
// 'self' holds and nothing runs inline. The app's own share dialog has no
// .share-copy or .share-native, so this leaves it alone.
if (typeof document !== "undefined") (function () {
  var rows = document.querySelectorAll(".share-row");
  for (var i = 0; i < rows.length; i++) enhance(rows[i]);

  function enhance(row) {
    var url = row.getAttribute("data-url") || location.href;
    var title = row.getAttribute("data-title") || document.title;
    var text = row.getAttribute("data-text") || "";
    var copy = row.querySelector(".share-copy");
    var native = row.querySelector(".share-native");
    var field = row.querySelector(".share-url");

    if (copy) {
      copy.hidden = false;
      var label = copy.querySelector("span");
      var idle = label ? label.textContent : "";
      copy.addEventListener("click", function () {
        var done = function () {
          if (label) label.textContent = copy.getAttribute("data-copied") || idle;
          copy.classList.add("is-copied");
          setTimeout(function () { if (label) label.textContent = idle; copy.classList.remove("is-copied"); }, 1600);
        };
        var fallback = function () {
          // No clipboard (older browser, or permission refused): show the
          // link selected, so one keystroke or a long-press copies it.
          if (!field) return;
          field.hidden = false;
          field.focus();
          field.select();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, fallback);
        } else {
          fallback();
        }
      });
    }

    if (native && navigator.share) {
      native.hidden = false;
      native.addEventListener("click", function () {
        navigator.share({ title: title, text: text, url: url }).catch(function () {
          // The reader closed the sheet. Nothing to report.
        });
      });
    }
  }
})();
