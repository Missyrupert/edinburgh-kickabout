// v3.6 Portobello Promenade (level 7): spawn, 10 targets, every target scores in <=6 tries, the groyne goal is kick-only,
// the sand slows a rolling ball (same kick rolls much less far on sand than on the prom), the sea splashes and returns the ball
// (Granton rule, not Leith's), surfaces, wiring, travel Easter Road -> Portobello -> Grassmarket.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=portobello&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels }));
ok(g0.lv === 'portobello' && Math.hypot(g0.p.x - 50, g0.p.z + 6) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on the prom ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,easterroad,portobello,londonroad,grassmarket,royalmile', 'level order ' + g0.levels);
ok(/Portobello: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Portobello goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=portobello]')), 'level-select button');
const S = await pg.evaluate(() => [[50, -6], [50, -12], [0, 10], [0, 40], [25, 2]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['tarmac', 'paving', 'sand', 'water', 'concrete']), 'surfaces ' + JSON.stringify(S));
// the sand slows the ball: identical kick on the prom and on the sand, compare roll distance (kick physics identical)
{ const roll = (x, z) => pg.evaluate(([x, z]) => { const g = __game; g.teleport(x, z, 90, 0, z > 0 ? -1.1 : 0.5); g.simulate(0.6); const P = g.player.position; g.aim(Math.PI / 2, 0); g.placeBall(0, P.x - 0.8, P.y - 0.2, P.z); g.simulate(0.2); const b0 = { ...g.balls[0].body.position }; g.kick(0.35); const v0 = g.balls[0].body.velocity.length(); g.simulate(6); const b1 = g.balls[0].body.position; return { d: +Math.hypot(b1.x - b0.x, b1.z - b0.z).toFixed(2), v0: +v0.toFixed(2) }; }, [x, z]);
  const prom = await roll(45, -8), sand = await roll(-6, 20);
  ok(Math.abs(prom.v0 - sand.v0) < 0.05, 'same kick speed on prom and sand ' + JSON.stringify({ prom, sand }));
  ok(sand.d < prom.d * 0.6, 'ball rolls much less far on sand ' + JSON.stringify({ prom: prom.d, sand: sand.d })); }
// the sea: splash, message, ball returns (not lost for good)
{ const r = await pg.evaluate(() => { const g = __game, n0 = g.seaLost; g.teleport(0, 32.6, 180, 0, -1.1); g.simulate(0.6); const P = g.player.position; g.aim(Math.PI, 0); g.placeBall(0, P.x, P.y - 0.2, P.z + 0.8); g.simulate(0.2); g.kick(0.6); g.simulate(5); const b = g.balls[0].body.position; return { lost: g.seaLost - n0, ret: g.lastSeaReturn, b: { x: b.x, y: b.y, z: b.z }, decoys: g.riverDecoys.length }; });
  ok(r.lost >= 1 && r.ret && r.b.y > -1.9 && r.b.z < 34 && r.decoys === 0, 'kicked into the Forth: splash and the ball comes back ' + JSON.stringify(r)); }
// groyne goal is kick-only: dribble through the gap -> must not score
{ await pg.evaluate(() => { const g = __game; g.teleport(17.2, 12.5, 90, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, P.x - 0.8, P.y - 0.2, 12.5); g.simulate(0.2); g.aim(Math.PI / 2, 0); g.kick(0.1); g.simulate(0.5); g.walk([[9, 12.5]]); });
  await pg.waitForTimeout(8000); const r = await pg.evaluate(() => ({ done: __game.targets.find(t => t.id === 'groyne').done, b: { ...__game.balls[0].body.position } }));
  ok(!r.done, 'dribbling through the groyne gap does not score ' + JSON.stringify(r));
  await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x + 0.01, p.z]]); }); await pg.waitForTimeout(800); }
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of (t.aim.y - (t.stand.y || 0) > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0, -15, (t.stand.y || 0) + 0.47); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every Portobello target scores with real kicks (tries) ' + JSON.stringify(k));
ok(Object.values(k).every(n => n >= 1 && n <= 6), 'each target in 1-6 tries');
ok(k.kiosk === 1, 'easy first target (ice-cream kiosk by the spawn) in one kick');
ok(/London Road/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Portobello travels on to London Road');
await pg.goto(URL + '?level=easterroad&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Portobello/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Easter Road travels on to Portobello');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
