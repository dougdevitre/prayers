// Receives the error reports report.js sends and writes one line per report
// to the function log, where the host keeps it for a short time. Nothing is
// stored anywhere else. Only what cleanReport() keeps is logged: the error's
// type, its message with quoted text removed, the script path and line, and
// the page path. Bodies over 2 KB, malformed JSON and anything that is not a
// report are refused.
//
//   POST /api/report   {"name","message","file","line","col","page"}  -> 204

const { cleanReport } = require("../report.js");

const MAX_BYTES = 2048;

function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end();
  }
  let size = 0;
  const chunks = [];
  let refused = false;
  req.on("data", chunk => {
    if (refused) return;
    size += chunk.length;
    if (size > MAX_BYTES) {
      refused = true;
      res.statusCode = 413;
      res.end();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (refused) return;
    let report = null;
    try { report = cleanReport(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { /* not JSON */ }
    if (!report) {
      res.statusCode = 400;
      return res.end();
    }
    handler.log(JSON.stringify({ event: "client-error", ...report }));
    res.statusCode = 204;
    res.end();
  });
}

// Replaceable, so the tests can read what would be logged.
handler.log = line => console.log(line);

module.exports = handler;
