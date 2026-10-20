// v2.8: texture-defect smoke. For each preset (low/medium/high) and level, render known views and fail on:
// page errors, 'atlas full' warnings, and black panels (a large share of near-black pixels in the 3D view).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const URL = process.argv[2] || 'http://localhost:4199/', OUT = process.argv[3] || '';
let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const VIEWS = { grassmarket: [['castle', [8, -19, 175, 24]], ['square', [55, -12, 100, 3]], ['victoria', [-57.5, 21, 172, 10]], ['vic-up', [-58, 30, 160, 12]], ['memorial', [-44, -6, 60, -25]], ['pub', [-35, 14, 200, -2]], ['phonebox', [-45.5, 17.6, 200, -6]], ['close', [30, -14, 0, 0]], ['north', [0, 10, 180, 30]]],
  granton: [['spawn', [0, -28, 118, 6]], ['spawn-old', [0, -28, 180, -5]], ['gasholder', [-8, -30, 105, 16]], ['purge', [-14, -6, 56, -10]], ['square', [0, -12, 0, 6]], ['harbour', [-20, 15, 180, 2]], ['pier', [16, 22, 180, 3]], ['slipway', [-24.5, 17, 168, -14]]],
  pilton: [['flats', [-2, -30, 225, 2]], ['parade', [0, 16, 180, 6]], ['spawn', [0, -38, 180, -8]], ['skyline', [0, 0, 0, 2]]] };
const black = (buf) => new Promise(() => {});
for (const preset of (process.argv[4] || 'low,medium,high').split(',')) {
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true }), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
  for (const lv of ['grassmarket', 'pilton', 'granton']) {
    await pg.goto(`${URL}?level=${lv}&preset=${preset}`); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(3000);
    await pg.evaluate(() => { for (const id of ['toast', 'hud', 'touch', 'wallet']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } document.querySelectorAll('.hud, #touchUI, #joy, .btn, #kickBtn, #jumpBtn, #ballBtn, #pauseBtn').forEach(e => e.style.visibility = 'hidden'); });
    for (const [n, v] of VIEWS[lv]) {
      await pg.evaluate((v) => __game.teleport(...v), v); await pg.waitForTimeout(1200);
      const buf = await pg.screenshot(); if (OUT) await pg.screenshot({ path: `${OUT}${preset}-${lv}-${n}.png` });
      const frac = await pg.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0, t = 0; for (let i = 0; i < d.length; i += 16) { t++; if (d[i] < 7 && d[i + 1] < 7 && d[i + 2] < 7) n++; } return n / t; }, buf.toString('base64'));
      ok(frac < 0.05, `${preset} ${lv} ${n}: pure-black ${(frac * 100).toFixed(1)}%`);
    }
  }
  ok(errs.length === 0, `${preset}: no page errors / atlas overflow ${JSON.stringify(errs.slice(0, 3))}`);
  await ctx.close();
}
await b.close(); process.exit(fail ? 1 : 0);
