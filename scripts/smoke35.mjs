// v3.7 London Road (level 8): spawn, 10 targets, each in <=6 tries, the brae goal is kick-only and a soft uphill kick rolls
// back down the gardens' slope, surfaces, wiring, travel Portobello -> London Road -> Grassmarket.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=londonroad&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels, sp: __game.views.spawn }));
ok(g0.lv === 'londonroad' && Math.hypot(g0.p.x - g0.sp[0], g0.p.z - g0.sp[1]) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on the curve pavement ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,easterroad,portobello,londonroad,grassmarket,royalmile,esplanade', 'level order ' + g0.levels);
ok(/London Road: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows London Road goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=londonroad]')), 'level-select button');
const S = await pg.evaluate(() => [[0, 9], [0, 0], [0, -9], [0, -30], [55, -40]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['paving', 'tarmac', 'paving', 'grass', 'paving']), 'surfaces ' + JSON.stringify(S));
// the gardens slope: a ball placed on the lawn rolls down towards the road (the slope is real physics)
{ const r = await pg.evaluate(() => { const g = __game; g.teleport(-8, -36, 0, 0, 5); g.simulate(0.5); g.placeBall(0, 0, 4.0, -34); g.simulate(0.05); const z0 = g.balls[0].body.position.z; g.simulate(3); const b = g.balls[0].body.position; return { z0, z1: b.z, y: b.y }; });
  ok(r.z1 > r.z0 + 1, 'a ball on the gardens\' slope rolls down towards the road ' + JSON.stringify(r)); }
// brae goal is kick-only: walk it up the slope into the goal -> must not score
{ await pg.evaluate(() => { const g = __game, t = g.targets.find(t => t.id === 'braegoal'), dx = t.aim.x - t.stand.x, dz = t.aim.z - t.stand.z, L = Math.hypot(dx, dz), y = Math.atan2(-dx, -dz);
    g.teleport(t.stand.x, t.stand.z, y * 180 / Math.PI, -10, t.stand.y + 0.6); g.simulate(0.4); const P = g.player.position; g.placeBall(0, P.x + dx / L * 0.8, P.y - 0.2, P.z + dz / L * 0.8); g.simulate(0.2); g.aim(y, 0); g.kick(0.1); g.simulate(0.3); g.walk([[t.aim.x + dx / L * 2, t.aim.z + dz / L * 2]]); });
  await pg.waitForTimeout(8000); const r = await pg.evaluate(() => ({ done: __game.targets.find(t => t.id === 'braegoal').done, b: { ...__game.balls[0].body.position } }));
  ok(!r.done, 'walking the ball up into the brae goal does not score ' + JSON.stringify(r));
  await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x + 0.01, p.z]]); }); await pg.waitForTimeout(800); }
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of (t.aim.y - (t.stand.y || 0) > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0, -15, (t.stand.y || 0) + 0.47); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every London Road target scores with real kicks (tries) ' + JSON.stringify(k));
ok(Object.values(k).every(n => n >= 1 && n <= 6), 'each target in 1-6 tries');
ok(k.shelter === 1, 'easy first target (bus shelter by the spawn) in one kick');
ok(/Grassmarket/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'London Road travels on to the Grassmarket');
await pg.goto(URL + '?level=portobello&preset=low'); await pg.waitForFunction(() => window.__game); ok(/London Road/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Portobello travels on to London Road');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
