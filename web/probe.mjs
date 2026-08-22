import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const bad = [];
p.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url().slice(0, 150)); });
p.on("pageerror", (e) => bad.push("ERR " + e.message));
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
const html = await p.evaluate(() => {
  const d = document.querySelector(".h-\\[420px\\]");
  return d ? d.outerHTML.slice(0, 900) : "WRAPPER NOT FOUND";
});
console.log("BAD:", bad.join("\n") || "none");
console.log("---DOM---");
console.log(html);
await b.close();
