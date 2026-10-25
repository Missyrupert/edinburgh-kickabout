// v2.4 Pilton sound pass: procedural WebAudio only (no samples, no music).
// Graph: voices -> bus (sfx / amb) -> master gain (toggle x volume) -> compressor/limiter -> out.
// One shared noise buffer; one-shot voices are capped (MAX_VOICES) and self-release on 'ended'.
export const MAX_VOICES = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class Sfx {
  constructor() {
    this.ctx = null; this.voices = 0; this.peakVoices = 0; this.dropped = 0; this.L = { x: 0, z: 0, yaw: 0 }; this.loops = []; this.timers = [];
    try { this.on = localStorage.getItem('ek-sound') !== 'off'; this.vol = (Number.isFinite(parseFloat(localStorage.getItem('ek-vol'))) ? clamp(parseFloat(localStorage.getItem('ek-vol')), 0, 1) : 0.8); } catch { this.on = true; this.vol = 0.8; }
    if (!Number.isFinite(this.vol)) this.vol = 0.8;
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume(); });
  }
  get level() { return this.on ? this.vol : 0; }
  setOn(on) { this.on = on; try { localStorage.setItem('ek-sound', on ? 'on' : 'off'); } catch {} this.applyLevel(); if (this.ctx) { if (on && !document.hidden) this.ctx.resume(); } }
  setVolume(v) { this.vol = clamp(v, 0, 1); try { localStorage.setItem('ek-vol', String(this.vol)); } catch {} this.applyLevel(); }
  applyLevel() { if (this.master) this.master.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.05); }
  init() { // call from a user gesture (Play)
    if (this.ctx) { if (this.on) this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.comp = c.createDynamicsCompressor(); // gentle glue + limiter so phone speakers don't clip
    this.comp.threshold.value = -16; this.comp.knee.value = 8; this.comp.ratio.value = 6; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master = c.createGain(); this.master.gain.value = this.level;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.amb = c.createGain(); this.amb.gain.value = 0.55;
    this.sfxBus.connect(this.master); this.amb.connect(this.master); this.master.connect(this.comp).connect(c.destination);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }
  get ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  // ---- voice management ----
  claim(n = 1, force = false) { if (!force && this.voices + n > MAX_VOICES) { this.dropped++; return false; } this.voices += n; this.peakVoices = Math.max(this.peakVoices, this.voices); return true; }
  release(src) { src.onended = () => { this.voices = Math.max(0, this.voices - 1); }; }
  // destination for a positioned sound: pan + distance gain (cheap StereoPanner, no HRTF)
  spot(x, z, ref = 6, bus = this.sfxBus) {
    if (x == null) return { node: bus, g: 1 };
    const dx = x - this.L.x, dz = z - this.L.z, dist = Math.hypot(dx, dz), y = this.L.yaw;
    const pan = dist < 0.5 ? 0 : clamp((dx * Math.cos(y) - dz * Math.sin(y)) / dist, -1, 1) * 0.85;
    const g = Math.min(1, Math.pow(ref / Math.max(dist, ref), 1.2));
    if (!this.ctx.createStereoPanner) return { node: bus, g };
    const p = this.ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus); return { node: p, g };
  }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  noise(t, dur, freq, q, peak, type = 'bandpass', out = this.sfxBus, force = false) {
    if (peak < 0.002 || !this.claim(1, force)) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, 0.003, peak, dur); s.connect(f).connect(g).connect(out); this.release(s); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone(t, f0, f1, dur, peak, type = 'sine', out = this.sfxBus, force = false) {
    if (peak < 0.002 || !this.claim(1, force)) return;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain(); this.env(g, t, 0.005, peak, dur); o.connect(g).connect(out); this.release(o); o.start(t); o.stop(t + dur + 0.05);
  }
  // ---- player ----
  listen(x, z, yaw) { // per frame: cheap; loop gains refreshed every 150 ms
    this.L.x = x; this.L.z = z; this.L.yaw = yaw; if (!this.ctx) return;
    const now = this.ctx.currentTime; if (now - (this.lastLoopUpd || 0) < 0.15) return; this.lastLoopUpd = now;
    for (const l of this.loops) { const dist = Math.hypot(l.x - x, l.z - z), g = l.peak * Math.min(1, Math.pow(l.ref / Math.max(dist, l.ref), 1.6)); l.gain.gain.setTargetAtTime(g < 0.0005 ? 0 : g, now, 0.2);
      if (l.pan) { const dx = l.x - x, dz = l.z - z; l.pan.pan.setTargetAtTime(dist < 0.5 ? 0 : clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / dist, -1, 1) * 0.8, now, 0.2); } }
  }
  kick(p) { if (!this.ok) return; const t = this.ctx.currentTime, j = 0.95 + Math.random() * 0.1;
    this.tone(t, 170 * j, 45, 0.14 + p * 0.08, 0.35 + p * 0.55, 'sine', this.sfxBus, true); this.noise(t, 0.04 + p * 0.04, 1500 + p * 900, 1.1, 0.2 + p * 0.45, 'bandpass', this.sfxBus, true); }
  whiff() { if (!this.ok) return; this.noise(this.ctx.currentTime, 0.18, 900, 0.7, 0.12); }
  step(surf, run) {
    if (!this.ok) return; const t = this.ctx.currentTime + Math.random() * 0.015, j = 0.88 + Math.random() * 0.24, k = run ? 1.3 : 1;
    switch (surf) {
      case 'sand': case 'grass': this.noise(t, 0.07 * k, 2400 * j, 0.6, 0.06 * k, 'highpass'); this.tone(t, 70, 45, 0.05, 0.03 * k); break; // soft swish
      case 'puddle': this.noise(t, 0.12, 1800 * j, 0.8, 0.12 * k); this.noise(t + 0.03, 0.08, 3500 * j, 1.5, 0.06 * k); break; // splash
      case 'setts': this.noise(t, 0.035, 1700 * j, 1.6, 0.1 * k); this.noise(t + 0.03 + Math.random() * 0.02, 0.025, 2300 * j, 2, 0.05 * k); this.tone(t, 140 * j, 80, 0.035, 0.05 * k); break; // knocky double tap on granite setts
      case 'concrete': this.noise(t, 0.04, 1100 * j, 0.9, 0.1 * k); this.tone(t, 105 * j, 65, 0.04, 0.045 * k); break; // pier concrete: flat, dry
      case 'gravel': for (let i = 0; i < 3; i++) this.noise(t + i * 0.018, 0.03, 3200 * j, 0.8, 0.07 * k, 'highpass'); break; // crunch
      case 'paving': this.noise(t, 0.045, 1300 * j, 1.0, 0.11 * k); this.tone(t, 120 * j, 70, 0.04, 0.05 * k); break; // flag slap, slightly hollow
      default: this.noise(t, 0.05, 900 * j, 0.8, 0.1 * k, 'lowpass'); this.tone(t, 95 * j, 60, 0.045, 0.045 * k); // tarmac: dull grit
    }
  }
  splash(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 8); // ball into the harbour
    this.noise(t, 0.35, 900, 0.6, 0.35 * g, 'lowpass', node); this.noise(t + 0.02, 0.2, 2600, 1.2, 0.12 * g, 'bandpass', node);
    for (let i = 0; i < 3; i++) this.tone(t + 0.12 + i * 0.07, 500 + Math.random() * 300, 900 + Math.random() * 400, 0.06, 0.03 * g, 'sine', node); }
  rigging(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 10, this.amb), n = 1 + (Math.random() * 3 | 0); // halyard clinking on a mast
    for (let i = 0; i < n; i++) { const f = 2100 + Math.random() * 900; this.tone(t + i * (0.12 + Math.random() * 0.2), f, f * 0.98, 0.18, 0.02 * g, 'triangle', node); } }
  // ---- ball ----
  bounce(v, hard, surf = hard ? 'wall' : 'tarmac', x, z) {
    if (!this.ok) return; const t = this.ctx.currentTime, a = Math.min(1, v / 12), j = 0.92 + Math.random() * 0.16, { node, g } = this.spot(x, z, 8), A = a * g;
    switch (surf) {
      case 'sand': case 'grass': this.tone(t, 110 * j, 55, 0.12, 0.04 + A * 0.3, 'sine', node); this.noise(t, 0.05, 500, 0.8, A * 0.12, 'lowpass', node); return;
      case 'puddle': this.tone(t, 150 * j, 70, 0.08, 0.04 + A * 0.25, 'sine', node); this.noise(t, 0.18, 2200 * j, 0.7, A * 0.3, 'bandpass', node); return;
      case 'board': this.tone(t, 130 * j, 70, 0.07, 0.05 + A * 0.35, 'sine', node); this.noise(t, 0.04, 700, 1.2, A * 0.3, 'bandpass', node); return;
      case 'plastic': this.tone(t, 95 * j, 50, 0.14, 0.06 + A * 0.45, 'sine', node); this.noise(t, 0.06, 450, 1.0, A * 0.25, 'lowpass', node); return; // wheelie-bin thunk
      case 'glass': this.tone(t, 190 * j, 90, 0.06, 0.04 + A * 0.3, 'sine', node); [2900, 4100].forEach((f) => this.tone(t, f * j, f * j * 0.995, 0.25, 0.03 * A + 0.005, 'sine', node)); return; // bus-stop panel
      case 'garage': this.tone(t, 160 * j, 70, 0.07, 0.05 + A * 0.35, 'sine', node); for (let i = 0; i < 4; i++) this.noise(t + 0.015 + i * 0.045, 0.06, 1200 + i * 300, 2.5, A * (0.22 - i * 0.04), 'bandpass', node); this.tone(t, 330 * j, 310, 0.4, 0.03 * A, 'triangle', node); return; // up-and-over door rattle
    }
    this.tone(t, (surf === 'tarmac' || surf === 'paving' || surf === 'setts' ? 210 : 170) * j, 80, 0.08, 0.05 + A * 0.38, 'sine', node);
    this.noise(t, 0.035 + a * 0.03, surf === 'tarmac' ? 1600 : surf === 'setts' ? 2000 : 1100, 1.4, A * (surf === 'tarmac' ? 0.22 : 0.3), 'bandpass', node);
    if (surf === 'setts') this.noise(t + 0.025, 0.03, 2600 * j, 2, A * 0.12, 'bandpass', node); // rattle over the joints
    if (surf === 'metal') { [690 * j, 1470 * j, 2380 * j].forEach((f, i) => this.tone(t + i * 0.012, f, f * 0.99, 0.35 - i * 0.08, 0.05 * A + 0.01, 'triangle', node)); this.noise(t + 0.02, 0.08, 4200, 3, A * 0.12, 'bandpass', node); }
  }
  clang() { if (!this.ok) return; const t = this.ctx.currentTime; [523, 1307, 2210].forEach((f, i) => this.tone(t, f, f * 0.98, 0.6 - i * 0.15, 0.1, 'triangle')); }
  success(big) { if (!this.ok) return; const t = this.ctx.currentTime, notes = big ? [523, 659, 784, 1046, 1318] : [587, 740, 880];
    notes.forEach((f, i) => this.tone(t + i * 0.09, f, f, 0.25, 0.14, 'square', this.sfxBus, true)); this.coin(t + notes.length * 0.09); }
  coin(t = this.ctx.currentTime) { this.tone(t, 1975, 1975, 0.08, 0.1, 'sine', this.sfxBus, true); this.tone(t + 0.07, 2637, 2637, 0.35, 0.09, 'sine', this.sfxBus, true); }
  // ---- ambience (spatialised, sparse) ----
  gull(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, n = 2 + (Math.random() * 3 | 0), { node, g } = this.spot(x, z, 15, this.amb);
    for (let i = 0; i < n; i++) { if (!this.claim()) return; const s = t + i * 0.32, o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1500, s); o.frequency.exponentialRampToValueAtTime(2300, s + 0.06); o.frequency.exponentialRampToValueAtTime(1100, s + 0.26);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 3; const gg = this.ctx.createGain(); this.env(gg, s, 0.02, 0.04 * g, 0.24); o.connect(f).connect(gg).connect(node); this.release(o); o.start(s); o.stop(s + 0.3); } }
  bird(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, n = 2 + (Math.random() * 4 | 0), base = 3200 + Math.random() * 1500, { node, g } = this.spot(x, z, 8, this.amb);
    for (let i = 0; i < n; i++) this.tone(t + i * (0.09 + Math.random() * 0.08), base * (1 + Math.random() * 0.2), base * 0.7, 0.05, 0.03 * g, 'sine', node); }
  flutter(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 6); for (let i = 0; i < 6; i++) this.noise(t + i * 0.055, 0.04, 700 + Math.random() * 300, 0.9, (0.1 - i * 0.012) * g, 'bandpass', node); }
  coo(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 5, this.amb); this.tone(t, 420, 300, 0.25, 0.05 * g, 'sine', node); this.tone(t + 0.3, 380, 280, 0.3, 0.04 * g, 'sine', node); }
  carPass(roadX = -40) { // a car on the road a street away (along z), panned and doppler-ish
    if (!this.ok || !this.claim(1)) return; const c = this.ctx, t = c.currentTime, d = 5 + Math.random() * 3, dir = Math.random() < 0.5 ? -1 : 1;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass';
    const zs = this.L.z - dir * 60, ze = this.L.z + dir * 60, dist = Math.abs(roadX - this.L.x), peak = 0.06 * Math.min(1, 30 / Math.max(dist, 30));
    f.frequency.setValueAtTime(180, t); f.frequency.linearRampToValueAtTime(560, t + d / 2); f.frequency.linearRampToValueAtTime(160, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + d / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let out = g; if (c.createStereoPanner) { const p = c.createStereoPanner(), y = this.L.yaw, pn = (zz) => clamp(((roadX - this.L.x) * Math.cos(y) - (zz - this.L.z) * Math.sin(y)) / Math.max(1, Math.hypot(roadX - this.L.x, zz - this.L.z)), -1, 1) * 0.8;
      p.pan.setValueAtTime(pn(zs), t); p.pan.linearRampToValueAtTime(pn(this.L.z), t + d / 2); p.pan.linearRampToValueAtTime(pn(ze), t + d); g.connect(p); out = p; }
    s.connect(f).connect(g); out.connect(this.amb); this.release(s); s.start(t, Math.random()); s.stop(t + d + 0.1);
  }
  dog(x, z) { if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 12, this.amb), n = 1 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) { const s = t + i * 0.38; this.tone(s, 520, 300, 0.12, 0.05 * g, 'sawtooth', node); this.noise(s, 0.1, 700, 2, 0.03 * g, 'bandpass', node); } }
  voices2(x, z) { // faint kids shouting on another street: formant-ish sawtooth glides, very quiet
    if (!this.ok) return; const t = this.ctx.currentTime, { node, g } = this.spot(x, z, 20, this.amb), n = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) { if (!this.claim()) return; const s = t + i * (0.25 + Math.random() * 0.3), o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), gg = this.ctx.createGain(), p0 = 380 + Math.random() * 200;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(p0, s); o.frequency.linearRampToValueAtTime(p0 * (1.25 + Math.random() * 0.3), s + 0.12); o.frequency.linearRampToValueAtTime(p0 * 0.85, s + 0.3);
      f.type = 'bandpass'; f.frequency.value = 1100 + Math.random() * 500; f.Q.value = 4; this.env(gg, s, 0.03, 0.012 * g, 0.28); o.connect(f).connect(gg).connect(node); this.release(o); o.start(s); o.stop(s + 0.35); } }
  addLoop({ x, z, ref = 4, peak = 0.05, build }) { // a positioned continuous source; gain follows distance (see listen)
    const c = this.ctx, gain = c.createGain(); gain.gain.value = 0; let out = gain, pan = null;
    if (c.createStereoPanner) { pan = c.createStereoPanner(); gain.connect(pan); out = pan; } out.connect(this.amb); build(gain); this.loops.push({ x, z, ref, peak, gain, pan }); }
  startAmbient(spots = this.spots) {
    const c = this.ctx, S = spots || {};
    // low wind + distant traffic bed: quieter than v2.1 so the street feels calm
    const bed = (freq, gain, off) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = c.createGain(); g.gain.value = gain; s.connect(f).connect(g).connect(this.amb); s.start(0, off); return f; };
    if (S.oldtown) { // v2.5 Old Town: no howling wind; a low city hum + a soft murmur of people, all quiet
      bed(260, 0.008, 0); bed(140, 0.05, 1.1);
      const mf = bed(700, 0.006, 0.6); mf.type = 'bandpass'; mf.Q.value = 0.8; } else {
      const wf = bed(450, 0.025, 0); const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(wf.frequency); lfo.start();
      bed(110, 0.045, 1.1); }
    if (S.harbour) for (const [x, z] of S.water || []) this.addLoop({ x, z, ref: 6, peak: 0.05, build: (out) => { // lapping water against the quay
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; const sg = c.createGain(); sg.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.18 + Math.random() * 0.1; const lg = c.createGain(); lg.gain.value = 0.45; lfo.connect(lg).connect(sg.gain); lfo.start(); s.connect(lp).connect(sg).connect(out); s.start(0, Math.random() * 1.5); } });
    if (S.fryer) this.addLoop({ ...S.fryer, ref: 3, peak: 0.07, build: (out) => { // chippy: fryer sizzle + extractor hum
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; const sg = c.createGain(); sg.gain.value = 0.5;
      const am = c.createOscillator(); am.frequency.value = 7.3; const amg = c.createGain(); amg.gain.value = 0.25; am.connect(amg).connect(sg.gain); am.start(); s.connect(hp).connect(sg).connect(out); s.start(0, 0.4);
      const hum = c.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 98; const hg = c.createGain(); hg.gain.value = 0.35; hum.connect(hg).connect(out); hum.start();
      const h2 = c.createOscillator(); h2.frequency.value = 147; const h2g = c.createGain(); h2g.gain.value = 0.12; h2.connect(h2g).connect(out); h2.start(); } });
    const pick = (a) => a && a.length ? a[Math.floor(Math.random() * a.length)] : [undefined, undefined];
    const every = (min, max, fn) => { const go = () => { fn(); this.timers.push(setTimeout(go, min + Math.random() * (max - min))); }; this.timers.push(setTimeout(go, min * 0.5 + Math.random() * min)); };
    if (S.oldtown) { every(9000, 20000, () => this.voices2(...pick(S.far))); every(16000, 30000, () => this.bird(...pick(S.birds))); every(6000, 14000, () => this.coo(...pick(S.birds))); }
    else every(5000, 12000, () => this.bird(...pick(S.birds)));
    if (S.harbour) { every(2500, 7000, () => this.rigging(...pick(S.boats))); every(6000, 13000, () => { const [x, z] = pick(S.gulls); this.gull(x, z); }); }
    every(14000, 28000, () => { const [x, z] = pick(S.gulls || S.birds); this.gull(x, z); });
    every(10000, 22000, () => this.carPass(S.roadX ?? -40));
    every(40000, 90000, () => (Math.random() < 0.5 ? this.dog(...pick(S.far)) : this.voices2(...pick(S.far))));
    this.ambience = S.oldtown ? 'oldtown' : S.harbour ? 'harbour' : 'scheme';
  }
}
