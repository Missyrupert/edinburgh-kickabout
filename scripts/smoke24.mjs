import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
await pg.evaluate(() => { localStorage.removeItem('ek-sound'); localStorage.removeItem('ek-vol'); }); await pg.reload(); await pg.waitForFunction(() => window.__game);
ok(await pg.evaluate(() => document.getElementById('verTag').textContent === 'v3.3'), 'label v3.1.1');
ok(await pg.evaluate(() => __game.sfx.ctx === null), 'no AudioContext before Play');
await pg.click('#startBtn'); await pg.waitForTimeout(600);
const st = await pg.evaluate(() => __game.sfx.ctx && __game.sfx.ctx.state); ok(st === 'running', 'AudioContext created + running after Play (' + st + ')');
const S = await pg.evaluate(() => [[0, 0], [5, 0], [-5, -10], [-3.2, -18], [15, -4], [0, 32], [0, 28], [-12, 0]].map(([x, z]) => __game.surfaceAt(x, z)));
ok(JSON.stringify(S) === JSON.stringify(['tarmac', 'paving', 'paving', 'puddle', 'grass', 'paving', 'tarmac', 'grass']), 'surface lookup ' + JSON.stringify(S));
// walk (footsteps) + kick + every impact surface, no errors
await pg.keyboard.down('KeyW'); await pg.waitForTimeout(900); await pg.keyboard.up('KeyW');
await pg.evaluate(() => { const s = __game.sfx; s.kick(0.9); for (const f of ['grass', 'tarmac', 'paving', 'puddle', 'wall', 'metal', 'board', 'plastic', 'glass', 'garage']) s.bounce(8, true, f, 3, -30); s.step('puddle', true); s.flutter(1, -30); s.carPass(45); s.dog(-60, -30); s.voices2(55, 60); s.bird(19, -4); s.gull(0, 60); s.success(false); });
// voice cap
await pg.waitForTimeout(1200);
const cap = await pg.evaluate(async () => { const s = __game.sfx; s.peakVoices = 0; s.dropped = 0; for (let i = 0; i < 60; i++) s.bounce(10, true, 'garage', 0, 0); return { v: s.voices, peak: s.peakVoices, dropped: s.dropped }; });
ok(cap.peak <= 12 && cap.dropped > 0, 'voice cap respected ' + JSON.stringify(cap));
await pg.waitForTimeout(1500); ok(await pg.evaluate(() => __game.sfx.voices) <= 2, 'voices released after they finish');
// fryer loop louder by the Plaice than at spawn
const fr = await pg.evaluate(async () => { const g = __game, L = g.sfx.loops[0]; g.teleport(0, -36, 180); await new Promise(r => setTimeout(r, 900)); const far = L.gain.gain.value; g.teleport(-9, 31, 180); await new Promise(r => setTimeout(r, 1500)); return [far, L.gain.gain.value]; });
ok(fr[1] > 0.02 && fr[0] < fr[1] / 10, 'chippy fryer loop by distance ' + JSON.stringify(fr));
// toggle mutes, volume remembered
await pg.evaluate(() => __game.pause()); await pg.click('#settingsBtn'); await pg.click('#soundBtn'); await pg.waitForTimeout(400);
ok(await pg.evaluate(() => __game.sfx.master.gain.value < 0.01 && !__game.sfx.ok), 'Sound off mutes the master');
await pg.click('#soundBtn'); await pg.$eval('#volSlider', (e) => { e.value = 40; e.dispatchEvent(new Event('input')); }); await pg.waitForTimeout(400);
ok(await pg.evaluate(() => localStorage.getItem('ek-vol') === '0.4' && Math.abs(__game.sfx.master.gain.value - 0.4) < 0.05), 'volume slider applies + saved');
// page hidden -> suspended
await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => __game.sfx.ctx.state) === 'suspended', 'suspends when page hidden');
await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => __game.sfx.ctx.state) === 'running', 'resumes when visible');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
