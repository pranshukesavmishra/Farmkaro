import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const S = "/tmp/walk";
import { mkdirSync } from "fs";
mkdirSync(S, { recursive: true });

// Desktop
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });

// 1. Discover with a parcel SELECTED (click first card)
await p.goto("http://localhost:3000/discover", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4500);
const card = p.locator("article").first();
await card.click();
await p.waitForTimeout(2200); // easeTo animation
await p.screenshot({ path: `${S}/1-discover-selected.png` });

// 2. Dark mode discover
await p.evaluate(() => { document.documentElement.classList.add("dark"); localStorage.setItem("fk-theme","dark"); });
await p.waitForTimeout(700);
await p.screenshot({ path: `${S}/2-discover-dark.png` });
await p.evaluate(() => { document.documentElement.classList.remove("dark"); localStorage.setItem("fk-theme","light"); });

// 3. Farmer dashboard (explainable match panel)
await p.goto("http://localhost:3000/dashboard/farmer", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3500);
await p.screenshot({ path: `${S}/3-farmer.png` });

// 4. Homepage full
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3500);
await p.screenshot({ path: `${S}/4-home-full.png`, fullPage: true });

// 5. Mobile discover (map/list toggle)
const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await m.goto("http://localhost:3000/discover", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(4000);
await m.screenshot({ path: `${S}/5-discover-mobile.png` });

console.log("done");
await b.close();
