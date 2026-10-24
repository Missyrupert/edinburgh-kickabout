// v3.8 Royal Mile (level 10): spawn, 10 targets each in 1-6 tries, the close ramp runs downhill, the close goal is kick-only,
// surfaces, wiring, travel Grassmarket -> Royal Mile -> Esplanade.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=royalmile&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels, sp: __game.views.spawn }));
ok(g0.lv === 'royalmile' && Math.hypot(g0.p.x - g0.sp[0], g0.p.z - g0.sp[1]) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on the High Street ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,easterroad,portobello,londonroad,grassmarket,royalmile,esplanade', 'level order ' + g0.levels);
ok(/Royal Mile: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Royal Mile goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=royalmile]')), 'level-select button');
const S = await pg.evaluate(() => [[0, 0], [-30, 7], [20, -10]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['setts', 'paving', 'setts']), 'surfaces ' + JSON.stringify(S));
{ const r = await pg.evaluate(() => { const g = __game; g.teleport(20, -3, 180, 0, 0.47); g.simulate(0.3); g.placeBall(0, 20, 0.3, 13); g.simulate(16); const b = g.balls[0].body.position; return { z: b.z, y: b.y, done: g.targets.find(t => t.id === 'closedown').done }; });
  ok(r.z > 26 && r.y < -1.6, 'a ball at the top of the close runs doon tae the bottom ' + JSON.stringify(r)); ok(!r.done, 'but a ball that was not kicked does not score the close'); }
const kickAll = (only) => pg.evaluate((only) => { const g = __game, res = {}; for (const t of g.targets) { if (only && !only.includes(t.id)) continue; let n = 0;
  for (const pitch of (t.aim.y - (t.stand.y || 0) > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0, -15, (t.stand.y || 0) + 0.47); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; }, only);
const k = await kickAll();
ok(Object.values(k).every(Boolean), 'every Royal Mile target scores with real kicks (tries) ' + JSON.stringify(k));
ok(Object.values(k).every(n => n >= 1 && n <= 6), 'each target in 1-6 tries');
ok(k.busker === 1, 'easy first target (the performers\' pitch by the spawn) in one kick');
ok(/Esplanade/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Royal Mile travels on to the Esplanade');
await pg.goto(URL + '?level=grassmarket&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Royal Mile/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Grassmarket travels on to the Royal Mile');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
