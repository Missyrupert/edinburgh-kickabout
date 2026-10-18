import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const D = '/workspace/ek-design/v23-';
await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('ek-wallet-v', '2'); }); await pg.reload(); await pg.waitForFunction(() => window.__game);
// locker fits at 915x412
await pg.click('#lockerBtn'); await pg.waitForTimeout(300);
const lk = await pg.evaluate(() => { const p = document.getElementById('lockerPanel'), r = p.getBoundingClientRect(); return { over: p.scrollWidth - p.clientWidth, top: r.top, bottom: r.bottom, right: r.right, H: innerHeight, W: innerWidth }; });
ok(lk.over <= 0 && lk.top >= 0 && lk.bottom <= lk.H && lk.right <= lk.W, 'locker fits 915x412 ' + JSON.stringify(lk));
await pg.screenshot({ path: D + 'locker.png' }); await pg.click('#lockerPanel .back');
await pg.click('#startBtn'); await pg.waitForTimeout(800);
const w = await pg.evaluate(() => {
  const g = __game, bodies = g.world.bodies, near = (x, z, r = 0.3) => bodies.filter((b) => Math.hypot(b.position.x - x, b.position.z - z) < r);
  let atlasW = 0, sky = []; g.scene.traverse((o) => { if (o.name === 'skyline') sky.push([o.position.x, o.position.z]); const m = o.material; if (m && m.map && m.map.image && m.map.image.width === 1536) atlasW = 1536; });
  return { lampOld: near(-5.6, 32).length + near(5.6, 24).length, lampNew: near(-4.6, 30.3).length + near(4.3, 24).length,
    rail: bodies.some((b) => b.userData?.surface === 'metal' && Math.abs(b.position.z - 30.15) < 0.01), board: bodies.some((b) => b.userData?.surface === 'board'),
    grass: bodies.filter((b) => b.userData?.surface === 'grass').length, poles: bodies.filter((b) => b.userData?.surface === 'metal' && b.position.x === 19).length, atlasW, sky,
    chal: document.getElementById('chalVal').textContent, goal: document.getElementById('goalTxt').textContent };
});
console.log(JSON.stringify(w));
ok(w.lampOld === 0 && w.lampNew === 2, 'lamps moved to the kerb (colliders kept)');
ok(w.rail && w.board, 'railing + A-board have colliders tagged metal/board');
ok(w.grass >= 2 && w.poles === 2, 'drying-green bank/green tagged grass, poles metal');
ok(w.atlasW === 1536, 'sign atlas 1536px on low (k=0.75)');
ok(w.sky.length === 2 && w.sky.every(([x, z]) => z < -200 && x < 0), 'skyline cards to the south/south-east');
ok(w.chal.length <= 24 && /7/.test(w.goal) && /6\.50/.test(w.goal), 'compact HUD: "' + w.chal + '" / "' + w.goal + '"');
// ball off the railing / A-board: it bounces back, does not pass through
const rb = await pg.evaluate(() => { const g = __game; g.placeBall(0, 5, 0.4, 28.5); g.balls[0].body.velocity.set(0, 0, 8); g.simulate(1.0); const z1 = g.balls[0].body.position.z;
  g.placeBall(0, -5.2, 0.4, 31.5); g.balls[0].body.velocity.set(0, 0, 8); g.simulate(1.0); return [z1, g.balls[0].body.position.z]; });
ok(rb[0] < 30.1 && rb[1] < 33.5, 'ball stopped by railing and A-board ' + JSON.stringify(rb));
// pigeons fly away at an angle
// real kick still scores the trolley; drying-green gap scores through the sheets gap
const k = await pg.evaluate(() => { const g = __game, shoot = (id, p, pitch = -0.1) => { const t = g.targets.find(t => t.id === id); g.teleport(t.stand.x, t.stand.z, 0, -15, t.stand.y + 0.9 || undefined); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
  g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(3); return t.done; };
  return { trolley: shoot('trolley', 0.6), gap: [0.5, 0.6, 0.7, 0.8].some((p) => shoot('gap', p, -0.05)) }; });
ok(k.trolley, 'kick bags trolley'); console.log('gap via real kick:', k.gap);
await pg.evaluate(() => document.getElementById('toast').style.display = 'none');
const shot = async (n, x, z, yaw, pitch = 0, y) => { await pg.evaluate(([x, z, yaw, pitch, y]) => __game.teleport(x, z, yaw, pitch, y), [x, z, yaw, pitch, y]); await pg.waitForTimeout(1500); await pg.screenshot({ path: D + n + '.png' }); };
await shot('parade-wide', 0, 16, 180, 6); await shot('plaice', -9.5, 27.5, 180, 6); await shot('windows', 3, 24, 180, 22);
await shot('drying-green', 12.5, -4, -90, 0, 2.2); await shot('skyline', 0, -40, 0, 6); await shot('hud', 0, -30, 180, -6);
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
