// v2.9 Granton: spawn, 10 targets with unique IDs, every target scores with real kicks, sea loss respawns the ball,
// the player can't fall in, surfaces + harbour ambience, level wiring.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=granton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels, amb: __game.sfx.ambience }));
ok(g0.lv === 'granton' && Math.hypot(g0.p.x, g0.p.z + 28) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on Granton Square ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pilton,grassmarket,granton,newhaven', 'level order ' + g0.levels);
ok(/Granton: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Granton goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=granton]')), 'level-select button');
const S = await pg.evaluate(() => [[0, -30], [0, 5], [-20, 15], [16, 40], [-38, -22], [-27, 26], [-50, 40]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['tarmac', 'tarmac', 'setts', 'concrete', 'gravel', 'setts', 'water']), 'surfaces ' + JSON.stringify(S));
// the player can't walk into the harbour, nor off the pier end
for (const [f, t, name, test] of [[[-40, 10], [-40, 40], 'quay edge', 'p.z < 20.6'], [[16, 61], [16, 80], 'pier end', 'p.z < 62.6'], [[16, 40], [0, 40], 'pier side', 'p.x > 9.4'], [[-27, 12], [-27, 40], 'slipway top', 'p.z < 20.6']]) {
  await pg.evaluate(([f, t]) => { __game.teleport(f[0], f[1], 0); __game.walk([t]); }, [f, t]); await pg.waitForTimeout(5000);
  const p = await pg.evaluate(() => ({ ...__game.player.position })); ok(eval(test) && p.y > 0.2, `player stays dry: ${name} ${JSON.stringify(p)}`); }
await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(1500);
// a ball kicked into the harbour comes back
const sea = await pg.evaluate(() => { const g = __game, n0 = g.seaLost; g.teleport(-50, 16, 180, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, P.x, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.kick(0.9); g.simulate(4);
  const bp = g.balls[0].body.position; return { lost: g.seaLost - n0, y: bp.y, home: Math.hypot(bp.x - g.balls[0].home?.x || 0, bp.z - (g.balls[0].home?.z || 0)) }; });
ok(sea.lost >= 1 && sea.y > -1, 'ball lost to the sea respawns ' + JSON.stringify(sea));
await pg.waitForTimeout(400); // let a frame render, then check the returned ball is on screen and a few metres in front (v2.9.3)
const vis = await pg.evaluate(() => { const g = __game, c = g.camera, r = g.lastSeaReturn, v = c.position.clone().set(r.x, r.y, r.z).project(c), P = g.player.position;
  return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)], d: +Math.hypot(r.x - P.x, r.z - P.z).toFixed(2), splash: g.splashT, msg: document.getElementById('toast').innerText.slice(0, 40) }; });
ok(Math.abs(vis.ndc[0]) < 0.9 && Math.abs(vis.ndc[1]) < 0.95 && vis.ndc[2] < 1 && vis.d >= 1 && vis.d <= 4, 'returned ball is in view, a few metres in front ' + JSON.stringify(vis));
ok(/SPLASH/.test(vis.msg), 'splash message shown');
// every target scores with real kicks
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5]) /* v2.9.2: level aim first, as a player would */ for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every Granton target scores with real kicks (tries) ' + JSON.stringify(k));
{ await pg.waitForTimeout(800); const h = await pg.evaluate(() => document.getElementById('goalTxt').innerHTML); ok(/10\/10|cleared|all/i.test(h), 'HUD progress counts up: ' + h + ' ' + await pg.evaluate(() => __game.targets.filter(t => t.done).length + ' ' + document.getElementById('targetVal').textContent)); }
// wiring: Grassmarket -> Granton -> Pilton
await pg.goto(URL + '?level=grassmarket&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Granton/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Grassmarket travels on to Granton');
await pg.goto(URL + '?level=granton&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Newhaven/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Granton travels on to Newhaven');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
