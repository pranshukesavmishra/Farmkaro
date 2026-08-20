import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("response", r => { if (r.status() >= 400) console.log(r.status(), r.url().slice(0,140)); });
p.on("requestfailed", r => console.log("FAIL", r.url().slice(0,140)));
await p.goto("http://localhost:3000/list-land", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
await b.close();
