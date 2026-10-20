// Hands-on playtest of the LIVE site at 915x412 landscape, touch device, using the on-screen controls where possible.
import { chromium } from 'playwright-core';
const URL0 = 'https://missyrupert.github.io/edinburgh-kickabout/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
const log = (...a) => console.log(...a), D = '/workspace/ek-design/v25-play-';
const snap = (n) => pg.screenshot({ path: D + n + '.png' });
const hold = async (sel, ms) => { const r = await (await pg.$(sel)).boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
  await pg.evaluate(([sel, x, y]) => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch' })); el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [new Touch({ identifier: 7, target: el, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: el, clientX: x, clientY: y })] })); }, [sel, x, y]);
  await pg.waitForTimeout(ms);
  await pg.evaluate(([sel, x, y]) => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch' })); el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [new Touch({ identifier: 7, target: el, clientX: x, clientY: y })] })); }, [sel, x, y]); };
const st = () => pg.evaluate(() => ({ lv: __game.level, score: __game.score, done: __game.targets.filter(t => t.done).map(t => t.id), wallet: __game.wallet.pence, p: [+__game.player.position.x.toFixed(1), +__game.player.position.z.toFixed(1)], ball: __game.ballMsg }));
const faceTarget = (id) => pg.evaluate((id) => { const g = __game, t = g.targets.find(t => t.id === id), P = g.player.position; g.aim(Math.atan2(-(t.aim.x - P.x), -(t.aim.z - P.z)), -0.12); }, id);
const walkTo = async (x, z) => { await pg.evaluate(([x, z]) => __game.walk([[x, z]]), [x, z]); await pg.waitForFunction(() => !__game.autopilotActive, null, { timeout: 20000 }).catch(() => log('  (walk timed out)')); };
const tryTarget = async (id) => { const t = await pg.evaluate((id) => { const t = __game.targets.find(t => t.id === id); return [t.stand.x, t.stand.z]; }, id);
  await walkTo(...t); await pg.click('#btnBall').catch(() => {}); await pg.waitForTimeout(600); await faceTarget(id);
  for (const ms of [450, 650, 850]) { const s0 = await st(); if (s0.done.includes(id)) break; await hold('#btnKick', ms); await pg.waitForTimeout(2500); if ((await st()).done.includes(id)) break; await pg.click('#btnBall').catch(() => {}); await pg.waitForTimeout(600); await faceTarget(id); }
  const s = await st(); log(`  ${id}: ${s.done.includes(id) ? 'BAGGED' : 'missed'}  score ${s.score}, wallet ${s.wallet}p, ballMsg ${s.ball}`); };

await pg.goto(URL0 + '?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
log('live version', await pg.textContent('#verTag')); await pg.evaluate(() => { localStorage.clear(); }); await pg.reload(); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
await snap('welcome'); await pg.click('#startBtn'); await pg.waitForTimeout(1500); await snap('pilton-start');
log('PILTON'); await pg.keyboard.down('KeyW'); await pg.waitForTimeout(1500); await pg.keyboard.up('KeyW'); log('  walked', JSON.stringify((await st()).p));
for (const id of ['trolley', 'garage', 'busstop', 'lamp']) await tryTarget(id);
await snap('pilton-after-kicks');
log('  BALL from far away:'); await pg.evaluate(() => __game.placeBall(0, 0, 0.3, 20)); await pg.click('#btnBall'); await pg.waitForTimeout(600); log('  ', JSON.stringify(await st()));
log('  chippy'); await walkTo(-11.6, 31); await walkTo(-11.6, 32.6); await pg.waitForTimeout(1200);
const cnt = await pg.evaluate(() => !document.getElementById('counterCard').classList.contains('hidden')); log('  counter open:', cnt); await snap('chippy-counter');
if (cnt) { log('  supper button:', await pg.textContent('#cnt_supper')); await pg.click('#cntClose'); }
log('SWITCH -> Grassmarket'); await pg.evaluate(() => __game.pause()); await pg.click('#travelBtn'); await pg.waitForFunction(() => window.__game && __game.level === 'grassmarket', null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
log('  at', JSON.stringify((await st()).p)); await snap('grassmarket-start');
for (const id of ['cone', 'lamp', 'bench', 'door']) await tryTarget(id);
await pg.evaluate(() => __game.aim(Math.PI, 0.25)); await pg.waitForTimeout(800); await snap('grassmarket-castle');
log('SWITCH -> Pilton'); await pg.evaluate(() => __game.pause()); await pg.click('#travelBtn'); await pg.waitForFunction(() => window.__game && __game.level === 'pilton', null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const back = await st(); log('  back in Pilton at', JSON.stringify(back.p), 'bagged kept:', back.done.join(',')); await snap('pilton-return');
log('errors', JSON.stringify(errs)); await b.close();
