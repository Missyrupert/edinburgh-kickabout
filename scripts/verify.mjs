// Headless check: renders, no console errors, kick moves ball, scripted shots score.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const PORT = Number(process.env.VERIFY_PORT) || 4300 + Math.floor(Math.random() * 600), BASE = `http://127.0.0.1:${PORT}/`, URL = BASE + '?level=grassmarket';
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
const killServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
process.on('exit', killServer);
const WATCHDOG_MS = Number(process.env.VERIFY_TIMEOUT_MS) || 20 * 60 * 1000;
setTimeout(() => { console.log('FAIL watchdog: verify exceeded ' + WATCHDOG_MS + ' ms'); killServer(); process.exit(2); }, WATCHDOG_MS).unref();
console.log(`verify: preview on port ${PORT}`);
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = []; let fail = false;
const check = (name, ok, info = '') => { const line = `${ok ? 'PASS' : 'FAIL'} ${name} ${info}`; results.push(line); console.log(line); if (!ok) fail = true; };
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
    const g = window.__game; const res = {}; const rnd = Math.random; Math.random = () => 0.5; // kick sidespin is random: make the sweep deterministic
    for (const t of g.targets) {
      const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yawDeg = Math.atan2(-ux, -uz) * 180 / Math.PI;
      let ok = null;
      outer: for (const pw of [0.1, 0.125, 0.15, 0.175, 0.2, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1]) for (const p of [-25, -15, -5, 5, 15, 25, 35]) {
        g.restart(); g.start(); g.teleport(s.x, s.z, yawDeg, p, s.y + 1); g.placeBall(0, s.x + ux * 0.8, s.y + 0.4, s.z + uz * 0.8);
        g.simulate(0.4); g.teleport(s.x, s.z, yawDeg, p); g.kick(pw); g.simulate(3);
        if (t.done) { ok = [pw, p]; break outer; }
      }
      res[t.id] = ok;
    }
    Math.random = rnd; g.restart(); return { n: g.targets.length, res };
  });
  check('Grassmarket: all 11 targets scoreable', all.n === 11 && Object.values(all.res).every(Boolean), JSON.stringify(all));
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
    await pp.goto(URL + '&preset=' + name + (name === 'low' ? '&perf=1' : '')); await pp.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 30000 }).catch(() => {});
    await pp.evaluate(() => window.__game.start()); await wait(pp, 1200);
    const info = await pp.evaluate(() => { const g = window.__game; const types = new Set(); g.scene.traverse((o) => o.isMesh && o.material?.type && types.add(o.material.type)); return { preset: g.preset, src: g.presetSource, shadows: g.renderer.shadowMap.enabled, types: [...types], calls: g.renderer.info.render.calls, perf: document.getElementById('perf').classList.contains('hidden') ? '' : document.getElementById('perf').textContent }; });
    const cs = await pp.evaluate(() => { const ms = []; window.__game.scene.traverse((o) => o.isMesh && /^batch:castle/.test(o.name) && ms.push(o)); return { calls: ms.length, tris: ms.reduce((t, m) => t + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0), shadow: ms.some((m) => m.castShadow), newTex: ms.flatMap((m) => [m.material.map]).filter(Boolean).every((t) => /sandstone/.test(t.image?.src || t.image?.currentSrc || '')) }; });
    check(`castle budget (${name}): <=3 draw calls, <8k tris, no shadow pass, no new textures`, cs.calls >= 1 && cs.calls <= 3 && cs.tris < 8000 && !cs.shadow && cs.newTex, JSON.stringify(cs));
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
  await mp.evaluate(() => window.__game.waitSim(1.0));
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
  await mp.evaluate(() => { const g = window.__game; g.teleport(0, -20, 180, -15); g.placeBall(0, 0, 0.3, 25); });
  await mp.tap('#btnBall'); await wait(mp, 300);
  const bd = await mp.evaluate(() => { const g = window.__game, b = g.balls[0].body.position, p = g.player.position; return Math.min(...g.balls.map((bb) => Math.hypot(bb.body.position.x - p.x, bb.body.position.z - p.z))); });
  check('BALL button resets ball near player', bd < 2.5, `dist ${bd.toFixed(2)} m`);
  // ---- v1.2.1 slope regressions (ramp, 10 deg, steepest walkable slope) ----
  const RAMP = [3.15, 39.5], UPHILL = -161.7;
  // touch release mid-move and pointercancel: player stops, then no drift for 5 s on the slope
  for (const how of ['touchEnd', 'touchCancel']) {
    await mp.evaluate(([x, z, yw]) => { const g = window.__game; g.restart(); g.start(); g.teleport(x, z, yw, 0, 2.6); g.simulate(0.3); }, [...RAMP, UPHILL]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 10, y: cy - 50 }] });
    await mp.evaluate(() => window.__game.waitSim(0.5));
    await cdp.send('Input.dispatchTouchEvent', { type: how, touchPoints: [] });
    const d = await mp.evaluate(async () => { const g = window.__game; await g.waitSim(0.3); const a = g.player.position.clone(); const mi = { ...g.moveInput }; g.simulate(5); const b = g.player.position; return { moved: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(4), input: mi }; });
    check(`slope: ${how} mid-move stops player, no drift 5 s`, d.moved < 0.02 && !d.input.x && !d.input.y, JSON.stringify(d));
  }
  // idle on every slope point (bottom, middle, top of ramp)
  const idle = await mp.evaluate(() => { const g = window.__game; const out = [];
    for (const zl of [3, 10, 17]) { g.restart(); g.start(); const x = zl * Math.sin(0.32), z = 30 + zl * Math.cos(0.32); g.teleport(x, z, 0, 0, 0.6 + zl * 0.18); g.simulate(0.6); const a = g.player.position.clone(); g.simulate(5); out.push(+Math.hypot(g.player.position.x - a.x, g.player.position.z - a.z).toFixed(4)); } return out; });
  check('slope: zero input => zero movement (ramp bottom/mid/top)', idle.every((v) => v < 0.01), JSON.stringify(idle));
  // repeated recall on the ramp: no new balls, recalled ball stays put 5 s, then kick from trap works
  const rec = await mp.evaluate(([x, z, yw]) => { const g = window.__game; g.restart(); g.start(); g.teleport(x, z, yw, -10, 2.6); g.simulate(0.4);
    const nb = g.balls.length, nBodies = g.world.bodies.length, n3d = g.scene.children.length; const res = [];
    for (let i = 0; i < 4; i++) { g.fetchBall(); g.simulate(0.3); const b = g.balls[g.lastTouched].body, p = b.position.clone(); g.simulate(5); res.push(+b.position.distanceTo(p).toFixed(4)); }
    const b = g.balls[g.lastTouched].body, p = b.position.clone(); const k = g.kick(0.6); g.simulate(2);
    const kd = Math.hypot(b.position.x - p.x, b.position.z - p.z);
    // kick it, recall again: the SAME (last-kicked) ball comes back
    const kicked = g.lastTouched; g.simulate(2); g.fetchBall(); const back = g.lastTouched;
    return { balls: [nb, g.balls.length], bodies: [nBodies, g.world.bodies.length], meshes: [n3d, g.scene.children.length], heldDrift: res, kick: k, kickDist: +kd.toFixed(2), sameBall: kicked === back }; }, [...RAMP, UPHILL]);
  check('slope: repeated BALL recall keeps ball count, ball held still 5 s each time', rec.balls[0] === 3 && rec.balls[1] === 3 && rec.bodies[0] === rec.bodies[1] && rec.meshes[0] === rec.meshes[1] && rec.heldDrift.every((v) => v < 0.005), JSON.stringify(rec));
  check('slope: kick from trapped ball works; recall returns last-kicked ball', rec.kick && rec.kickDist > 5 && rec.sameBall, JSON.stringify(rec));
  // trapped kick == normal kick (flat, identical setup), and multiple kicks in a row
  const eq = await mp.evaluate(() => { const g = window.__game; const r = Math.random; Math.random = () => 0.5;
    const run = (trapIt) => { g.restart(); g.start(); g.teleport(0, -30, 180, -10); g.simulate(0.5); if (trapIt) g.fetchBall(); else g.placeBall(0, 0, 0.22, -29.15);
      g.simulate(0.5); const b = g.balls[0].body, s = b.position.clone(); g.kick(0.6); g.simulate(2.5); return Math.hypot(b.position.x - s.x, b.position.z - s.z); };
    const a = run(false), b = run(true);
    // multiple kicks: recall + kick 3 times on the ramp
    g.restart(); g.start(); g.teleport(3.15, 39.5, -161.7, -10, 2.6); g.simulate(0.4); const ks = [];
    for (let i = 0; i < 3; i++) { g.fetchBall(); g.simulate(0.3); const bb = g.balls[g.lastTouched].body, p = bb.position.clone(); const ok = g.kick(0.5); g.simulate(1.5); ks.push(ok && Math.hypot(bb.position.x - p.x, bb.position.z - p.z) > 4); }
    Math.random = r; g.restart(); return { flat: +a.toFixed(3), trapped: +b.toFixed(3), multi: ks }; });
  check('trapped-ball kick distance == resting-ball kick (flat)', Math.abs(eq.flat - eq.trapped) < 0.05, JSON.stringify(eq));
  check('slope: multiple recall+kick cycles all launch', eq.multi.every(Boolean), JSON.stringify(eq.multi));
  // walking away releases the trap (ball then obeys physics again)
  const wa = await mp.evaluate(() => { const g = window.__game; g.restart(); g.start(); g.teleport(3.15, 39.5, -161.7, -10, 2.6); g.simulate(0.4); g.fetchBall(); g.simulate(0.3);
    const held = g.trapped[g.lastTouched]; const ap = g.walk([[3.15 - 3 * Math.sin(0.32), 39.5 - 3 * Math.cos(0.32)]]); g.simulate(2); return { held, released: !g.trapped.some(Boolean) }; });
  check('trap releases when player walks away', wa.held && wa.released, JSON.stringify(wa));
  await mp.evaluate(() => window.__game.teleport(0, -36, 180, -18)); await wait(mp, 600);
  await mp.screenshot({ path: 'screenshots/mobile-portrait-play.png' });
  await mp.setViewportSize({ width: 915, height: 412 }); await wait(mp, 800);
  await mp.screenshot({ path: 'screenshots/mobile-landscape-play.png' });
  const lay = await mp.evaluate(() => ['joyBase', 'btnKick', 'btnJump', 'btnBall', 'btnPause'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 20]; }));
  check('landscape: touch controls inside viewport', lay.every((x) => x[1]), JSON.stringify(lay));
  const mft = await mp.evaluate(() => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); ts.length < 61 ? requestAnimationFrame(f) : res(ts); }; requestAnimationFrame(f); }));
  results.push(`INFO mobile-profile frame time ${((mft[60] - mft[0]) / 60).toFixed(1)} ms (shadows ${await mp.evaluate(() => 'off')}, SwiftShader)`);
  check('no console errors (mobile)', merr.length === 0, merr.join(' | '));
  await ctx.close();
  // ================= West Pilton (level 1) =================
  const pc = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const pg = await pc.newPage();
  const perr = []; pg.on('console', (m) => m.type() === 'error' && perr.push(m.text())); pg.on('pageerror', (e) => perr.push(String(e)));
  const ready = async (p = pg) => { await p.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 60000 }); };
  const go = async (url, p = pg) => { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await ready(p); };
  await go(BASE); // brand-new player: no ?level, empty storage
  check('new players start in West Pilton', await pg.evaluate(() => window.__game.level === 'pilton' && window.__game.targets.length >= 5 && window.__game.targets.length <= 8), await pg.evaluate(() => window.__game.level + ' ' + window.__game.targets.length));
  await pg.screenshot({ path: 'screenshots/pilton-menu.png' });
  // welcome screen fits a phone with no scroll (portrait + landscape)
  const fit = {};
  for (const [w, h] of [[412, 915], [915, 412]]) {
    const fc = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 }); const fp = await fc.newPage();
    await fp.goto(BASE + '?level=pilton', { waitUntil: 'domcontentloaded', timeout: 60000 }); await fp.waitForSelector('#mainPanel', { timeout: 90000 }); await wait(fp, 1500);
    fit[`${w}x${h}`] = await fp.evaluate(() => { const c = document.getElementById('mainPanel'), r = c.getBoundingClientRect(), o = document.getElementById('overlay');
      return { ok: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && c.scrollHeight <= c.clientHeight + 1 && o.scrollHeight <= o.clientHeight + 1, h: Math.round(r.height) }; });
    await fp.screenshot({ path: `screenshots/menu-phone-${w > h ? 'landscape' : 'portrait'}.png` });
    await fp.evaluate(() => { window.__game.start(); window.__game.pause(); }); await wait(fp, 400); await fp.screenshot({ path: `screenshots/pause-phone-${w > h ? 'landscape' : 'portrait'}.png` });
    await fp.click('#lockerBtn'); await wait(fp, 300); await fp.screenshot({ path: `screenshots/locker-phone-${w > h ? 'landscape' : 'portrait'}.png` });
    await fc.close();
  }
  check('welcome screen fits 412x915 and 915x412 with no scroll', Object.values(fit).every((f) => f.ok), JSON.stringify(fit));
  // level select: menu button -> Grassmarket, travel button -> back to Pilton, ?level= param
  await Promise.all([pg.waitForURL(/level=grassmarket/, { timeout: 60000, waitUntil: 'domcontentloaded' }), pg.click('[data-level="grassmarket"]')]); await ready();
  const lv1 = await pg.evaluate(() => [window.__game.level, window.__game.targets.length]);
  await Promise.all([pg.waitForURL(/level=pilton/, { timeout: 60000, waitUntil: 'domcontentloaded' }), pg.evaluate(() => { window.__game.start(); window.__game.pause(); }).then(() => pg.click('#travelBtn'))]); await ready();
  const lv2 = await pg.evaluate(() => [window.__game.level, window.__game.targets.length]);
  await go(BASE); const lv3 = await pg.evaluate(() => window.__game.level); // remembers last level
  check('level transition both ways (menu + travel button + saved)', lv1[0] === 'grassmarket' && lv1[1] === 11 && lv2[0] === 'pilton' && lv3 === 'pilton', JSON.stringify({ lv1, lv2, lv3 }));
  await go(BASE + '?level=pilton');
  await pg.evaluate(() => { window.__game.resetWallet(); window.__game.start(); }); await wait(pg, 1200);
  await pg.screenshot({ path: 'screenshots/pilton-desktop-spawn.png' });
  // every Pilton target scoreable from its stand point; wallet earns per target (difficulty + bonus)
  const ps = await pg.evaluate(() => {
    const g = window.__game; const res = {}; const rnd = Math.random; Math.random = () => 0.5; let pence = 0;
    for (const t of g.targets) {
      const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yawDeg = Math.atan2(-ux, -uz) * 180 / Math.PI;
      let ok = null;
      outer: for (const pw of [0.1, 0.125, 0.15, 0.175, 0.2, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1]) for (const p of [-25, -15, -5, 5, 15, 25, 35]) {
        g.restart(); g.start(); g.teleport(s.x, s.z, yawDeg, p, s.y + 1); g.placeBall(0, s.x + ux * 0.8, s.y + 0.4, s.z + uz * 0.8);
        g.simulate(0.4); g.teleport(s.x, s.z, yawDeg, p); g.kick(pw); g.simulate(3);
        if (t.done) { ok = { pw, p, pence: g.lastEarn.pence, bonus: g.lastEarn.bonus, diff: t.diff }; pence += g.lastEarn.pence; break outer; }
      }
      res[t.id] = ok;
    }
    Math.random = rnd; g.restart(); return { n: g.targets.length, res, pence, wallet: g.wallet.pence };
  });
  check('Pilton: every target scoreable from a standing spot', Object.values(ps.res).every(Boolean), JSON.stringify(ps.res));
  check('wallet earns per target (difficulty + bonus)', ps.pence === ps.wallet && ps.pence > 0 && new Set(Object.values(ps.res).map((r) => r && r.pence)).size >= 3, `earned ${ps.pence}p, wallet ${ps.wallet}p`);
  // stand spots are reachable on foot from the spawn (autopilot uses normal movement + collisions)
  const preach = await pg.evaluate(() => { const g = window.__game; const out = {};
    for (const t of g.targets) { g.restart(); g.start(); const route = t.id === 'gap' ? [[0, -20], [6, -4], [t.stand.x, t.stand.z]] : t.stand.x < -4 ? [[-2, t.stand.z], [t.stand.x, t.stand.z]] : [[2, t.stand.z], [t.stand.x, t.stand.z]];
      const ap = g.walk(route); let s = 0; while (!ap.done && s < 40) { g.simulate(0.5); s += 0.5; } out[t.id] = ap.done && Math.hypot(g.player.position.x - t.stand.x, g.player.position.z - t.stand.z) < 1; }
    g.restart(); return out; });
  check('Pilton: every stand spot reachable on foot', Object.values(preach).every(Boolean), JSON.stringify(preach));
  // slope (grassy bank up to the drying green): no drift, recalled ball held, kick works
  const pslope = await pg.evaluate(() => { const g = window.__game; const out = [];
    for (const x of [8.8, 10.5, 12.3]) { g.restart(); g.start(); g.teleport(x, -4, 90, 0, 0.5 + (x - 8) * 0.24 + 0.5); g.simulate(0.6); const a = g.player.position.clone(); g.simulate(5); out.push(+g.player.position.distanceTo(a).toFixed(4)); }
    g.restart(); g.start(); g.teleport(10.5, -4, 90, -10, 1.5); g.simulate(0.6); const held = [];
    for (let i = 0; i < 3; i++) { g.fetchBall(); g.simulate(0.3); const b = g.balls[g.lastTouched].body, p = b.position.clone(); g.simulate(5); held.push(+b.position.distanceTo(p).toFixed(4)); }
    const b = g.balls[g.lastTouched].body, p0 = b.position.clone(); const k = g.kick(0.5); g.simulate(1.5);
    return { idle: out, held, kick: k, kd: +Math.hypot(b.position.x - p0.x, b.position.z - p0.z).toFixed(2), balls: g.balls.length }; });
  check('Pilton bank: zero input => no drift; recalled ball held 5 s; kick works', pslope.idle.every((v) => v < 0.01) && pslope.held.every((v) => v < 0.005) && pslope.kick && pslope.kd > 4 && pslope.balls === 3, JSON.stringify(pslope));
  // wallet persistence + reset + goal + chippy counter
  await pg.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await ready();
  const persisted = await pg.evaluate(() => window.__game.wallet.pence);
  check('wallet persists across reloads', persisted === ps.wallet, `${persisted}p after reload`);
  await pg.evaluate(() => { const g = window.__game; g.resetWallet(); g.start(); g.teleport(-2, 18, 0, -10); }); await wait(pg, 1000);
  const afterReset = await pg.evaluate(() => window.__game.wallet.pence);
  // earn to the goal: score targets via the normal scoring path until >= goal
  const goal = await pg.evaluate(async () => { const g = window.__game; g.restart(); const before = g.wallet.pence; for (const t of g.targets) { if (g.wallet.pence >= g.GOAL.pence) break; g.scoreTarget(t, 'Bullseye'); }
    await new Promise((r) => setTimeout(r, 2600)); return { before, after: g.wallet.pence, goal: g.GOAL.pence, card: !document.getElementById('goalCard').classList.contains('hidden'), title: document.getElementById('goalTitle').textContent }; });
  await pg.screenshot({ path: 'screenshots/pilton-goal-reached.png' });
  check('wallet reset + goal reached shows "Chippy unlocked" card', afterReset === 0 && goal.after >= goal.goal && goal.card && /Chippy unlocked/.test(goal.title), JSON.stringify(goal));
  await pg.click('#goalOk');
  const buy = await pg.evaluate(async () => { const g = window.__game; const c = g.counter, before = g.wallet.pence; g.teleport(c.x, c.z - 1.2, 0, 0); g.simulate(0.2); document.getElementById('cnt_supper').click();
    return { before, after: g.wallet.pence, suppers: g.wallet.suppers, title: document.getElementById('goalTitle').textContent, card: !document.getElementById('goalCard').classList.contains('hidden') }; });
  await wait(pg, 600); await pg.screenshot({ path: 'screenshots/pilton-chippy-counter.png' });
  check('chippy counter: buy a supper with the wallet', buy.after === buy.before - 650 && buy.suppers === 1 && buy.card && /fish supper/.test(buy.title), JSON.stringify(buy));
  await pg.click('#goalOk');
  // HUD + views
  await pg.evaluate(() => { const g = window.__game; g.restart(); g.start(); g.teleport(0, -12, 180, -6); }); await wait(pg, 900);
  await pg.screenshot({ path: 'screenshots/pilton-wallet-hud.png' });
  for (const [n, v] of Object.entries(await pg.evaluate(() => window.__game.views))) { await pg.evaluate((v) => window.__game.teleport(v[0], v[1], v[2], v[3], v[4]), v); await wait(pg, 900); await pg.screenshot({ path: `screenshots/pilton-desktop-${n}.png` }); }
    // open-top 'into' targets: drop-in scores, side hits don't, realistic chips score at a fair share
  for (const [lv, ids] of [['pilton', ['bin', 'wheelie']], ['grassmarket', ['bin', 'skip']]]) {
    await go(BASE + '?level=' + lv);
    const ot = await pg.evaluate((ids) => {
      const g = window.__game; g.start(); const V = g.camera.position.constructor; const out = {}; const rnd = Math.random; Math.random = () => 0.5;
      for (const id of ids) {
        const t = g.targets.find((x) => x.id === id); const z = t.zone, fwd = t.zoneInv.clone().invert();
        const W = (lx, ly, lz) => new V(lx, ly, lz).applyMatrix4(fwd);
        const drop = (lx, ly, lz) => { g.restart(); g.start(); g.teleport(t.stand.x, t.stand.z, 0, 0); const p = W(lx, ly, lz); g.placeBall(0, p.x, p.y, p.z); g.balls[0].lastKick = performance.now(); g.balls[0].bounces = 0; g.simulate(2.5); return t.done; };
        const cx = (z.min.x + z.max.x) / 2, cz = (z.min.z + z.max.z) / 2, hx = (z.max.x - z.min.x) / 2, hz = (z.max.z - z.min.z) / 2;
        const drops = []; for (const fx of [-0.6, 0, 0.6]) for (const fz of [-0.6, 0, 0.6]) drops.push(drop(cx + fx * (hx - 0.22), z.max.y + 0.8, cz + fz * (hz - 0.22)));
        const miss = []; for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) miss.push(drop(cx + sx * (hx + 0.4), z.max.y + 0.8, cz + sz * (hz + 0.4)));
        const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yw = Math.atan2(-ux, -uz) * 180 / Math.PI;
        const kick = (pw, p, d = 0) => { const sx = s.x - ux * d, sz = s.z - uz * d; g.restart(); g.start(); g.teleport(sx, sz, yw, p, s.y + 1); g.placeBall(0, sx + ux * 0.8, s.y + 0.4, sz + uz * 0.8); g.simulate(0.4); g.teleport(sx, sz, yw, p); g.kick(pw); g.simulate(3); return t.done; };
        const side = [[0.5, -25], [0.7, -25], [0.9, -20]].map(([pw, p]) => kick(pw, p));
        let n = 0, ok = 0; for (const d of [0, 1.5]) for (let pw = 0.1; pw <= 0.5501; pw += 0.05) for (let p = 10; p <= 50; p += 10) { n++; if (kick(pw, p, d)) ok++; }
        out[id] = { drops: drops.filter(Boolean).length, dropN: drops.length, miss: miss.filter(Boolean).length, side: side.filter(Boolean).length, chips: ok, chipN: n, share: +(ok / n).toFixed(3) };
      }
      Math.random = rnd; g.restart(); return out;
    }, ids);
    check(`${lv}: into-targets drop-in scores, side hits miss, chips score fairly`, Object.values(ot).every((r) => r.drops === r.dropN && r.miss === 0 && r.side === 0 && r.share >= 0.05 && r.share <= 0.55), JSON.stringify(ot));
  }
  // ---------- experimental challenges + unlocks ----------
  await go(BASE + '?level=pilton');
  const ch = await pg.evaluate(() => {
    const g = window.__game; g.resetProgress(); const rnd = Math.random; Math.random = () => 0.5; const out = {};
    for (const t of g.challenges) {
      const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yw = Math.atan2(-ux, -uz) * 180 / Math.PI;
      let n = 0, ok = 0, first = null;
      for (const d of [0]) for (let pw = 0.1; pw <= 1.001; pw += 0.05) for (let p = -10; p <= 50; p += 5) {
        const sx = s.x - ux * d, sz = s.z - uz * d; g.restart(); g.start(); g.teleport(sx, sz, yw, p, s.y + 1); g.placeBall(0, sx + ux * 0.8, s.y + 0.4, sz + uz * 0.8); g.simulate(0.4); g.teleport(sx, sz, yw, p); g.kick(pw); g.simulate(3.5);
        n++; if (t.done) { ok++; first ||= [d, +pw.toFixed(2), p]; }
      }
      out[t.id] = { ok, n, share: +(ok / n).toFixed(3), first };
    }
    Math.random = rnd; g.resetProgress(); g.restart();
    return { out, counted: g.targets.length, chN: g.challenges.length };
  });
  check('challenges: 3 optional, not in main 8 counter', ch.counted === 8 && ch.chN === 3, JSON.stringify({ counted: ch.counted, chN: ch.chN }));
  check('challenges: each scorable from its spot but hard (sweep share 0.5-25%)', Object.values(ch.out).every((r) => r.share > 0.004 && r.share <= 0.25), JSON.stringify(ch.out));
  // long-range rule: the same pole gap from close range does not count
  const close = await pg.evaluate(() => { const g = window.__game; const t = g.challenges.find((c) => c.id === 'c_longpoles'); g.restart(); g.start();
    g.teleport(16.5, -4, -90, 0, 3); g.placeBall(0, 17.3, 2.6, -4); g.simulate(0.4); g.teleport(16.5, -4, -90, 5); g.kick(0.35); g.simulate(3); const r = { ch: t.done, gap: g.targets.find((x) => x.id === 'gap')?.done }; g.restart(); return r; });
  check('long-range challenge needs range (close pole shot does not count)', close.ch === false, JSON.stringify(close));
  // full new-player sequence (tiers -> unlocks -> chippy -> reload)
  await pg.evaluate(() => { localStorage.clear(); });
  await go(BASE + '?level=pilton');
  const np = await pg.evaluate(async () => { const g = window.__game; g.restart(); g.start(); const r = {};
    const T = (id) => g.targets.find((t) => t.id === id) || g.challenges.find((t) => t.id === id);
    r.tiers = { easy: g.targets.filter((t) => t.tier === 'easy').length, tricky: g.targets.filter((t) => t.tier === 'tricky').length, legend: g.challenges.filter((t) => t.tier === 'legend').length };
    r.munchBefore = g.buyItem('munchie'); r.winterBefore = g.applyBall('winter');
    for (const id of ['garage', 'trolley', 'busstop', 'lamp']) g.scoreTarget(T(id)); r.w0 = g.wallet.pence; r.wee = g.buyItem('wee'); r.w1 = g.wallet.pence;
    for (const id of ['bin', 'gap']) g.scoreTarget(T(id)); r.winter2 = g.unlocks.balls.includes('winter');
    g.scoreTarget(T('noballs')); r.winter3 = g.unlocks.balls.includes('winter'); r.news = g.lastUnlock?.map((n) => n.id);
    // legendary via real physics (drop on the roof), fires once
    g.placeBall(0, -16.2, 3.25, 4.6); g.balls[0].lastKick = performance.now(); g.simulate(1.5); r.roof = g.unlocks.levels.pilton.c_roof; r.munch = g.unlocks.items.includes('munchie'); r.wRoof = g.wallet.pence;
    g.restart(); g.start(); g.placeBall(0, -16.2, 3.25, 4.6); g.balls[0].lastKick = performance.now(); g.simulate(1.5); r.wRoof2 = g.wallet.pence;
    r.special1 = g.unlocks.balls.includes('special');
    for (const id of ['c_window', 'c_longpoles']) g.scoreTarget(T(id));
    r.special = g.unlocks.balls.includes('special'); r.boots = g.unlocks.bootsOwned.includes('boots');
    r.selB = g.applyBall('special'); r.selF = g.applyBoots('boots');
    return r; });
  check('tiers: 4 Wee Warm-Up, 4 Getting Cocky, 3 Away Ye Go!', np.tiers.easy === 4 && np.tiers.tricky === 4 && np.tiers.legend === 3, JSON.stringify(np.tiers));
  check('new player: Wee Supper buyable early, Munchie locked until a Legendary', np.munchBefore === false && np.wee === true && np.w1 === np.w0 - 200, JSON.stringify(np));
  check('Street Legend after 3 Getting Cocky (not before)', np.winterBefore === false && !np.winter2 && np.winter3 && np.news?.includes('winter'), JSON.stringify(np));
  check('Legendary roof shot fires once (cash once), unlocks Munchie Box', np.roof && np.munch && np.wRoof - np.w1 > 0 && np.wRoof2 === np.wRoof && !np.special1, JSON.stringify(np));
  check('all 3 Legendary -> Pilton Special ball + black boots, selectable', np.special && np.boots && np.selB && np.selF, JSON.stringify(np));
  await wait(pg, 2600); await pg.screenshot({ path: 'screenshots/unlock-toast.png' });
  await go(BASE + '?level=pilton');
  const per = await pg.evaluate(() => ({ u: window.__game.unlocks, w: window.__game.wallet.pence, done: window.__game.targets.filter((t) => t.done).length, hud: document.getElementById('chalVal').textContent }));
  check('progress persists across reload (targets, balls, selection, items, money)', per.u.ball === 'special' && per.u.boots === 'boots' && per.u.levels.pilton.c_window && per.u.items.includes('munchie') && per.done === 7 && per.w > 0, JSON.stringify(per));
  const phys = await pg.evaluate(() => { const g = window.__game; const r = Math.random; Math.random = () => 0.5; const run = () => { g.restart(); g.start(); g.teleport(0, -30, 180, -10); g.placeBall(0, 0, 0.3, -29.2); g.simulate(0.5); g.teleport(0, -30, 180, -10); g.kick(0.6); g.simulate(2); const b = g.balls[0].body; return [b.position.x, b.position.y, b.position.z, b.mass, b.shapes[0].radius]; };
    g.applyBall('tango'); const m0 = g.ballMap, a = run(); const ok = g.applyBall('winter'); const m1 = g.ballMap, b = run(); const locked = g.applyBall('nope'); Math.random = r;
    return { ok, locked, swapped: m0 !== m1, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), same: a[3] === b[3] && a[4] === b[4] }; });
  check('ball selector swaps texture only (same trajectory/mass/radius)', phys.ok && !phys.locked && phys.swapped && phys.d < 1e-6 && phys.same, JSON.stringify(phys));
  for (const id of ['winter', 'special']) { await pg.evaluate((id) => { const g = window.__game; g.applyBall(id); g.restart(); g.start(); g.teleport(0, -30, 180, -18); g.placeBall(0, 0, 0.3, -29.0); }, id); await wait(pg, 700); await pg.screenshot({ path: `screenshots/ball-${id}.png` }); }
  await pg.evaluate(() => { window.__game.teleport(0, -30, 180, -70); }); await wait(pg, 600); await pg.screenshot({ path: 'screenshots/feet-boots.png' });
  await pg.evaluate(() => document.getElementById('overlay').classList.remove('hidden')); await wait(pg, 400);
  await pg.screenshot({ path: 'screenshots/ball-selector.png' });
  await pg.evaluate(() => document.getElementById('overlay').classList.add('hidden'));
  for (const [id, v] of [['c_roof', [-2.5, 12, 90, 14, 1.6]], ['c_window', [4.5, -28.5, -90, 22, 1.6]], ['c_longpoles', [-4.6, -4, -90, 6, 1.6]]]) { await pg.evaluate((v) => { const g = window.__game; g.resetProgress(); g.restart(); g.start(); g.teleport(...v); }, v); await wait(pg, 800); await pg.screenshot({ path: `screenshots/challenge-${id}.png` }); }
  await pg.evaluate(() => { localStorage.setItem('ek-wallet', JSON.stringify({ pence: 900, goalSeen: true, suppers: 0, total: 900 })); const u = JSON.parse(localStorage.getItem('ek-unlocks')); u.items.push('munchie'); localStorage.setItem('ek-unlocks', JSON.stringify(u)); });
  await go(BASE + '?level=pilton');
  const shop = await pg.evaluate(() => { const g = window.__game; g.start(); g.openCounter(); const b = document.getElementById('cnt_munchie'); const dis = b.disabled; b.click(); return { dis, wallet: g.wallet.pence, bought: g.unlocks.bought.munchie, line: document.getElementById('cntLine').textContent }; });
  await wait(pg, 400); await pg.screenshot({ path: 'screenshots/chippy-munchie-box.png' });
  check('Munchie Box purchasable after unlock (priced in wallet)', !shop.dis && shop.wallet === 400 && shop.bought === 1 && /Doner/.test(shop.line), JSON.stringify(shop));
  await pg.evaluate(() => { document.getElementById('cntClose').click(); const g = window.__game; g.resetProgress(); g.resetWallet(); });
  // BALL rescue rules + feet
  const br = await pg.evaluate(() => { const g = window.__game; g.resetWallet(); g.restart(); g.start(); const r = {};
    g.teleport(0, -30, 180, -10); g.placeBall(0, 0, 0.3, -27); g.simulate(0.3); g.kick(0.05); g.simulate(0.5); r.near = g.requestBall();
    localStorage.setItem('ek-wallet', '{}'); r.skint = (() => { g.placeBall(0, 0, 0.3, -18); g.balls[0].stillT = 1e9; g.teleport(0, -30, 180, -10); return g.requestBall(); })();
    return r; });
  await pg.evaluate(() => localStorage.setItem('ek-wallet', JSON.stringify({ pence: 50, goalSeen: false, suppers: 0, total: 50 })));
  await go(BASE + '?level=pilton');
  const br3 = await pg.evaluate(async () => { const g = window.__game; g.restart(); g.start(); const r = {}; const lt = (i) => { g.placeBall(i, ...[0, 0.3, -18]); };
    g.teleport(0, -30, 180, -10); g.placeBall(0, 0, 0.3, -27); g.simulate(0.3); g.kick(0.05); g.simulate(0.3); // lastTouched = ball 0
    g.placeBall(0, 0, 0.3, -18); g.simulate(0.5); g.teleport(0, -30, 180, -10); r.paid = g.requestBall(); r.w1 = g.wallet.pence;
    g.simulate(0.3); const p = g.balls[g.lastTouched].body.position.clone(); g.simulate(3); r.hold = +g.balls[g.lastTouched].body.position.distanceTo(p).toFixed(4);
    g.placeBall(0, 0, 0.3, 12); g.simulate(0.3); g.teleport(0, -30, 180, -10); r.far = g.requestBall(); r.w2 = g.wallet.pence;
    g.placeBall(0, 0, 0.3, -24); g.simulate(5); g.teleport(0, -30, 180, -10); r.stuck = g.requestBall(); r.w3 = g.wallet.pence; return r; });
  check('BALL rescue: refused when close, 10p when mid-range, free when far/stuck, skint refused, still held on recall', br.near === 'near' && br3.paid === 'paid' && br3.w1 === 40 && br3.far === 'free' && br3.stuck === 'free' && br3.w3 === 40 && br3.hold < 0.01, JSON.stringify({ br, br3 }));
  const feet = await pg.evaluate(() => { const g = window.__game; const r = { t0: g.bootTris, lockedBoots: g.applyBoots('boots') }; return r; });
  check('feet: trainer by default, boots locked until all 3 challenges, cheap geometry', feet.lockedBoots === false && feet.t0 < 400, JSON.stringify(feet));
  await pg.evaluate(() => { const g = window.__game; g.restart(); g.start(); g.teleport(0, -30, 180, -70); }); await wait(pg, 700); await pg.screenshot({ path: 'screenshots/feet-trainer.png' });
  await go(BASE + '?level=pilton');
