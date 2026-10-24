import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
const open = async (lv) => { await pg.goto(`http://localhost:4199/?level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1200); };
await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 }); await pg.waitForTimeout(1500);
await pg.screenshot({ path: '/workspace/ek-design/v2-welcome.png' });
ok(await pg.evaluate(() => document.fonts.check('40px "Alfa Slab One"')), 'Alfa Slab One loaded');
ok(await pg.evaluate(async () => (await (await fetch('version.json', { cache: 'no-store' })).json()).v === document.getElementById('verTag').textContent), 'HUD label matches version.json');
await open('pilton'); await pg.evaluate(() => { localStorage.clear(); __game.resetProgress(); }); await open('pilton');
const near = await pg.evaluate(() => { const P = __game.player.position; return __game.targets.map(t => ({ id: t.id, tier: t.tier, diff: t.diff, d: Math.hypot(t.pos.x - P.x, t.pos.z - P.z) })).sort((a, b) => a.d - b.d).slice(0, 3); });
console.log(JSON.stringify(near)); ok(near[0].id === 'trolley' && near[0].diff === 'easy', 'nearest target to spawn is the easy trolley');
const intro = await pg.evaluate(() => document.getElementById('toast').innerText); console.log('toast:', intro);
// is the trolley on the right as seen from spawn?
const side = await pg.evaluate(() => { const t = __game.targets.find(t => t.id === 'trolley'); const v = t.pos.clone(); v.y = 0.5; v.project(__game.camera); return v.x; });
ok(side > 0, 'trolley is on screen-right from spawn (ndc x ' + side.toFixed(2) + ')');
await pg.screenshot({ path: '/workspace/ek-design/v2-pilton-start.png' });
// real kick: ball at feet at trolley stand, aim at trolley
const hit = await pg.evaluate(async () => { const g = __game; const t = g.targets.find(t => t.id === 'trolley');
  g.teleport(t.stand.x, t.stand.z, 0); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, -0.1);
  g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(0.6); g.simulate(2.5); return t.done; });
ok(hit, 'a plain kick from the trolley stand bags it');
// bag bus stop, reload, check persistence + colour
await pg.evaluate(() => __game.scoreTarget(__game.targets.find(t => t.id === 'busstop'))); await open('pilton');
const st = await pg.evaluate(() => __game.targets.map(t => [t.id, t.done, '#' + t.ring.material.color.getHexString()]));
console.log(JSON.stringify(st)); const bs = st.find(s => s[0] === 'busstop'), lp = st.find(s => s[0] === 'lamp');
ok(bs[1] && bs[2] !== lp[2], 'bagged ring persisted after reload and differs from unbagged');
await pg.evaluate(() => __game.teleport(0, -6.5, 180, -24)); await pg.waitForTimeout(5000);
await pg.screenshot({ path: '/workspace/ek-design/v2-rings.png' });
await pg.evaluate(() => __game.teleport(-6, 22, 180, 4)); await pg.waitForTimeout(2500); await pg.screenshot({ path: '/workspace/ek-design/v2-pilton-chippy.png' });
await pg.evaluate(() => __game.teleport(-3, 6, 90, -6)); await pg.waitForTimeout(2500); await pg.screenshot({ path: '/workspace/ek-design/v2-pilton-garages.png' });
await open('grassmarket'); await pg.waitForTimeout(800); await pg.screenshot({ path: '/workspace/ek-design/v2-grassmarket.png' });
ok(await pg.evaluate(() => __game.targets.length > 0), 'grassmarket loads');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
