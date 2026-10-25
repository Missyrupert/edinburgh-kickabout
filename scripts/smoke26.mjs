import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto('http://localhost:4199/?debug&level=grassmarket&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const sp = await pg.evaluate(() => ({ ...__game.player.position })); ok(Math.hypot(sp.x - 3, sp.z + 10) < 0.5 && sp.y > 0.3 && sp.y < 0.6, 'spawn on the setts ' + JSON.stringify(sp));
ok(await pg.evaluate(() => __game.targets.length === 11 && ['bin','bench','cone','lamp','close','dug','door','post','case','tardis','skip'].every(id => __game.targets.some(t => t.id === id))), '11 targets, same IDs');
ok(/Grassmarket: <b>0\/11/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Grassmarket goals, not the Pilton supper');
// bounds: walk hard at every edge, and up Victoria Street
for (const [from, to, test, name] of [[[0, 0], [0, 40], 'p.z < 22', 'north terrace'], [[0, 0], [0, -40], 'p.z > -22', 'south terrace'], [[50, 0], [90, 0], 'p.x < 64', 'west end'], [[-50, 5], [-90, 5], 'p.x > -64', 'east end'],
  [[-57, 18], [-60, 60], 'p.z > 24 && p.z < 34 && p.y < 3', 'Victoria Street stop'], [[30, -15], [30, -60], 'p.z > -50', 'back court wall']]) {
  await pg.evaluate(([f, t]) => { __game.teleport(f[0], f[1], 0); __game.walk([t]); }, [from, to]); await pg.waitForTimeout(6000);
  const p = await pg.evaluate(() => ({ ...__game.player.position })); ok(eval(test) && p.y > 0.2, `bounds: ${name} ${JSON.stringify(p)}`); }
await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(1500);
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { if (!t.stand) continue; let n = 0;
  for (const pitch of [-0.45, -0.3, -0.15, 0.0, 0.12, 0.25, 0.35, 0.5]) for (const p of [0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(3.5); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'all Grassmarket targets scoreable with real kicks (tries) ' + JSON.stringify(k));
ok(/Grassmarket: <b>11\/11|cleared/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD progress counts up');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
