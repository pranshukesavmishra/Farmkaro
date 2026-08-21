/** Phone-width audit: horizontal overflow, tap-target size, contrast, errors. */
import { chromium } from "playwright";
import { CONTRAST } from "./contrast.mjs";
import fs from "node:fs";
const BASE = "http://localhost:3000";
const OUT = "/tmp/farmkaro-mobile";
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = [["home","/"],["discover","/discover"],["listland","/list-land"],["owner","/dashboard/owner"],["farmer","/dashboard/farmer"],["parcel","/parcel/p-1"]];
let fail = 0;
const check = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

for (const theme of ["dark", "light"]) {
  for (const [name, path] of ROUTES) {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },      // iPhone 14 class
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    await ctx.addInitScript(`try{localStorage.setItem("fk-theme",${JSON.stringify(theme)})}catch(e){}`);
    const p = await ctx.newPage();
    const errs = new Set();
    p.on("pageerror", (e) => errs.add((e.stack || e.message).slice(0, 160)));
    await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: true });

    const overflow = await p.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const guilty = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > docW + 1.5) {
          const s = getComputedStyle(el);
          // An element inside its own scroll container is allowed to be wide.
          let n = el.parentElement, contained = false;
          while (n && n !== document.body) {
            const ov = getComputedStyle(n).overflowX;
            if (ov === "auto" || ov === "scroll" || ov === "hidden") { contained = true; break; }
            n = n.parentElement;
          }
          if (contained || s.position === "fixed") continue;
          guilty.push(`${el.tagName}.${(el.className||"").toString().slice(0,45)} right=${Math.round(r.right)}`);
        }
      }
      return { docW, scrollW: document.documentElement.scrollWidth, guilty: [...new Set(guilty)].slice(0, 4) };
    });
    const scrolls = overflow.scrollW > overflow.docW + 1;
    check(!scrolls, `${name} (${theme}): page does not scroll sideways (${overflow.scrollW} vs ${overflow.docW})${overflow.guilty.length ? " — " + overflow.guilty.join("; ") : ""}`);

    const small = await p.evaluate(() => {
      // The tappable area is not always the element's own box: a control
      // wrapped in a label is tapped through the label, and a .stretch-link
      // covers its positioned ancestor. Measure what a thumb actually hits.
      const effective = (el) => {
        if (el.classList.contains("stretch-link")) {
          let n = el.parentElement;
          while (n && n !== document.body) {
            if (getComputedStyle(n).position !== "static") return n.getBoundingClientRect();
            n = n.parentElement;
          }
        }
        const label = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
        if (label) {
          const a = el.getBoundingClientRect(), b = label.getBoundingClientRect();
          return {
            width: Math.max(a.right, b.right) - Math.min(a.left, b.left),
            height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top),
          };
        }
        return el.getBoundingClientRect();
      };
      const out = [];
      for (const el of document.querySelectorAll("a[href], button:not([disabled]), select, input:not([type=hidden])")) {
        const own = el.getBoundingClientRect();
        if (!own.width || !own.height) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        const r = effective(el);
        // 24px is the WCAG 2.2 AA minimum for a target's smaller side.
        if (Math.min(r.width, r.height) < 24) {
          out.push(`${el.tagName}"${(el.textContent||el.getAttribute("aria-label")||"").trim().slice(0,22)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return [...new Set(out)].slice(0, 6);
    });
    check(small.length === 0, `${name} (${theme}): every tap target is at least 24px${small.length ? " — " + small.join("; ") : ""}`);

    const cf = await p.evaluate(CONTRAST);
    check(cf.length === 0, `${name} (${theme}): contrast clean${cf.length ? " — " + cf.slice(0,3).map(f=>`${f.ratio}:1 "${f.txt}"`).join("; ") : ""}`);
    check(errs.size === 0, `${name} (${theme}): no JS errors${errs.size ? " — " + [...errs][0] : ""}`);
    await ctx.close();
  }
}
console.log(fail ? `\n${fail} FAILED` : "\nMOBILE: ALL PASSED");
await b.close();
process.exit(fail ? 1 : 0);
