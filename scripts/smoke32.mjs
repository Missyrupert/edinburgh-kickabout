// v3.2 Pennywell Road (level 1): fresh players start here, spawn, 10 targets, every target scores in <=6 tries,
// the school-gate goal is kick-only (no dribbling in), surfaces, wiring, travel loop, saved level still loads.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
// saved level still loads; a fresh save starts at Pennywell
await pg.goto(URL + '?preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('ek-level', 'leith'); }); await pg.goto(URL + '?preset=low'); await pg.waitForFunction(() => window.__game);
ok(await pg.evaluate(() => __game.level) === 'leith', 'existing save (Leith) still loads');
await pg.evaluate(() => localStorage.clear()); await pg.goto(URL + '?preset=low'); await pg.waitForFunction(() => window.__game);
ok(await pg.evaluate(() => __game.level) === 'pennywell', 'new player starts at Pennywell');
await pg.goto(URL + '?level=pennywell&preset=low'); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels }));
ok(g0.lv === 'pennywell' && Math.hypot(g0.p.x - 4.2, g0.p.z + 27) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn outside Haddon\'s ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,easterroad,portobello,londonroad,grassmarket,royalmile,esplanade', 'level order ' + g0.levels);
ok(/Pennywell: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Pennywell goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=pennywell]')), 'level-select button');
const S = await pg.evaluate(() => [[0, -25], [0, 0], [5, 0], [9, 0]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['paving', 'tarmac', 'paving', 'grass']), 'surfaces ' + JSON.stringify(S));
// school gate is kick-only: dribble the ball through the gate gap -> must not score
{ await pg.evaluate(() => { const g = __game; g.teleport(0, 38, 180, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, 0, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.aim(Math.PI, 0); g.kick(0.12); g.simulate(0.5); g.walk([[0, 52]]); });
  await pg.waitForTimeout(8000); const r = await pg.evaluate(() => ({ done: __game.targets.find(t => t.id === 'schoolgate').done, b: { ...__game.balls[0].body.position } }));
  ok(!r.done, 'dribbling through the school gate does not score ' + JSON.stringify(r));
  await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(800); }
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of (t.aim.y > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) /* chip targets: a player lofts it first */ for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every Pennywell target scores with real kicks (tries) ' + JSON.stringify(k));
ok(Object.values(k).every(n => n >= 1 && n <= 6), 'each target in 1-6 tries');
ok(/Pilton/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Pennywell travels on to Pilton');
await pg.goto(URL + '?level=esplanade&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Pennywell/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'the last level (Esplanade) loops back to Pennywell');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
