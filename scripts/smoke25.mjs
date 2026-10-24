import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
const EXP = { pennywell: [4.2, -27], leith: [26, -4], newhaven: [14, -13], granton: [0, -28],  pilton: [0, -38], grassmarket: [3, -10], easterroad: [-24, -36], portobello: [50, -6], londonroad: [-43.45, -0.03] };
const check = async (want, how) => { await pg.waitForFunction(() => window.__game, null, { timeout: 30000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position } })); const [ex, ez] = EXP[want];
  ok(r.lv === want && Math.hypot(r.p.x - ex, r.p.z - ez) < 0.5 && r.p.y > 0.3 && r.p.y < 0.6, `${how}: ${want} spawn on the ground ${JSON.stringify(r.p)}`); };
await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await check('pilton', 'start');
for (let i = 0; i < 2; i++) for (const to of ['granton', 'newhaven', 'leith', 'easterroad', 'portobello', 'londonroad', 'grassmarket', 'pennywell', 'pilton']) { await pg.evaluate(() => __game.pause()); await pg.click('#travelBtn'); await check(to, `travel #${i + 1}`); }
// via the welcome-screen level buttons, and after a reload
await pg.reload(); await pg.waitForFunction(() => window.__game); await pg.click('[data-level=pilton]'); await check('pilton', 'level button');
await pg.reload(); await check('pilton', 'reload');
// lost player comes back to the spawn
await pg.evaluate(() => __game.teleport(60, 80, 0)); await pg.waitForTimeout(600); ok(await pg.evaluate(() => Math.hypot(__game.player.position.x, __game.player.position.z + 38) < 1 && __game.respawns > 0), 'out-of-bounds player returns to spawn');
// can't walk out past the parade corner any more (old gap at x>28, z 27-43)
await pg.evaluate(() => { __game.teleport(26, 38, 90); __game.walk([[40, 38]]); }); await pg.waitForTimeout(4000); ok(await pg.evaluate(() => __game.player.position.x < 28), 'wall closes the old gap by the hedge');
// Grassmarket surfaces + targets
await pg.goto('http://localhost:4199/?level=grassmarket&preset=low'); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(800);
const S = await pg.evaluate(() => [[0, 0], [0, 21], [0, -17], [22.5, -41], [35, -40], [30, -26], [-60, 30]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['setts', 'paving', 'tarmac', 'grass', 'paving', 'setts', 'setts']), 'Grassmarket surfaces ' + JSON.stringify(S));
ok(await pg.evaluate(() => __game.sfx.ambience === 'oldtown'), 'Old Town ambience selected');
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const id of ['lamp', 'door', 'post', 'cone']) { const t = g.targets.find(t => t.id === id); if (!t || !t.stand) continue; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, -0.1);
  for (const p of [0.5, 0.65, 0.8]) { if (t.done) break; g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(3); } res[id] = t.done; } return res; });
ok(Object.values(k).filter(Boolean).length >= 2, 'Grassmarket targets score with real kicks ' + JSON.stringify(k));
await pg.evaluate(() => document.getElementById('toast').style.display = 'none');
const D = '/tmp/v25re-', shot = async (n, v) => { await pg.evaluate((v) => __game.teleport(...v), v); await pg.waitForTimeout(1500); await pg.screenshot({ path: D + n + '.png' }); };
await shot('grassmarket-wide', [0, -44, 180, 6]); await shot('castle', [1, 12, 180, 14]); await shot('shopfronts', [3, -44, 140, 2]);
await shot('setts', [0, -20, 180, -35]); await shot('clutter', [2, -45, 150, -4]); await shot('memorial', [1, 20, 160, -10]);
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
