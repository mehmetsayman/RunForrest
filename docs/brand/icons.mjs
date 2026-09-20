import { chromium } from "playwright";
import fs from "fs";
import path from "path";

/**
 * PWA ikonlarını tek bir kaynak görselden üretir.
 *
 * İki ayrı ikon türü gerekiyor ve bunları karıştırmak ana ekranda kırpılmış
 * bir logoya yol açıyor:
 *
 *   any       — tam kanvas. iOS ve masaüstü bunu olduğu gibi gösterir.
 *   maskable  — Android logoyu kendi şekline (daire/squircle) kırpar ve
 *               yalnızca merkezdeki güvenli alanı korur. Logo %66'ya
 *               küçültülüp zemine oturtuluyor ki hiçbir kenarı kesilmesin.
 *
 * Kaynak görsel şeffaf olabilir; maskable ve apple varyantlarına opak zemin
 * veriliyor çünkü iOS şeffaflığı siyaha çeviriyor.
 */

const SRC = process.argv[2];
const OUT = process.argv[3];
const BG = "#0a0a0a"; // Stellar koyu zemini

if (!SRC || !fs.existsSync(SRC)) {
  console.error("kullanim: node icons.mjs <kaynak.png> <cikti-klasoru>");
  process.exit(1);
}

const dataUri =
  "data:image/png;base64," + fs.readFileSync(SRC).toString("base64");

/** scale: logonun kenar uzunluğuna oranı. bg: null ise şeffaf. */
const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.88, bg: BG },
  { file: "icon-512.png", size: 512, scale: 0.88, bg: BG },
  { file: "icon-maskable-512.png", size: 512, scale: 0.66, bg: BG },
  { file: "apple-touch-icon.png", size: 180, scale: 0.92, bg: BG },
];

const browser = await chromium.launch();
for (const t of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
  });
  await page.setContent(
    `<style>
       html,body{margin:0;width:${t.size}px;height:${t.size}px}
       body{display:grid;place-items:center;background:${t.bg ?? "transparent"}}
       img{width:${Math.round(t.size * t.scale)}px;height:${Math.round(t.size * t.scale)}px;object-fit:contain;display:block}
     </style>
     <img src="${dataUri}">`,
  );
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(OUT, t.file),
    omitBackground: t.bg === null,
  });
  await page.close();
  console.log(`${t.file.padEnd(24)} ${t.size}x${t.size}  logo %${Math.round(t.scale * 100)}  zemin=${t.bg ?? "seffaf"}`);
}
await browser.close();
