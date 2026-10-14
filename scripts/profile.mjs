// Identical-conditions headless profile: same views, same viewport/profile, SwiftShader software GL.
// Usage: node scripts/profile.mjs <distDir> <label> [query]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const [dir = 'dist', label = 'current', query = ''] = process.argv.slice(2);
const PORT = 4300 + Math.floor(Math.random() * 500);
const server = spawn('npx', ['vite', 'preview', '--outDir', dir, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const profiles = {
  phone: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' },
  desktop: { viewport: { width: 1280, height: 720 } },
};
const out = { label, query, results: [] };
for (const [pname, opts] of Object.entries(profiles)) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/${query}`);
  await page.waitForFunction(() => window.__game && (window.__game.assetsLoaded ?? true), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.start());
  const views = await page.evaluate(() => window.__game.views || {
    spawn: [0, -36, 180, -12], midstreet: [0, 0, 180, -5], terrace: [0, 54, 180, 6, 4.5],
  });
  for (const [vname, v] of Object.entries(views)) {
    const r = await page.evaluate(async (v) => {
      const g = window.__game; g.teleport(v[0], v[1], v[2], v[3], v[4]);
      if (g.setDynRes) g.setDynRes(false); // freeze dynamic resolution so views are comparable
      await new Promise((res) => setTimeout(res, 800));
      const info = g.renderer.info; const ts = [];
      await new Promise((res) => { const f = (t) => { ts.push(t); ts.length < 21 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
      const c = g.renderer.domElement;
      return { frameMs: +((ts[20] - ts[0]) / 20).toFixed(1), calls: info.render.calls, triangles: info.render.triangles,
        textures: info.memory.textures, geometries: info.memory.geometries, programs: info.programs?.length,
        drawPx: `${c.width}x${c.height}`, preset: g.preset || 'n/a', texMB: g.textureMemoryMB ?? null };
    }, v);
    out.results.push({ profile: pname, view: vname, ...r });
    await page.screenshot({ path: `perf/${label}-${pname}-${vname}.png` });
  }
  await ctx.close();
}
await browser.close(); server.kill();
mkdirSync('perf', { recursive: true }); writeFileSync(`perf/${label}.json`, JSON.stringify(out, null, 2));
console.table(out.results);
