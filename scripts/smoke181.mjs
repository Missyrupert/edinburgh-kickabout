import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0;
for (const lv of ['grassmarket', 'pilton']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(lv + ': ' + e.message));
  await pg.goto(`http://localhost:4199/?debug&level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await pg.click('#startBtn'); await pg.waitForTimeout(2000);
  for (const [d, a, shot] of [[0.8, 50, true], [1.8, -70, false], [1.0, 160, false]]) {
    const pre = await pg.evaluate(async ([d, a]) => { const g = __game, P = g.player.position, y = g.yaw + a * Math.PI / 180;
      g.aim(g.yaw, -0.25); g.placeBall(0, P.x - Math.sin(y) * d, P.y - 0.25, P.z - Math.cos(y) * d); g.simulate(0.2);
      await new Promise(r => setTimeout(r, 400)); return { inReach: g.inReach, glow: document.getElementById('btnKick').classList.contains('inreach') }; }, [d, a]);
    if (shot && lv === 'grassmarket') await pg.screenshot({ path: 'screenshots/v181-ring-0.8m-50left.png' });
    const k = await pg.evaluate(() => { const g = __game, P = g.player.position, f = [-Math.sin(g.yaw), -Math.cos(g.yaw)];
      const hit = g.kick(0.6); const bb = g.world.bodies.find(x => x === x) && null; return { hit, f }; });
    const v = await pg.evaluate(() => { const g = __game; const b = g.world.bodies.filter(x => x.shapes[0]?.radius === 0.22)[0]; const f = [-Math.sin(g.yaw), -Math.cos(g.yaw)]; const h = Math.hypot(b.velocity.x, b.velocity.z) || 1; return { cosAlongFwd: (b.velocity.x * f[0] + b.velocity.z * f[1]) / h }; });
    const ok = pre.inReach && pre.glow && k.hit && v.cosAlongFwd > 0.95; if (!ok && a !== 160) fail++;
    console.log(lv, d, a, JSON.stringify({ ...pre, hit: k.hit, ...v, ok }));
  }
  await ctx.close();
}
console.log('errors', JSON.stringify(errs), 'fail', fail); await b.close(); process.exit(fail || errs.length ? 1 : 0);
