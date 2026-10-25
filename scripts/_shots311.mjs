// v3.11 Pennywell views for photo comparison (scripted, headless; not a phone)
import { chromium } from 'playwright-core';
const URL = process.argv[2] || 'http://localhost:4199/', P = process.argv[3] || 'medium';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await pg.goto(`${URL}?debug&level=pennywell&preset=${P}`); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(2500);
await pg.evaluate(() => { for (const id of ['toast', 'hud', 'touch', 'nearby']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
const V = { 'shops': [2, -36, 270, 4], 'bookies-sweetshop': [9, -30, 270, 2], 'spawn-haddons': [17, -23, 90, -2], 'school': [-2, -54, 120, 8], 'school-gate': [-3.5, -60, 90, 2], 'roundabout': [0, -68, 0, 4],
  'road-up': [0, -40, 180, 3], 'churches': [0, -6, 180, 5], 'oldkirk': [4, 2, 270, 8], 'stpauls': [-3, 13, 90, 12], 'police': [0, 32, 180, 4], 'tag-ypd': [10, -2, 0, 2], 'tag-ymd': [6, -3, 270, 0], 'flats-left': [2, -66, 270, 6] };
for (const [n, v] of Object.entries(V)) { await pg.evaluate((v) => __game.teleport(...v), v); await pg.waitForTimeout(1300); await pg.screenshot({ path: `/workspace/ek-design/v311-${n}.png` }); }
await b.close();
