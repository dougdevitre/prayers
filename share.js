// Progressive enhancement for the share row on the static pages. The four
// platform links work without this file; it adds the two things a link
// cannot do: copy the page URL, and open the device's own share sheet where
// one exists. Loaded with defer from the page, same origin, so the CSP's
// script-src 'self' holds and nothing runs inline.
(function () {
  "use strict";
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
