// v3.5.1 Easter Road (level 6: Easter Road main street, Albion Road turning left to the ground): spawn, 10 targets, every target scores in <=6 tries, the turnstile goal is kick-only,
// surfaces, wiring, travel Leith -> Easter Road -> Grassmarket.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage();
pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (m.type() === 'error' || /atlas full/.test(m.text())) errs.push(m.text()); });
await pg.goto(URL + '?level=easterroad&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const g0 = await pg.evaluate(() => ({ lv: __game.level, p: { ...__game.player.position }, ids: __game.targets.map(t => t.id), levels: __game.levels }));
ok(g0.lv === 'easterroad' && Math.hypot(g0.p.x + 24, g0.p.z + 36) < 0.5 && g0.p.y > 0.3 && g0.p.y < 0.6, 'spawn on Easter Road ' + JSON.stringify(g0.p));
ok(g0.ids.length === 10 && new Set(g0.ids).size === 10, 'targets ' + g0.ids.join(','));
ok(g0.levels.join() === 'pennywell,pilton,granton,newhaven,leith,easterroad,portobello,grassmarket', 'level order ' + g0.levels);
ok(/Easter Road: <b>0\/10/.test(await pg.evaluate(() => document.getElementById('goalTxt').innerHTML)), 'HUD shows Easter Road goals');
ok(await pg.evaluate(() => !!document.querySelector('[data-level=easterroad]')), 'level-select button');
const S = await pg.evaluate(() => [[-24, -36], [-30, -36], [0, 0], [0, 5], [28, 0], [36, -5]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['tarmac', 'paving', 'tarmac', 'paving', 'setts', 'paving']), 'surfaces ' + JSON.stringify(S));
// turnstile goal is kick-only: dribble the ball up to and through the open turnstile -> must not score
{ await pg.evaluate(() => { const g = __game; g.teleport(29, -5, 270, -10); g.simulate(0.3); const P = g.player.position; g.placeBall(0, P.x + 0.8, P.y - 0.2, -5); g.simulate(0.2); g.aim(-Math.PI / 2, 0); g.kick(0.12); g.simulate(0.5); g.walk([[40, -5]]); });
  await pg.waitForTimeout(8000); const r = await pg.evaluate(() => ({ done: __game.targets.find(t => t.id === 'turnstile').done, b: { ...__game.balls[0].body.position } }));
  ok(!r.done, 'dribbling through the turnstile does not score ' + JSON.stringify(r));
  await pg.evaluate(() => { const p = __game.player.position; __game.walk([[p.x - 0.01, p.z]]); }); await pg.waitForTimeout(800); }
const k = await pg.evaluate(() => { const g = __game, res = {}; for (const t of g.targets) { let n = 0;
  for (const pitch of (t.aim.y > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) /* chip targets: a player lofts it first */ for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; });
ok(Object.values(k).every(Boolean), 'every Easter Road target scores with real kicks (tries) ' + JSON.stringify(k));
ok(Object.values(k).every(n => n >= 1 && n <= 6), 'each target in 1-6 tries');
ok(k.fanzine === 1, 'easy first target (fanzine board by the spawn) in one kick');
ok(k.crossbar <= 4, 'crossbar challenge in <=4 tries');
ok(/Portobello/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Easter Road travels on to Portobello');
await pg.goto(URL + '?level=leith&preset=low'); await pg.waitForFunction(() => window.__game); ok(/Easter Road/.test(await pg.evaluate(() => document.getElementById('travelBtn').textContent)), 'Leith travels on to Easter Road');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
