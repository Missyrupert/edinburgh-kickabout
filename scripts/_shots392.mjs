import { chromium } from 'playwright-core';
const URL = process.argv[2] || 'http://localhost:4199/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let bad = 0;
for (const [w, h] of [[412, 915], [360, 640], [915, 412], [667, 360]]) { const pg = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage();
  await pg.goto(URL + '?level=royalmile&preset=low'); await pg.waitForTimeout(5000);
  await pg.screenshot({ path: `/workspace/ek-design/v392-menu-${w}x${h}.png` });
  const hs = await pg.evaluate(() => [...document.querySelectorAll('[data-level]')].map(e => Math.round(e.getBoundingClientRect().height)));
  console.log(w, h, 'level buttons', hs.length, 'min h', Math.min(...hs)); if (w > h && Math.min(...hs) < 44) bad++;
  if (h > w) { await pg.click('#startBtn'); let shot = 0;
    for (let i = 0; i < 16; i++) { const o = await pg.evaluate(() => { const a = document.getElementById('toast').getBoundingClientRect(); const vis = document.getElementById('toast').classList.contains('show');
        const hits = [...document.querySelectorAll('#hud > *')].filter(e => e.offsetParent && e.textContent.trim()).map(e => [e.id, e.getBoundingClientRect()]).filter(([, t]) => !(a.right <= t.left || a.left >= t.right || a.bottom <= t.top || a.top >= t.bottom)).map(([id]) => id);
        return { vis, hits, text: document.getElementById('toast').textContent.slice(0, 40) }; });
      if (o.vis) { if (o.hits.length) bad++; console.log(w, h, 'toast', JSON.stringify(o)); if (shot++ < 2) await pg.screenshot({ path: `/workspace/ek-design/v392-level-${w}x${h}-${shot}.png` }); }
      await pg.waitForTimeout(1000); } } }
await b.close(); console.log(bad ? 'FAIL overlap/size ' + bad : 'OK no overlap, buttons ok'); process.exit(bad ? 1 : 0);
