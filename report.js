// Error reports: the smallest useful message when the app breaks on
// someone's device, and nothing else. Without them a script error on a
// reader's phone is invisible; the deploy check only proves the right files
// are served, not that they run.
//
// What leaves the device: the error's type, its message with anything in
// quotes removed, the script path and line, and the page path. No notes, no
// content, no query strings, no identifiers, no cookies (there are none).
// Only errors thrown by this site's own scripts are reported, at most three
// per page load, and never when the browser sends Global Privacy Control.
//
// A browser global loaded first on the app shell, so it catches errors in
// every script after it, and a CommonJS module that api/report.js uses to
// clean what arrives, so the two cannot disagree about what is kept.

const REPORT_LIMIT = 3;

/** A message with quoted text removed: `Unexpected token "my note"` keeps
 * its shape, never its contents. Whitespace collapsed, 200 characters. */
function scrubMessage(text) {
  return String(text == null ? "" : text)
    .replace(/"[^"]*"/g, "\"…\"")
    .replace(/'[^']*'/g, "'…'")
    .replace(/`[^`]*`/g, "`…`")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** The path of a URL on this origin, or null for anything else. */
function pathOnly(url, origin) {
  try {
    const u = new URL(url, origin);
    return u.origin === origin ? u.pathname : null;
  } catch { return null; }
}

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

/** What the server keeps from a report, or null when it is not one. */
function cleanReport(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const message = scrubMessage(raw.message);
  if (!message) return null;
  return {
    name: /^[A-Za-z]{1,40}$/.test(raw.name) ? raw.name : "Error",
    message,
    file: typeof raw.file === "string" && /^\/[\w./-]{0,80}$/.test(raw.file) ? raw.file : "",
    line: int(raw.line, 1e6),
    col: int(raw.col, 1e6),
    page: typeof raw.page === "string" && /^\/[\w./-]{0,120}$/.test(raw.page) ? raw.page : ""
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { REPORT_LIMIT, scrubMessage, pathOnly, cleanReport };

if (typeof window !== "undefined" && typeof navigator !== "undefined") (function () {
  "use strict";
  var sent = 0;
  var seen = {};
  // Expected, handled rejections: a recording the browser would not play
  // yet, a share sheet the reader closed.
  var benign = /^(AbortError|NotAllowedError)$/;

  function send(name, message, file, line, col) {
    if (sent >= REPORT_LIMIT || !navigator.sendBeacon || navigator.globalPrivacyControl === true) return;
    var report = cleanReport({ name: name, message: message, file: file, line: line, col: col, page: location.pathname });
    if (!report) return;
    var key = report.name + report.message + report.file + report.line;
    if (seen[key]) return;
    seen[key] = true;
    sent++;
    try { navigator.sendBeacon("/api/report", new Blob([JSON.stringify(report)], { type: "application/json" })); } catch (e) { /* nowhere to send it */ }
  }

  addEventListener("error", function (event) {
    // Our own scripts only: an extension's or another origin's error is not ours to fix.
    var file = event.filename ? pathOnly(event.filename, location.origin) : null;
    if (file === null) return;
    send((event.error && event.error.name) || "Error", event.message, file, event.lineno, event.colno);
  });

  addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var name = (reason && reason.name) || "UnhandledRejection";
    if (benign.test(name)) return;
    send(name, reason && reason.message ? reason.message : String(reason), "", 0, 0);
  });
})();
