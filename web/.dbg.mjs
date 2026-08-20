import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
await p.goto("http://localhost:3000/parcel/p-3", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
const info = await p.evaluate(() => {
  const glass = [...document.querySelectorAll(".glass")].map(e => ({
    text: e.textContent?.slice(0, 40),
    rect: e.getBoundingClientRect().toJSON(),
    style: getComputedStyle(e).opacity,
  }));
  return glass;
});
console.log(JSON.stringify(info, null, 1).slice(0, 2000));
await b.close();
