// v3.10 core loop (replaces the West Pilton smokes 20/201/21, archived in scripts/archive): version label, sound toggle, walk, kick bags a
// Pennywell target, BALL fetch, no visible leg, menu = 12 tiles (10 playable + 2 'Coming soon'), travel follows the order, the chippy
// in the Locker sells a supper once you have £6.50, fullscreen setting present, saved progress survives a reload.
import { chromium } from 'playwright-core';
const URL = process.argv[2] || 'http://localhost:4199/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
const open = async (lv = 'pennywell', start = true) => { await pg.goto(`${URL}?debug&level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 }); if (start) { await pg.click('#startBtn'); await pg.waitForTimeout(300); } };
await open('pennywell', false); await pg.evaluate(() => localStorage.clear()); await open('pennywell', false);
const ver = await (await fetch(URL + 'version.json')).json().catch(() => ({}));
ok(await pg.evaluate((v) => document.getElementById('verTag').textContent === v, ver.v), 'version label matches version.json ' + ver.v);
const menu = await pg.evaluate(() => ({ tiles: [...document.querySelectorAll('.card.menu .levels button')].map(e => e.querySelector('b').textContent), soon: [...document.querySelectorAll('.levels button.soon')].map(e => e.disabled && !e.dataset.level), order: __game.levels }));
const SOON = Number(process.env.EK_SOON ?? 1); // v3.13: Princes Street still Coming soon; 0 once it opens
ok(menu.tiles.length === 12 && menu.soon.length === SOON && menu.soon.every(Boolean), `menu: 12 tiles, ${SOON} disabled Coming soon ` + menu.tiles.join(' | '));
ok(!menu.order.includes('pilton') && menu.order[0] === 'pennywell' && menu.order.at(-1) === 'esplanade', 'order: no West Pilton, Pennywell first, Esplanade last');
ok(/Granton/.test(await pg.textContent('#travelBtn')), 'travel from Pennywell goes to Granton');
await pg.click('#settingsBtn'); await pg.waitForTimeout(200);
const s1 = await pg.textContent('#soundBtn'); await pg.click('#soundBtn'); const s2 = await pg.textContent('#soundBtn');
ok(s1.includes('on') && s2.includes('off') && await pg.evaluate(() => localStorage.getItem('ek-sound')) === 'off', 'sound toggle saves'); await pg.click('#soundBtn');
ok(/Fullscreen/.test(await pg.textContent('#fsBtn')), 'Fullscreen setting present: ' + await pg.textContent('#fsBtn'));
await open();
ok(await pg.evaluate(() => __game.legShown === false), 'no leg/foot in the scene');
const p0 = await pg.evaluate(() => ({ ...__game.player.position })); await pg.keyboard.down('KeyW'); await pg.waitForTimeout(1000); await pg.keyboard.up('KeyW');
const p1 = await pg.evaluate(() => ({ ...__game.player.position })); ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5, 'player walks');
const hit = await pg.evaluate(() => { const g = __game; for (const t of g.targets.filter(t => t.kind === 'hit')) { for (let i = 0; i < 4 && !t.done; i++) { g.teleport(t.stand.x, t.stand.z, 0); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, Math.atan2(t.aim.y - 1.25, Math.hypot(dx, dz)) * 180 / Math.PI);
  g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(0.5 + i * 0.12); g.simulate(2.5); } if (t.done) return { id: t.id, w: g.wallet.pence }; } return null; });
ok(hit && hit.w > 0, 'a scripted kick bags a Pennywell target and pays ' + JSON.stringify(hit));
const fetched = await pg.evaluate(() => { const g = __game; g.placeBall(0, 0, 0.3, 20); g.requestBall ? g.requestBall() : g.fetchBall(); g.simulate(0.3); const P = g.player.position, B = g.balls[0].body.position; return Math.hypot(B.x - P.x, B.z - P.z); });
ok(fetched < 2, 'BALL fetch brings it to your feet');
await pg.evaluate(() => { localStorage.setItem('ek-wallet', JSON.stringify({ pence: 700, goalSeen: true, suppers: 0, total: 700 })); });
await open('pennywell', false); await pg.click('#lockerBtn'); await pg.click('#lockerChippy'); await pg.waitForTimeout(200);
const c = await pg.evaluate(() => ({ vis: !document.getElementById('counterCard').classList.contains('hidden'), sup: document.getElementById('cnt_supper').disabled }));
ok(c.vis && !c.sup, 'Locker opens the chippy; supper buyable with £7.00');
await pg.click('#cnt_supper'); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => __game.wallet.pence === 50 && __game.wallet.suppers === 1), 'supper bought: £6.50 spent, 1 supper');
await open(); ok(await pg.evaluate(() => __game.targets.filter(t => t.done).length >= 1), 'progress survives reload');
console.log('errors', JSON.stringify(errs)); await b.close(); console.log(fail || errs.length ? 'FAILED' : 'ALL OK'); process.exit(fail || errs.length ? 1 : 0);
