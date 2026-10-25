import { chromium } from 'playwright-core';
const [URL, tag] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w, h] of [[412, 915], [915, 412], [667, 360]]) { const pg = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage();
  await pg.goto(URL + (URL.includes('?') ? '&' : '?') + 'level=royalmile&preset=low'); await pg.waitForTimeout(5000);
  await pg.screenshot({ path: `/workspace/ek-design/v391-${tag}-menu-${w}x${h}.png` });
  const sizes = await pg.evaluate(() => [...document.querySelectorAll('[data-level]')].map(e => Math.round(e.getBoundingClientRect().height)));
  console.log(tag, w, h, 'button heights', Math.min(...sizes), Math.max(...sizes));
  if (w === 412) { await pg.click('#startBtn'); await pg.waitForTimeout(2500); await pg.screenshot({ path: `/workspace/ek-design/v391-${tag}-level-412x915.png` });
    for (let i = 0; i < 8; i++) { const o = await pg.evaluate(() => { const a = document.getElementById('toast').getBoundingClientRect(), t = document.getElementById('targetVal').closest('div').getBoundingClientRect(), vis = getComputedStyle(document.getElementById('toast')).opacity > 0.1 && a.width > 0; return { vis, overlap: vis && !(a.right <= t.left || a.left >= t.right || a.bottom <= t.top || a.top >= t.bottom), a: [a.left, a.top, a.right, a.bottom].map(Math.round), t: [t.left, t.top, t.right, t.bottom].map(Math.round) }; }); if (o.vis) console.log('toast', JSON.stringify(o)); await pg.waitForTimeout(1000); } } }
await b.close();
