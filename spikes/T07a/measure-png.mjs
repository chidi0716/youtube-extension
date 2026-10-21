// 計算 PNG 圖檔某個區域的平均亮度（0–255）。
//   node spikes/T07a/measure-png.mjs <檔案> [x y width height]
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const [file, ...rect] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true });
const page = await browser.newPage();
const value = await page.evaluate(
  async ({ b64, rect }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const [x, y, w, h] = rect.length === 4 ? rect : [0, 0, c.width, c.height];
    const d = ctx.getImageData(x, y, w, h).data;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      max = Math.max(max, l);
    }
    return { mean: Math.round((sum / (d.length / 4)) * 10) / 10, max: Math.round(max) };
  },
  { b64: readFileSync(file).toString('base64'), rect: rect.map(Number) },
);
console.log(file, rect.join(' '), JSON.stringify(value));
await browser.close();
