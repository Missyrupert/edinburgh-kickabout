// Simulated playtest: ~20 human-ish players with noisy aim, using the game's test hooks (no product changes).
// Usage: node scripts/simplay.mjs [players=20]   (needs `npx vite build` first; serves dist on :4185)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const N = +(process.argv[2] || 20), PORT = 4185;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/?debug&level=pilton&preset=low`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__game?.assetsLoaded, null, { timeout: 60000 }).catch(() => {});
// 1) "intended shot" per target: a player who knows the shot aims at the middle of the working (power, pitch) window
const plan = await page.evaluate(() => {
  const g = window.__game; g.start(); const r = Math.random; Math.random = () => 0.5; const out = {};
  for (const t of [...g.targets, ...g.challenges]) {
    const s = t.stand, a = t.aim, L = Math.hypot(a.x - s.x, a.z - s.z), ux = (a.x - s.x) / L, uz = (a.z - s.z) / L, yaw = Math.atan2(-ux, -uz) * 180 / Math.PI;
    const hits = [];
    for (let pw = 0.1; pw <= 1.001; pw += 0.05) for (let p = -10; p <= 50; p += 5) {
      g.resetProgress(); g.restart(); g.start(); g.teleport(s.x, s.z, yaw, p, s.y + 1); g.placeBall(0, s.x + ux * 0.8, s.y + 0.4, s.z + uz * 0.8); g.simulate(0.4); g.teleport(s.x, s.z, yaw, p); g.kick(pw); g.simulate(3.5);
      if (t.done) hits.push([pw, p]);
    }
    hits.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    out[t.id] = { s: [s.x, s.y, s.z], yaw, hit: hits[Math.floor(hits.length / 2)] || null, n: hits.length, legend: !!t.challenge, name: t.name };
  }
  Math.random = r; g.resetProgress(); g.resetWallet(); g.restart(); return out;
});
// 2) players
const players = [];
for (let seed = 1; seed <= N; seed++) {
  const res = await page.evaluate(({ plan, seed }) => {
    const g = window.__game; let st = seed * 2654435761 >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const orig = Math.random; Math.random = rnd; // the game's random kick sidespin follows the player seed too
    g.resetProgress(); g.resetWallet(); g.restart(); g.start();
    let clock = 0, ballUses = 0, spent = 0, refused = 0, lost = 0, stuck = 0, anomalies = [], t650 = null;
    const P = () => g.player.position, B = () => g.balls[0].body.position;
    const walk = (x, z) => { const d = Math.hypot(x - P().x, z - P().z); clock += d / 3.5; g.teleport(x, z, 0, 0); };
    const per = {};
    for (const [id, pl] of Object.entries(plan)) {
      const t = g.targets.find((x) => x.id === id) || g.challenges.find((x) => x.id === id);
      let tries = 0, ok = false;
      if (!pl.hit) { per[id] = { tries: 30, ok: false, noShot: true }; continue; }
      while (tries < 30 && !ok) {
        tries++;
        // stand somewhere sensible near the spot (not exact), facing roughly the right way
        const sx = pl.s[0] + gauss() * 0.6, sz = pl.s[2] + gauss() * 0.6, yaw = pl.yaw * Math.PI / 180;
        // get the ball: walk to it if < 25 m, else BALL
        const d = Math.hypot(B().x - P().x, B().z - P().z);
        if (d >= 25 || B().y < -1 || Math.abs(B().y - P().y) > 2.2) { const before = g.wallet.pence; const r = g.requestBall(); ballUses++;
          if (r === 'paid') spent += before - g.wallet.pence; else if (r === 'skint' || r === 'near') { refused++; walk(B().x, B().z); } }
        else walk(B().x, B().z);
        if (B().y < -1) { lost++; g.placeBall(0, P().x, 0.5, P().z); }
        clock += Math.hypot(sx - P().x, sz - P().z) / 2.5 + 4; // dribble to the spot + line up
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        g.teleport(sx, sz, pl.yaw, 0, pl.s[1] + 1); g.placeBall(0, sx + fx * 0.8, pl.s[1] + 0.4, sz + fz * 0.8); g.simulate(0.4);
        const yawN = pl.yaw + gauss() * 4, pitN = pl.hit[1] + gauss() * 3, pw = Math.min(1, Math.max(0.03, pl.hit[0] + gauss() * 0.12));
        g.teleport(sx, sz, yawN, pitN); const w0 = g.wallet.pence; const kicked = g.kick(pw); clock += pw + 3;
        if (!kicked) anomalies.push(`${id}: whiff from dribble spot`);
        g.simulate(3.5); ok = t.done;
        if (ok && g.wallet.pence <= w0 && !t.challenge) anomalies.push(`${id}: scored without cash`);
        const b = B(); if (Math.hypot(b.x - P().x, b.z - P().z) > 4 && g.balls[0].body.velocity.length() < 0.05 && b.y > 2.4 && id !== 'c_roof') stuck++;
        if (t650 === null && g.wallet.pence + spent >= 650) t650 = clock; // earned (before any spending) £6.50
      }
      per[id] = { tries, ok };
    }
    Math.random = orig;
    return { per, minutes650: t650 === null ? null : +(t650 / 60).toFixed(1), ballUses, spent, refused, lost, stuckHigh: stuck, anomalies: anomalies.slice(0, 5), minutes: +(clock / 60).toFixed(1) };
  }, { plan, seed });
  players.push(res); process.stdout.write(`player ${seed}: ${res.minutes} min, ball ${res.ballUses}, £6.50 at ${res.minutes650}\n`);
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null; };
const rows = Object.entries(plan).map(([id, pl]) => { const tr = players.map((p) => p.per[id]); const succ = tr.filter((x) => x.ok).map((x) => x.tries);
  return { id, name: pl.name, legend: pl.legend, windowShots: pl.n, median: q(succ, 0.5), p90: q(succ, 0.9), never: Math.round(100 * tr.filter((x) => !x.ok).length / tr.length) }; });
const m650 = players.map((p) => p.minutes650).filter((x) => x !== null);
const summary = { players: N, rows, medianMinutesTo650: q(m650, 0.5), reached650: `${m650.length}/${N}`, ballUsesMedian: q(players.map((p) => p.ballUses), 0.5), ballUsesMax: Math.max(...players.map((p) => p.ballUses)), spentMedianP: q(players.map((p) => p.spent), 0.5), refusedTotal: players.reduce((a, p) => a + p.refused, 0), lostTotal: players.reduce((a, p) => a + p.lost, 0), stuckHighTotal: players.reduce((a, p) => a + p.stuckHigh, 0), anomalies: [...new Set(players.flatMap((p) => p.anomalies))].slice(0, 10), pageErrors: errs.slice(0, 5) };
writeFileSync('perf/simplay.json', JSON.stringify({ summary, players }, null, 1));
console.table(rows); console.log(JSON.stringify({ ...summary, rows: undefined }, null, 1));
await browser.close(); server.kill();
