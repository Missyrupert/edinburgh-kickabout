// v3.10 layout check: menu + in-game 'Nearby' pill at 4 sizes; pill must not overlap joystick/buttons/HUD/toast; no leg in the scene.
import { chromium } from 'playwright-core';
const URL = process.argv[2] || 'http://localhost:4199/', TAG = process.argv[3] || 'v310';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let bad = 0; const ov = (a, t) => !(a[2] <= t[0] || a[0] >= t[2] || a[3] <= t[1] || a[1] >= t[3]);
for (const [w, h] of [[412, 915], [360, 640], [915, 412], [667, 360]]) {
  const pg = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })).newPage();
  await pg.goto(URL + '?debug&level=granton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 }); await pg.waitForTimeout(800);
  await pg.screenshot({ path: `/workspace/ek-design/${TAG}-menu-${w}x${h}.png` });
  const m = await pg.evaluate(() => ({ n: document.querySelectorAll('.card.menu .levels button').length, sel: document.querySelectorAll('[data-level]').length, minH: Math.min(...[...document.querySelectorAll('.card.menu .levels button')].map(e => e.getBoundingClientRect().height)) }));
  console.log(w, h, 'menu tiles', m.n, 'selectable', m.sel, 'min height', Math.round(m.minH)); if (m.n !== 12 || m.sel !== 10 || m.minH < 44) bad++;
  await pg.click('#startBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const t = __game.targets[0]; __game.teleport(t.pos.x + 2.5, t.pos.z + 2.5, 0); });
  await pg.waitForTimeout(9000); // let the opening toasts pass
  for (const withToast of [false, true]) {
    if (withToast) { await pg.evaluate(() => { const el = document.getElementById('toast'); el.innerHTML = '<b>Pretend toast</b><br>a longer message here so the box is tall enough to test'; el.classList.add('show'); }); await pg.waitForTimeout(400); }
    const r = await pg.evaluate(() => { const q = (e) => { const x = e.getBoundingClientRect(); return [x.left, x.top, x.right, x.bottom]; };
      const nb = document.getElementById('nearby'), fs = parseFloat(getComputedStyle(nb).fontSize);
      const others = [...document.querySelectorAll('#joyBase, #btnKick, #btnJump, #btnBall, #btnPause, #hud > *')].filter(e => e.offsetParent && e.getBoundingClientRect().width).map(e => [e.id, q(e)]);
      const t = document.getElementById('toast'); if (t.classList.contains('show')) others.push(['toast', q(t)]);
      return { text: nb.textContent, fs, nb: q(nb), others, leg: __game.legShown }; });
    const hits = r.text ? r.others.filter(([, o]) => ov(r.nb, o)).map(([id]) => id) : ['(no hint showing)'];
    console.log(w, h, withToast ? 'with toast' : 'hint only', 'font', r.fs, 'pill', r.nb.map(Math.round).join(','), 'overlaps', JSON.stringify(hits), 'leg', r.leg, '|', r.text.slice(0, 50));
    if (hits.length || r.fs < 18 || r.leg) bad++;
    await pg.screenshot({ path: `/workspace/ek-design/${TAG}-nearby-${w}x${h}${withToast ? '-toast' : ''}.png` }); }
  await pg.close(); }
await b.close(); console.log(bad ? 'FAIL ' + bad : 'ALL OK'); process.exit(bad ? 1 : 0);
