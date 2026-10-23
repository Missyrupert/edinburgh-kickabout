// v3.0 Newhaven (from smoke29): spawn, 10 targets with unique IDs, every target scores with real kicks, sea loss respawns the ball,
// the player can't fall in, surfaces + harbour ambience, level wiring.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=newhaven&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels, amb: __game.sfx.ambience }));
ok(g0.lv === 'newhaven' && Math.hypot(g0.p.x - 14, g0.p.z + 13) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on Main Street ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pilton,grassmarket,granton,newhaven', 'level order ' + g0.levels);
ok(/Newhaven: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Newhaven goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=newhaven]')), 'level-select button');
{ const L = await pg.evaluate(() => Object.fromEntries(['btnKick', 'btnJump', 'btnBall'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; })));
  ok(L.btnJump.y < L.btnKick.y - 40 && Math.abs(L.btnJump.x - L.btnKick.x) < 40 && L.btnBall.x < L.btnKick.x - 60, 'v3.0.1 layout: JUMP above KICK, BALL left of KICK ' + JSON.stringify(L)); }
const S = await pg.evaluate(() => [[0, 5], [0, -14], [-27, 20], [30, 20], [0, 20]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['paving', 'setts', 'concrete', 'concrete', 'water']), 'surfaces ' + JSON.stringify(S));
// the player can't walk into the harbour, nor off the pier end
for (const [f, t, name, test] of [[[0, 8], [0, 30], 'quay edge', 'p.z < 12.6'], [[-27, 28], [-27, 45], 'pier end', 'p.z < 32.6'], [[-27, 20], [-15, 20], 'pier side', 'p.x < -23.4'], [[30, 20], [15, 20], 'east quay side', 'p.x > 23.4']]) {
  await pg.evaluate(([f, t]) => { __game.teleport(f[0], f[1], 0); __game.walk([t]); }, [f, t]); await pg.waitForTimeout(5000);
  const p = await pg.evaluate(() => ({ ...__game.player.position })); ok(eval(test) && p.y > 0.2, `player stays dry: ${name} ${JSON.stringify(p)}`); }
await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(1500);
// a ball kicked into the harbour comes back
const sea = await pg.evaluate(() => { const g = __game, n0 = g.seaLost; g.teleport(0, 10, 180, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, P.x, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.kick(0.9); g.simulate(4);
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
ok(Object.values(k).every(Boolean), 'every Newhaven target scores with real kicks (tries) ' + JSON.stringify(k));
{ await pg.waitForTimeout(800); const h = await pg.evaluate(() => document.getElementById('goalTxt').innerHTML); ok(/10\/10|cleared|all/i.test(h), 'HUD progress counts up: ' + h + ' ' + await pg.evaluate(() => __game.targets.filter(t => t.done).length + ' ' + document.getElementById('targetVal').textContent)); }
// wiring: Granton -> Newhaven -> Pilton
await pg.goto(URL + '?level=granton&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Newhaven/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Granton travels on to Newhaven');
await pg.goto(URL + '?level=newhaven&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Pilton/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Newhaven travels on to Pilton');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
