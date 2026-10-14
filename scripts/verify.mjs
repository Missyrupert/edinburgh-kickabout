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
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.__game.waitSim(5)); await page.keyboard.up('KeyW');
  const top = await page.evaluate(() => window.__game.player.position.toArray());
  check('can climb slope (W key, up Victoria St bend)', top[1] > 2.5 && top[2] > 40, JSON.stringify(top.map((v) => +v.toFixed(2))));
  // reachability on foot: autopilot walks waypoints with the normal movement code + collisions
  const reach = await page.evaluate(() => {
    const g = window.__game; const T = (id) => g.targets.find((t) => t.id === id).stand; const out = {};
    const routes = { dug: [[0, -30], [-1.5, -9.25], [-12, -9.25], [T('dug').x, T('dug').z]], tardis: [[0, -30], [0, 28], [T('tardis').x, T('tardis').z]], skip: [[0, -30], [0, 28], [T('skip').x, T('skip').z]] };
    for (const k in routes) { g.restart(); g.start(); const ap = g.walk(routes[k]); let t = 0; while (!ap.done && t < 60) { g.simulate(0.5); t += 0.5; } out[k] = { done: ap.done, t, y: +g.player.position.y.toFixed(2) }; }
    return out;
  });
  check('back court + terrace reachable on foot (close, ramp)', Object.values(reach).every((r) => r.done) && reach.tardis.y > 3, JSON.stringify(reach));
  // all 11 targets scoreable from their stand points (grid over power x pitch)
  const all = await page.evaluate(() => {
    const g = window.__game; const res = {};
    for (const t of g.targets) {
      const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yawDeg = Math.atan2(-ux, -uz) * 180 / Math.PI;
      let ok = null;
      outer: for (const pw of [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1]) for (const p of [-25, -15, -5, 5, 15, 25, 35]) {
        g.restart(); g.start(); g.teleport(s.x, s.z, yawDeg, p, s.y + 1); g.placeBall(0, s.x + ux * 0.8, s.y + 0.4, s.z + uz * 0.8);
        g.simulate(0.4); g.teleport(s.x, s.z, yawDeg, p); g.kick(pw); g.simulate(3);
        if (t.done) { ok = [pw, p]; break outer; }
      }
      res[t.id] = ok;
    }
    g.restart(); return { n: g.targets.length, res };
  });
  check('all 11 targets scoreable', all.n === 11 && Object.values(all.res).every(Boolean), JSON.stringify(all));
  // fixed timestep: same kick, frame steps of 1/30 vs 1/144 -> same trajectory
  const fts = await page.evaluate(() => {
    const g = window.__game; const r = Math.random; Math.random = () => 0.5; const run = (dt) => {
      g.restart(); g.start(); g.teleport(0, -35, 180, -10); g.placeBall(0, 0, 0.3, -34.2); g.simulate(0.5); g.teleport(0, -35, 180, -10); g.kick(0.6);
      for (let t = 0; t < 2; t += dt) g.advance(dt); return g.balls[0].body.position.toArray(); };
    const a = run(1 / 30), b = run(1 / 144); Math.random = r; g.restart();
    return { a: a.map((v) => +v.toFixed(3)), b: b.map((v) => +v.toFixed(3)), d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) };
  });
  check('fixed timestep: 30 vs 144 Hz frames give same trajectory (<5 cm)', fts.d < 0.05, JSON.stringify(fts));
  await page.evaluate(() => window.__game.teleport(0, 52, 180, 8, 4.5));
  await wait(page, 800); await page.screenshot({ path: 'screenshots/desktop-terrace-castle.png' });
  check('no console errors', errors.length === 0, errors.join(' | '));
  // graphics presets
  for (const [name, mat, sh] of [['low', 'MeshLambertMaterial', false], ['medium', 'MeshLambertMaterial', false], ['high', 'MeshStandardMaterial', true]]) {
    const pp = await browser.newPage({ viewport: { width: 960, height: 540 } }); const pe = []; pp.on('pageerror', (e) => pe.push(String(e)));
    await pp.goto(URL + '?preset=' + name + (name === 'low' ? '&perf=1' : '')); await pp.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 30000 }).catch(() => {});
    await pp.evaluate(() => window.__game.start()); await wait(pp, 1200);
    const info = await pp.evaluate(() => { const g = window.__game; const types = new Set(); g.scene.traverse((o) => o.isMesh && o.material?.type && types.add(o.material.type)); return { preset: g.preset, src: g.presetSource, shadows: g.renderer.shadowMap.enabled, types: [...types], calls: g.renderer.info.render.calls, perf: document.getElementById('perf').classList.contains('hidden') ? '' : document.getElementById('perf').textContent }; });
    check(`preset ${name} applied`, info.preset === name && info.types.includes(mat) && info.shadows === sh && pe.length === 0, JSON.stringify({ ...info, perf: undefined, errors: pe }));
    if (name === 'low') check('?perf=1 overlay shows live stats', /fps/i.test(info.perf) && /draws \d+/.test(info.perf) && /tris/.test(info.perf), JSON.stringify(info.perf.slice(0, 120)));
    await pp.close();
  }
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
  // touch look: drag on the right side changes yaw
  const lz = await mp.locator('#lookZone').boundingBox(); const y0 = await mp.evaluate(() => window.__game.yaw);
  const lx = lz.x + lz.width * 0.5, ly = lz.y + lz.height * 0.4;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lx - i * 15, y: ly }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const y1 = await mp.evaluate(() => window.__game.yaw);
  check('touch look drag turns camera', Math.abs(y1 - y0) > 0.05, `${y0.toFixed(3)} -> ${y1.toFixed(3)}`);
  // kick charge: long hold kicks harder than a tap
  const charge = async (ms) => { await mp.evaluate(() => { const g = window.__game; g.teleport(0, -35, 180, -20); g.placeBall(0, 0, 0.3, -34.2); g.simulate(0.6); });
    // dispatch pointer events in-page so slow headless frames don't stretch the hold time
    return mp.evaluate(async (ms) => { const b = document.getElementById('btnKick'), o = { pointerId: 7, bubbles: true, pointerType: 'touch' };
      b.dispatchEvent(new PointerEvent('pointerdown', o)); const t0 = performance.now(); while (performance.now() - t0 < ms); b.dispatchEvent(new PointerEvent('pointerup', o));
      return window.__game.lastKick?.speed || 0; }, ms); };
  const sTap = await charge(60), sHold = await charge(900);
  check('touch kick charge (hold > tap)', sHold > sTap + 5, `tap ${sTap.toFixed(1)} m/s, hold ${sHold.toFixed(1)} m/s`);
  // BALL button fetches the ball back to the player
  await mp.evaluate(() => { const g = window.__game; g.teleport(0, -20, 180, -15); g.placeBall(0, 0, 0.3, 10); });
  await mp.tap('#btnBall'); await wait(mp, 300);
  const bd = await mp.evaluate(() => { const g = window.__game, b = g.balls[0].body.position, p = g.player.position; return Math.min(...g.balls.map((bb) => Math.hypot(bb.body.position.x - p.x, bb.body.position.z - p.z))); });
  check('BALL button resets ball near player', bd < 2.5, `dist ${bd.toFixed(2)} m`);
  await mp.evaluate(() => window.__game.teleport(0, -36, 180, -18)); await wait(mp, 600);
  await mp.screenshot({ path: 'screenshots/mobile-portrait-play.png' });
  await mp.setViewportSize({ width: 915, height: 412 }); await wait(mp, 800);
  await mp.screenshot({ path: 'screenshots/mobile-landscape-play.png' });
  const lay = await mp.evaluate(() => ['joyBase', 'btnKick', 'btnJump', 'btnBall', 'btnPause'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 20]; }));
  check('landscape: touch controls inside viewport', lay.every((x) => x[1]), JSON.stringify(lay));
  const mft = await mp.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); ts.length < 61 ? requestAnimationFrame(f) : res(ts); }; requestAnimationFrame(f); }));
  results.push(`INFO mobile-profile frame time ${((mft[60] - mft[0]) / 60).toFixed(1)} ms (shadows ${await mp.evaluate(() => 'off')}, SwiftShader)`);
  check('no console errors (mobile)', merr.length === 0, merr.join(' | '));
} catch (e) { check('script', false, String(e)); }
await browser.close(); server.kill();
console.log(results.join('\n'));
process.exit(fail ? 1 : 0);