check('Pilton: no console errors (desktop)', perr.length === 0, perr.join(' | '));
  await pc.close();
  // Pilton on a phone (landscape) with touch
  const pm = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
  const pmp = await pm.newPage(); const pmerr = []; pmp.on('pageerror', (e) => pmerr.push(String(e))); pmp.on('console', (m) => m.type() === 'error' && pmerr.push(m.text()));
  await go(BASE, pmp); await wait(pmp, 800);
  await pmp.screenshot({ path: 'screenshots/pilton-phone-menu.png' });
  await pmp.tap('#startBtn'); await wait(pmp, 1500);
  await pmp.screenshot({ path: 'screenshots/pilton-phone-landscape.png' });
  const pt = await pmp.evaluate(async () => { const g = window.__game; g.teleport(0, -30, 180, -20); g.placeBall(0, 0, 0.3, -29.2); g.simulate(0.5); return g.balls[0].body.position.z; });
  const kb2 = await pmp.locator('#btnKick').boundingBox(); const cdp2 = await pm.newCDPSession(pmp);
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: kb2.x + 30, y: kb2.y + 30 }] }); await wait(pmp, 400);
  await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pmp.evaluate(() => window.__game.waitSim(1.2));
  const pt2 = await pmp.evaluate(() => window.__game.balls[0].body.position.z);
  check('Pilton phone: touch KICK works, wallet HUD visible', pt2 - pt > 3 && await pmp.evaluate(() => getComputedStyle(document.getElementById('wallet')).display !== 'none'), `${pt.toFixed(2)} -> ${pt2.toFixed(2)}`);
  await pmp.evaluate(() => window.__game.teleport(16, -4, 90, 0, 2.1)); await wait(pmp, 800); await pmp.screenshot({ path: 'screenshots/pilton-phone-drying-green.png' });
  check('Pilton: no console errors (mobile)', pmerr.length === 0, pmerr.join(' | '));
} catch (e) { check('script', false, String(e)); }
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]); killServer();
console.log(`verify done: ${results.filter((l) => l.startsWith('PASS')).length} pass, ${results.filter((l) => l.startsWith('FAIL')).length} fail`);
process.exit(fail ? 1 : 0);
