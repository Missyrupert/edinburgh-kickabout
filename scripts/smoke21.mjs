import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const errs = [], warns = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
const D = '/workspace/ek-design/';
const open = async (lv = 'pilton', start = true) => { await pg.goto(`http://localhost:4199/?level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 }); if (start) { await pg.click('#startBtn'); await pg.waitForTimeout(800); } };
await open('pilton', false); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('ek-wallet-v', '2'); }); await open('pilton', false);
ok(await pg.evaluate(() => document.getElementById('verTag').textContent === 'v3.6'), 'label v3.1.1');
await pg.click('#settingsBtn'); await pg.waitForTimeout(200);
const s1 = await pg.textContent('#soundBtn'); await pg.click('#soundBtn'); const s2 = await pg.textContent('#soundBtn');
ok(s1.includes('on') && s2.includes('off') && await pg.evaluate(() => localStorage.getItem('ek-sound')) === 'off', 'sound toggle saves'); await pg.click('#soundBtn');
await open();
ok(!warns.some(w => /atlas full/.test(w)), 'sign atlas has room');
// movement: walk forward with W for 1 s
const p0 = await pg.evaluate(() => ({ ...__game.player.position })); await pg.keyboard.down('KeyW'); await pg.waitForTimeout(1000); await pg.keyboard.up('KeyW');
const p1 = await pg.evaluate(() => ({ ...__game.player.position })); ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5, 'player walks (' + Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1) + ' m)');
// kick bags the trolley
const hit = await pg.evaluate(() => { const g = __game; const t = g.targets.find(t => t.id === 'trolley'); g.teleport(t.stand.x, t.stand.z, 0); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, -0.1);
  g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(0.6); g.simulate(2.5); return { done: t.done, w: g.wallet.pence }; });
ok(hit.done && hit.w >= 50, 'kick bags trolley (+50p, +25p if clean) ' + JSON.stringify(hit));
// ball retrieval: send ball far away, fetch (free fetch)
const fetched = await pg.evaluate(() => { const g = __game; g.placeBall(0, 0, 0.3, 20); const r = g.requestBall ? g.requestBall() : g.fetchBall(); g.simulate(0.3); const P = g.player.position, B = g.balls[0].body.position; return { r, d: Math.hypot(B.x - P.x, B.z - P.z) }; });
ok(fetched.d < 2, 'BALL fetch brings it to your feet (' + JSON.stringify(fetched) + ')');
// parade does not block the street: walk the pavement in front of the shops
const walk = await pg.evaluate(() => { const g = __game; g.teleport(-14, 31.8, 90); g.walk([[14, 31.8]]); return true; });
await pg.waitForFunction(() => !__game.autopilotActive || __game.player.position.x > 12, null, { timeout: 15000 }).catch(() => {});
const px = await pg.evaluate(() => __game.player.position.x); ok(px > 10, 'walked the length of the parade pavement (x=' + px.toFixed(1) + ')');
// counter still reachable at the Plaice door
ok(await pg.evaluate(() => { const c = __game.counter; return c && Math.abs(c.x + 11.6) < 0.01 && Math.abs(c.z - 32.6) < 0.01; }), 'chippy counter trigger unchanged');
// chippy rule: no unlock before 7/8 even with cash
const ids = await pg.evaluate(() => __game.targets.filter(t => !t.done).map(t => t.id));
let shown = 0; const card = () => pg.evaluate(() => !document.getElementById('goalCard').classList.contains('hidden'));
for (let i = 0; i < ids.length; i++) { await pg.evaluate((id) => __game.scoreTarget(__game.targets.find(t => t.id === id)), ids[i]); await pg.waitForTimeout(2100); const c = await card(); const n = i + 2;
  if (n < 7) ok(!c, `no chippy at ${n}/8`); const wp = await pg.evaluate(() => __game.wallet.pence); if (n >= 7 && wp >= 650 && !shown) { ok(c, 'chippy fires once 7/8 AND £6.50 (n=' + n + ', ' + wp + 'p)'); } if (n === 7 && wp < 650) ok(!c, 'no chippy at 7/8 while under £6.50 (' + wp + 'p)'); if (c) shown = 1; if (false) ok(c, 'x (wallet ' + await pg.evaluate(() => __game.wallet.pence) + 'p)'); if (c) await pg.click('#goalOk'); }
await open(); const st = await pg.evaluate(() => __game.targets.filter(t => t.done).length); ok(st === 8, 'saved progress after reload (' + st + '/8)');
// screenshots
const shot = async (n, x, z, yaw, pitch = 0) => { await pg.evaluate(([x, z, yaw, pitch]) => __game.teleport(x, z, yaw, pitch), [x, z, yaw, pitch]); await pg.waitForTimeout(1500); await pg.evaluate(() => document.getElementById('toast').style.display = 'none'); await pg.waitForTimeout(400); await pg.screenshot({ path: D + 'v21-' + n + '.png' }); };
await shot('parade-wide', 0, 17, 180, 6); await shot('plaice-exterior', -9.5, 27, 180, 4); await shot('counter', -10, 31.6, 180, -2);
await shot('wee-shop', -3, 29.5, 180, 2); await shot('lucky-tattie', 2.5, 29.5, 180, 2); await shot('curl-up-dye', 7.5, 29.5, 180, 2); await shot('video-nasty', 12.5, 29.5, 180, 2);
await shot('clutter', -2.5, 31.2, 200, -12);
await open('grassmarket'); ok(await pg.evaluate(() => __game.targets.length > 0), 'grassmarket loads');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
