import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const server = spawn('npx', ['vite', 'preview', '--port', '4180', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://127.0.0.1:4180/'); await page.waitForTimeout(1500);
console.log(await page.evaluate(async () => {
  const g = window.__game; g.start(); const out = []; const B = g.balls[0].body; const f=a=>a.toArray().map(v=>v.toFixed(2)).join(',');
  g.teleport(0, -35, 180, -20); g.placeBall(0, 0, 0.3, -34.2); g.simulate(0.7); g.kick(0.5); g.simulate(1.5);
  g.teleport(-2.6, -18, 90, -25); g.placeBall(0, -3.3, 0.3, -18); g.simulate(0.7);
  out.push('pl '+f(g.player.position)+' ball '+f(B.position));
  out.push('kick ' + g.kick(0.6)+' v '+f(B.velocity));
  for (let i = 0; i < 10; i++) { g.simulate(0.05); out.push(f(B.position)+' v '+f(B.velocity)); }
  out.push('bench '+g.targets.find(t=>t.id==='bench').done);
  const cone = g.targets.find(t=>t.id==='cone');
  g.teleport(1.2, -15, 180, -25, 0.5); g.placeBall(0, 1.2, 0.3, -14.2); g.simulate(0.5);
  out.push('cone '+f(cone.body.position)+' kick ' + g.kick(0.7)+' v '+f(B.velocity));
  for (let i = 0; i < 8; i++) { g.simulate(0.1); out.push(f(B.position)+' cone '+f(cone.body.position)+' q '+f(cone.body.quaternion)); }
  return out.join('\n');
}));
await browser.close(); server.kill();
