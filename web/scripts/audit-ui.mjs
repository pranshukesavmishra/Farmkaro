/**
 * Visual + accessibility audit.
 * For each route x theme: full-page screenshot, console/page errors, and a
 * real WCAG contrast pass over every rendered text node.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.argv[2] ?? "/tmp/farmkaro-ui";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/"],
  ["discover", "/discover"],
  ["listland", "/list-land"],
  ["owner", "/dashboard/owner"],
  ["farmer", "/dashboard/farmer"],
  ["parcel", "/parcel/p-1"],
];

import { CONTRAST } from "./contrast.mjs";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let bad = 0;

for (const theme of ["dark", "light"]) {
  for (const [name, path] of ROUTES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
    await ctx.addInitScript(`try{localStorage.setItem("fk-theme",${JSON.stringify(theme)})}catch(e){}`);
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("PAGEERROR " + (e.stack || e.message).slice(0, 200)));
    p.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (/favicon|tile|ERR_(BLOCKED|NAME|CONNECTION|PROXY)|net::|Failed to load resource/i.test(t)) return;
      errs.push("CONSOLE " + t.slice(0, 200));
    });
    await p.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: true });
    const fails = await p.evaluate(CONTRAST);
    bad += fails.length + errs.length;
    console.log(`\n── ${name} (${theme}) ${"─".repeat(30)}`);
    if (errs.length) console.log("  ERRORS: " + [...new Set(errs)].slice(0, 4).join("\n           "));
    if (fails.length) for (const f of fails) console.log(`  CONTRAST ${f.ratio}:1 (need ${f.need}) ${f.px}px "${f.txt}" [${f.cls}]`);
    if (!errs.length && !fails.length) console.log("  clean");
    await ctx.close();
  }
}
await b.close();
console.log(bad ? `\nTOTAL ISSUES: ${bad}` : "\nALL CLEAN");
