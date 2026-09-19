import { chromium } from "playwright";
import { pathToFileURL } from "url";
import path from "path";

const targets = [
  { file: "banner.html", sel: ".banner", out: "shots/banner.png", w: 1280, h: 640 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL(path.resolve(t.file)).href, {
    waitUntil: "networkidle",
  });
  // web fontlarının yerleşmesini bekle
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const el = await page.$(t.sel);
  await el.screenshot({ path: t.out });
  console.log(t.out, "yazildi");
  await page.close();
}
await browser.close();
