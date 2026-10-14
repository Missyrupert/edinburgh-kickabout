// Extra screenshots: ball close-up, close, bend. Usage: node scripts/shots.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const PORT = 4391; const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/?preset=high`); await page.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 40000 });
await page.evaluate(() => window.__game.start());
const shot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(1200); await page.screenshot({ path: `screenshots/${name}.png` }); };
await shot('ball-closeup', () => { const g = window.__game; g.teleport(0, -35, 180, -55); g.placeBall(0, 0, 0.3, -34.35); g.simulate(0.3); g.teleport(0, -35, 180, -55); g.camera.fov = 30; g.camera.updateProjectionMatrix(); });
await shot('ball-rolling', () => { const g = window.__game; g.camera.fov = 70; g.camera.updateProjectionMatrix(); g.teleport(0, -35, 180, -30); g.placeBall(0, 0, 0.3, -34.2); g.simulate(0.3); g.kick(0.25); g.simulate(0.25); });
await shot('kickers-close', () => { const g = window.__game; g.teleport(-2, -9.25, 90, 2); });
await shot('bend-victoria-st', () => { const g = window.__game; g.teleport(-2, 12, 180, 4); });
await shot('backcourt', () => { const g = window.__game; g.teleport(-12.5, -9.25, 90, 0); });
await browser.close(); server.kill();
