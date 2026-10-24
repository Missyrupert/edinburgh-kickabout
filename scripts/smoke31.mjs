// v3.1 Leith (from smoke30): spawn, 10 targets, every target scores, a ball in the Water of Leith is LOST FOR GOOD
// (old ball drifts away downstream, a fresh one at your feet), the player can't fall in, surfaces, wiring.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=leith&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__game); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels }));
ok(g0.lv === 'leith' && Math.hypot(g0.p.x - 26, g0.p.z + 4) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on the Shore ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,grassmarket', 'level order ' + g0.levels);
ok(/Leith: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Leith goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=leith]')), 'level-select button');
{ const L = await pg.evaluate(() => Object.fromEntries(['btnKick', 'btnJump', 'btnBall'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; })));
  ok(L.btnJump.y < L.btnKick.y - 40 && Math.abs(L.btnJump.x - L.btnKick.x) < 40 && L.btnBall.x < L.btnKick.x - 60, 'v3.0.1 layout: JUMP above KICK, BALL left of KICK ' + JSON.stringify(L)); }
const S = await pg.evaluate(() => [[0, -4], [0, -11], [-10, 9], [4, 9]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['setts', 'paving', 'water', 'setts']), 'surfaces ' + JSON.stringify(S));
for (const [f, t, name, test] of [[[-10, -1], [-10, 30], 'south quay parapet', 'p.z < 3.9'], [[30, -1], [30, 30], 'east quay parapet', 'p.z < 3.9'], [[4, -6], [4, 18], 'over the bridge to the north bank', 'p.z > 14.5']]) {
  await pg.evaluate(([f, t]) => { __game.teleport(f[0], f[1], 0); __game.walk([t]); }, [f, t]); await pg.waitForTimeout(6000);
  const p = await pg.evaluate(() => ({ ...__game.player.position })); ok(eval(test) && p.y > 0.2, `player stays dry: ${name} ${JSON.stringify(p)}`); }
await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(1500);
// a ball kicked over the parapet into the river is lost for good
const sea = await pg.evaluate(() => { const g = __game, n0 = g.seaLost; g.teleport(-10, 0, 180); g.simulate(0.3); const P = g.player.position; g.aim(Math.PI, 0.4); g.placeBall(0, P.x, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.kick(0.75); g.simulate(4); g.aim(Math.PI, -0.1);
  const bp = g.balls[0].body.position; return { lost: g.seaLost - n0, x: bp.x, y: bp.y, z: bp.z }; });
ok(sea.lost >= 1 && sea.y > -0.5 && sea.z < 4, 'ball in the river is lost; a fresh ball is on the quay ' + JSON.stringify(sea));
await pg.waitForTimeout(400);
const vis = await pg.evaluate(() => { const g = __game, c = g.camera, r = g.lastSeaReturn, v = c.position.clone().set(r.x, r.y, r.z).project(c), P = g.player.position;
  return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)], d: +Math.hypot(r.x - P.x, r.z - P.z).toFixed(2), decoys: g.riverDecoys, msg: document.getElementById('toast').innerText.slice(0, 160) }; });
ok(Math.abs(vis.ndc[0]) < 0.9 && Math.abs(vis.ndc[1]) < 0.95 && vis.ndc[2] < 1 && vis.d >= 1 && vis.d <= 4, 'fresh ball in view, a few metres in front ' + JSON.stringify(vis.ndc) + ' d=' + vis.d);
ok(/SPLASH/.test(vis.msg) && /fresh ball/i.test(vis.msg) && !/back at your feet/i.test(vis.msg), 'lost-for-good message: ' + vis.msg.replace(/\n/g, ' | '));
ok(vis.decoys.length >= 1 && vis.decoys[0].z > 4 && vis.decoys[0].z < 14, 'the lost ball stays in the river ' + JSON.stringify(vis.decoys));
await pg.waitForTimeout(2500);
const d2 = await pg.evaluate(() => __game.riverDecoys); ok(d2.length >= 1 && d2[0].x > vis.decoys[0].x + 1, 'and drifts away downstream ' + JSON.stringify(d2));
// v3.1.1: dribbling/carrying the ball onto the bridge deck must NOT count (bridgetop is kick-only)
{ await pg.evaluate(() => { const g = __game; g.teleport(4, -2.5, 180, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, 4, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.aim(Math.PI, 0); g.kick(0.12); g.simulate(0.5); g.walk([[4, 9]]); });
  await pg.waitForTimeout(9000); const r = await pg.evaluate(() => ({ done: __game.targets.find(t => t.id === 'bridgetop').done, b: { ...__game.balls[0].body.position }, p: { ...__game.player.position } }));
  ok(!r.done, 'carrying the ball up onto the bridge does not score bridgetop ' + JSON.stringify(r));
  await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x, p.z + 0.01]]); }); await pg.waitForTimeout(800); }
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5]) /* v2.9.2: level aim first, as a player would */ for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every Leith target scores with real kicks (tries) ' + JSON.stringify(k));
await pg.goto(URL + '?level=newhaven&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Leith/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Newhaven travels on to Leith');
await pg.goto(URL + '?level=leith&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Grassmarket/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Leith travels on to the Grassmarket');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
