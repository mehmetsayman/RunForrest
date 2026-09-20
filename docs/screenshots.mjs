import { chromium } from "playwright";
import fs from "fs";

const OUT = "C:/Users/mehme/OneDrive/Masaüstü/Stellar/docs/screenshots";
const BASE = "https://runforrest.vercel.app";

fs.mkdirSync(OUT, { recursive: true });

/** Telefon genisliginde yakalanan sayfalar — uygulama mobil-oncelikli. */
const PHONE = [
  { path: "/dashboard", file: "dashboard.png", h: 1350 },
  { path: "/run", file: "run.png", h: 1150 },
  { path: "/leaderboard", file: "leaderboard.png", h: 1150 },
  { path: "/mint", file: "badges.png", h: 1050 },
  { path: "/profile", file: "profile.png", h: 1350 },
  { path: "/community", file: "community.png", h: 1350 },
  { path: "/community/stellar-marathon-club", file: "club.png", h: 1350 },
];

const browser = await chromium.launch();

for (const s of PHONE) {
  const ctx = await browser.newContext({
    viewport: { width: 420, height: s.h },
    deviceScaleFactor: 2,
    locale: "en-US",
    timezoneId: "Europe/Istanbul",
  });
  const p = await ctx.newPage();
  await p.goto(BASE + s.path, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(3000);
  // Animasyonlar otursun; scroll-reveal bilesenleri gorunur hale gelsin.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
  // Icerik yuksekligine gore kirp: alttaki bos alan README'de kotu duruyor.
  // Sayfa basina tanimli yukseklik ust sinir: README'de bir telefon
  // gorseli 1:3'ten uzun olunca ince bir serit gibi duruyor.
  const content = await p.evaluate(() => document.body.scrollHeight);
  const h = Math.ceil(Math.min(content + 24, s.h));
  await p.setViewportSize({ width: 420, height: h });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${s.file}` });
  console.log("telefon:", s.file);
  await ctx.close();
}

// Acilis sayfasi genis ekranda cekiliyor: pazarlama sayfasi, mobil degil.
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    locale: "en-US",
  });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/landing.png` });
  console.log("genis  : landing.png");
  await ctx.close();
}

await browser.close();
console.log("\ntamam:", OUT);
