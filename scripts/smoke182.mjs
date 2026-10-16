import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0;
for (const lv of ['pilton', 'grassmarket']) {
  const ctx = await b.newContext({ viewport: { width: 459, height: 1024 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(lv + ': ' + e.message));
  await pg.goto(`http://localhost:4199/?level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await pg.click('#startBtn'); await pg.waitForTimeout(1500);
  const fov = await pg.evaluate(() => __game.camera.fov); console.log(lv, 'fov', fov.toFixed(1));
  for (const [d, a, pitch] of [[0.3,30,-0.2],[0.5,40,-0.2],[0.7,50,-0.2],[0.2,0,-0.3],[1.1,120,-0.2],[1.2,-170,0],[2.6,10,0],[2.9,-20,0]]) {
    const r = await pg.evaluate(async ([d, a, pitch]) => { const g = __game, P = g.player.position, y = g.yaw + a * Math.PI / 180;
      g.aim(g.yaw, pitch); g.placeBall(0, P.x - Math.sin(y) * d, P.y - 0.2, P.z - Math.cos(y) * d); g.simulate(0.3);
      const B = g.balls[0].body.position; const real = Math.hypot(B.x - P.x, B.z - P.z);
      await new Promise(r => setTimeout(r, 300)); const lit = g.inReach && document.getElementById('btnKick').classList.contains('inreach');
      const hit = g.kick(0.6); return { real: +real.toFixed(2), lit, hit }; }, [d, a, pitch]);
    const ok = r.lit && r.hit; if (!ok) fail++; console.log(lv, d, a, JSON.stringify(r), ok ? 'OK' : 'FAIL');
    if (lv === 'pilton' && d === 0.5) { await pg.evaluate(() => { const g=__game,P=g.player.position,y=g.yaw+40*Math.PI/180; g.aim(g.yaw,-0.6); g.placeBall(0,P.x-Math.sin(y)*0.6,P.y-0.2,P.z-Math.cos(y)*0.6); g.simulate(0.3); }); await pg.waitForTimeout(400); await pg.screenshot({ path: 'screenshots/v182-ring-at-feet.png' }); }
  }
  await ctx.close();
}
console.log('errors', JSON.stringify(errs), 'fail', fail); await b.close(); process.exit(fail || errs.length ? 1 : 0);
