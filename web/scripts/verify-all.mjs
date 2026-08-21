/**
 * Run every browser check in order against a running dev server, and report a
 * single pass/fail. Reset first — several checks claim a sample identity, and
 * each can only be claimed once:
 *
 *     bash scripts/reset-dev.sh && npm run verify:all
 */
import { spawn } from "node:child_process";

const CHECKS = [
  ["links", "audit-links.mjs", "every internal link resolves"],
  ["cards", "verify-cards.mjs", "one link per card, whole card clickable"],
  ["discover", "verify-discover.mjs", "every filter constrains the results"],
  ["sorting", "verify-sorting.mjs", "each sort really orders the list"],
  ["map labels", "verify-map-labels.mjs", "no price pill covers another"],
  ["chrome", "verify-chrome.mjs", "theme, session and record lookups"],
  ["flows", "verify-flows.mjs", "sign in, list land, enquire, offer"],
  ["lease", "verify-lease.mjs", "offer to registered lease, and its guards"],
  ["messaging", "verify-messaging.mjs", "both parties can read and answer a thread"],
  ["records", "verify-records.mjs", "pilot land records: lookup, map anchor, guards"],
  ["ui audit", "audit-ui.mjs", "contrast and errors, 6 routes x 2 themes"],
  ["mobile", "audit-mobile.mjs", "overflow, tap targets and contrast at 390px"],
];

const run = (file) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [new URL(file, import.meta.url).pathname], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });

let failed = 0;
for (const [name, file, what] of CHECKS) {
  process.stdout.write(`  ${name.padEnd(11)} ${what.padEnd(46)}`);
  const { code, out } = await run(file);
  if (code === 0) {
    console.log("ok");
  } else {
    failed++;
    console.log("FAILED");
    console.log(
      out
        .split("\n")
        .filter((l) => /✗|FAIL|Error/.test(l))
        .slice(0, 6)
        .map((l) => "      " + l.trim())
        .join("\n"),
    );
  }
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
