// Castle before/after screenshots. Usage: node scripts/castle-shots.mjs <label> [query]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const [label = 'now', query = ''] = process.argv.slice(2);
const PORT = 4520 + Math.floor(Math.random() * 300);
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const profiles = {
  desktop: { viewport: { width: 1280, height: 720 } },
  phone: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
};
for (const [pn, opts] of Object.entries(profiles)) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${query}`); await page.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 40000 });
  await page.evaluate(() => window.__game.start());
  const views = await page.evaluate(() => window.__game.views);
  // zoomed: from the terrace, narrow FOV aimed at the castle
  views.zoom = [...views.terrace]; views.zoom[2] = Math.atan2(-(22 - views.zoom[0]), -(215 - views.zoom[1])) * 180 / Math.PI; views.zoom[3] = 15;
  for (const [vn, v] of Object.entries(views)) {
    await page.evaluate(([v, z]) => { const g = window.__game; g.teleport(v[0], v[1], v[2], v[3], v[4]); g.setDynRes(false); g.camera.fov = z ? 34 : 70; g.camera.updateProjectionMatrix(); }, [v, vn === 'zoom']);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots/castle-${label}-${pn}-${vn}.png` });
  }
  await ctx.close();
}
await browser.close(); server.kill();
