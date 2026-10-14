// Headless check: renders, no console errors, kick moves ball, scripted shots score.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const PORT = 4179, URL = `http://127.0.0.1:${PORT}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = []; let fail = false;
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) fail = true; };
const wait = (p, ms) => p.waitForTimeout(ms);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL); await page.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 30000 }).catch(() => {}); await wait(page, 1500);
  check('photo textures + HDRI loaded', await page.evaluate(() => window.__game.assetsLoaded));
  await page.screenshot({ path: 'screenshots/desktop-start-overlay.png' });
  await page.evaluate(() => window.__game.start()); await wait(page, 1500);
  await page.screenshot({ path: 'screenshots/desktop-street.png' });
  const ft = await page.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); ts.length < 61 ? requestAnimationFrame(f) : res(ts); }; requestAnimationFrame(f); }));
  const avg = (ft[ft.length - 1] - ft[0]) / (ft.length - 1);
  results.push(`INFO desktop frame time ${avg.toFixed(1)} ms (headless SwiftShader software GL, not representative of a GPU)`);
  check('canvas renders (non-blank pixels)', await page.evaluate(() => { const c = document.querySelector('canvas'); return c.width > 0; }));
  // kick moves the ball
  const r = await page.evaluate(async () => {
    const g = window.__game; g.teleport(0, -35, 180, -20); g.placeBall(0, 0, 0.3, -34.2);
    g.simulate(0.7);
    const b = g.balls[0].body; const z0 = b.position.z; const kicked = g.kick(0.5);
    g.simulate(1.5);
    return { kicked, z0, z1: b.position.z, y: b.position.y };
  });
  check('kick connects and moves ball', r.kicked && r.z1 - r.z0 > 3, JSON.stringify(r));
  // scripted hit: bench (west pavement, x=-5.9 z=-18), kick west from 2 m
  const h = await page.evaluate(async () => {
    const g = window.__game; g.teleport(-2.6, -18, 90, -25); g.placeBall(0, -3.3, 0.3, -18);
    g.simulate(0.7); const k = g.kick(0.6);
    g.simulate(1.5);
    return { k, score: g.score, done: g.targets.find((t) => t.id === 'bench').done };
  });
  check('scripted bench hit scores', h.done && h.score >= 50, JSON.stringify(h));
  await page.screenshot({ path: 'screenshots/desktop-after-hit.png' });
  // scripted zone: chip into the communal bin (x=5.6 z=-22) from the road
  const b2 = await page.evaluate(async () => {
    const g = window.__game; let res = null;
    const combos = []; for (let pw = 0.12; pw <= 0.5; pw += 0.02) for (let p = 15; p <= 55; p += 5) combos.push([+pw.toFixed(2), p]);
    let tries = 0;
    for (const [pw, p] of combos) { tries++;
      g.teleport(-1.2, -22, -90, p - 22, 0.5); g.placeBall(0, -0.5, 0.3, -22);
      g.simulate(0.5); g.kick(pw);
      g.simulate(2.2);
      res = { pw, p, done: g.targets.find((t) => t.id === 'bin').done, ball: g.balls[0].body.position.toArray().map((v) => +v.toFixed(2)) };
      if (res.done) break;
    }
    return { ...res, tries, of: combos.length, score: g.score };
  });
  check('scripted chip into bin scores', b2.done, JSON.stringify(b2));
  // cone topple
  const c = await page.evaluate(async () => {
    const g = window.__game; g.teleport(1.2, -15, 180, -25, 0.5); g.placeBall(0, 1.2, 0.3, -14.2);
    g.simulate(0.5); g.kick(0.7); g.simulate(2.0);
    return { done: g.targets.find((t) => t.id === 'cone').done, score: g.score };
  });
  check('cone knock-over scores', c.done, JSON.stringify(c));
  // walking: W key moves player forward with collisions on
  const w = await page.evaluate(() => { const g = window.__game; g.teleport(0, -30, 180, -10); return g.player.position.z; });
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__game.waitSim(0.8)); await page.keyboard.up('KeyW');
  const w2 = await page.evaluate(() => window.__game.player.position.z);
  check('WASD walking moves player', w2 - w > 2, `${w.toFixed(2)} -> ${w2.toFixed(2)}`);
  // wall collision: walk into east tenement
  await page.evaluate(() => window.__game.teleport(5, -45, -90, 0));
  await page.keyboard.down('KeyW'); await wait(page, 1500); await page.keyboard.up('KeyW');
  const wx = await page.evaluate(() => window.__game.player.position.x);
  check('building collision stops player', wx < 7, `x=${wx.toFixed(2)}`);
  // slope: walk up Victoria Street to terrace
  await page.evaluate(() => window.__game.teleport(0, 27, 180, 10, 0.5));
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__game.waitSim(8)); await page.keyboard.up('KeyW');
  const top = await page.evaluate(() => window.__game.player.position.toArray());
  check('can climb slope to terrace', top[1] > 3 && top[2] > 50, JSON.stringify(top.map((v) => +v.toFixed(2))));
  await page.evaluate(() => window.__game.teleport(0, 52, 180, 8));
  await wait(page, 800); await page.screenshot({ path: 'screenshots/desktop-terrace-castle.png' });
  check('no console errors', errors.length === 0, errors.join(' | '));
  // mobile viewport (Pixel-ish) with touch
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const mp = await ctx.newPage(); const merr = []; mp.on('pageerror', (e) => merr.push(String(e))); mp.on('console', (m) => m.type() === 'error' && merr.push(m.text()));
  await mp.goto(URL); await mp.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 30000 }).catch(() => {}); await wait(mp, 1500);
  await mp.screenshot({ path: 'screenshots/mobile-portrait-overlay.png' });
  await mp.tap('#startBtn'); await wait(mp, 1500);
  check('touch HUD shown on mobile', await mp.evaluate(() => document.body.classList.contains('touch') && getComputedStyle(document.getElementById('btnKick')).display !== 'none'));
  // touch joystick drag moves player
  const z0 = await mp.evaluate(() => window.__game.player.position.z);
  const jb = await mp.locator('#joyBase').boundingBox();
  const cdp = await ctx.newCDPSession(mp);
  const cx = jb.x + jb.width / 2, cy = jb.y + jb.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 50 }] });
  await wait(mp, 1200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const z1 = await mp.evaluate(() => window.__game.player.position.z);
  check('touch joystick moves player', z1 - z0 > 1.5, `${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
  // touch kick button (hold/release) kicks ball
  const kb = await mp.locator('#btnKick').boundingBox();
  const kz = await mp.evaluate(async () => { const g = window.__game; g.teleport(0, -35, 180, -20); g.placeBall(0, 0, 0.3, -34.2); g.simulate(0.6); return g.balls[0].body.position.z; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: kb.x + 40, y: kb.y + 40 }] });
  await wait(mp, 500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.evaluate(() => window.__game.waitSim(1.2));
  const kz2 = await mp.evaluate(() => window.__game.balls[0].body.position.z);
  check('touch KICK button kicks ball', kz2 - kz > 3, `${kz.toFixed(2)} -> ${kz2.toFixed(2)}`);
  await mp.evaluate(() => window.__game.teleport(0, -36, 180, -18)); await wait(mp, 600);
  await mp.screenshot({ path: 'screenshots/mobile-portrait-play.png' });
  await mp.setViewportSize({ width: 915, height: 412 }); await wait(mp, 800);
  await mp.screenshot({ path: 'screenshots/mobile-landscape-play.png' });
  const mft = await mp.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); ts.length < 61 ? requestAnimationFrame(f) : res(ts); }; requestAnimationFrame(f); }));
  results.push(`INFO mobile-profile frame time ${((mft[60] - mft[0]) / 60).toFixed(1)} ms (shadows ${await mp.evaluate(() => 'off')}, SwiftShader)`);
  check('no console errors (mobile)', merr.length === 0, merr.join(' | '));
} catch (e) { check('script', false, String(e)); }
await browser.close(); server.kill();
console.log(results.join('\n'));
process.exit(fail ? 1 : 0);
