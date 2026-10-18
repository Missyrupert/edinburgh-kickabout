// Procedural WebAudio: no audio files needed.
export class Sfx {
  constructor() { this.ctx = null; try { this.on = localStorage.getItem('ek-sound') !== 'off'; } catch { this.on = true; } }
  setOn(on) { this.on = on; try { localStorage.setItem('ek-sound', on ? 'on' : 'off'); } catch {} if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 3;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }
  get ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  noiseBurst(t, dur, freq, q, peak, type = 'bandpass') {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this.env(g, t, 0.003, peak, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  tone(t, f0, f1, dur, peak, type = 'sine') {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain(); this.env(g, t, 0.005, peak, dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  kick(p) {
    if (!this.ok) return; const t = this.ctx.currentTime;
    this.tone(t, 180, 45, 0.18, 0.5 + p * 0.5);
    this.noiseBurst(t, 0.06, 1800, 1.2, 0.3 + p * 0.4);
  }
  whiff() { if (!this.ok) return; this.noiseBurst(this.ctx.currentTime, 0.18, 900, 0.7, 0.15); }
  // v2.1: ball impacts by surface. 'grass' = dull thud, 'tarmac' = bouncy pock, 'wall' = flat slap, 'metal' = slap + ring
  bounce(v, hard, surf = hard ? 'wall' : 'tarmac') {
    if (!this.ok) return; const t = this.ctx.currentTime; const a = Math.min(1, v / 12), j = 0.92 + Math.random() * 0.16;
    if (surf === 'grass') { this.tone(t, 110 * j, 55, 0.12, 0.04 + a * 0.3); this.noiseBurst(t, 0.05, 500, 0.8, a * 0.12, 'lowpass'); return; }
    this.tone(t, (surf === 'tarmac' ? 210 : 170) * j, 80, 0.08, 0.05 + a * 0.38);
    this.noiseBurst(t, 0.035 + a * 0.03, surf === 'tarmac' ? 1600 : 1100, 1.4, a * (surf === 'tarmac' ? 0.22 : 0.3));
    if (surf === 'metal' && a > 0.3) [690, 1470].forEach((f) => this.tone(t, f, f * 0.99, 0.35, 0.05 * a, 'triangle'));
  }
  step(run) { // soft trainer footstep on pavement
    if (!this.ok) return; const t = this.ctx.currentTime;
    this.noiseBurst(t, run ? 0.05 : 0.04, 600 + Math.random() * 300, 0.9, run ? 0.07 : 0.045, 'lowpass');
    this.tone(t, 90, 60, 0.04, run ? 0.03 : 0.02);
  }
  bird() { // sparrow/starling-ish chirps from somewhere nearby
    if (!this.ok) return; const t = this.ctx.currentTime, n = 2 + (Math.random() * 4 | 0), base = 3200 + Math.random() * 1500;
    for (let i = 0; i < n; i++) { const s = t + i * (0.09 + Math.random() * 0.08); this.tone(s, base * (1 + Math.random() * 0.2), base * 0.7, 0.05, 0.018, 'sine'); }
  }
  carPass() { // a car going by on the main road, a street away
    if (!this.ok) return; const c = this.ctx, t = c.currentTime, d = 4 + Math.random() * 3;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(520, t + d / 2); f.frequency.linearRampToValueAtTime(180, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + d / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let out = g; if (c.createStereoPanner) { const p = c.createStereoPanner(); const dir = Math.random() < 0.5 ? -1 : 1; p.pan.setValueAtTime(-0.8 * dir, t); p.pan.linearRampToValueAtTime(0.8 * dir, t + d); g.connect(p); out = p; }
    s.connect(f).connect(g); out.connect(this.master); s.start(t, Math.random() * 2); s.stop(t + d + 0.1);
  }
  clang() { // metal: lamppost / bin
    if (!this.ok) return; const t = this.ctx.currentTime;
    [523, 1307, 2210].forEach((f, i) => this.tone(t, f, f * 0.98, 0.6 - i * 0.15, 0.12, 'triangle'));
  }
  success(big) {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const notes = big ? [523, 659, 784, 1046, 1318] : [587, 740, 880];
    notes.forEach((f, i) => this.tone(t + i * 0.09, f, f, 0.25, 0.18, 'square'));
  }
  gull() {
    if (!this.ok) return; const t = this.ctx.currentTime; const n = 2 + Math.floor(Math.random() * 3);
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.32, o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1500, s); o.frequency.exponentialRampToValueAtTime(2300, s + 0.06);
      o.frequency.exponentialRampToValueAtTime(1100, s + 0.26);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 3;
      const g = this.ctx.createGain(); this.env(g, s, 0.02, 0.05, 0.24);
      o.connect(f).connect(g);
      if (pan) { pan.pan.value = Math.random() * 2 - 1; g.connect(pan).connect(this.master); } else g.connect(this.master);
      o.start(s); o.stop(s + 0.3);
    }
  }
  coo() { if (!this.ok) return; const t = this.ctx.currentTime; this.tone(t, 420, 300, 0.25, 0.06); this.tone(t + 0.3, 380, 280, 0.3, 0.05); }
  startAmbient() {
    const c = this.ctx;
    // wind: looped noise through a slowly swept lowpass
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 300;
    lfo.connect(lg).connect(f.frequency); lfo.start();
    s.connect(f).connect(g).connect(this.master); s.start();
    // distant traffic rumble
    const s2 = c.createBufferSource(); s2.buffer = this.noiseBuf; s2.loop = true;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 120;
    const g2 = c.createGain(); g2.gain.value = 0.09;
    s2.connect(f2).connect(g2).connect(this.master); s2.start(0, 1.3);
    const loop = () => { this.gull(); setTimeout(loop, 12000 + Math.random() * 14000); };
    setTimeout(loop, 4000);
    const birds = () => { this.bird(); setTimeout(birds, 5000 + Math.random() * 9000); }; setTimeout(birds, 1500);
    const cars = () => { this.carPass(); setTimeout(cars, 9000 + Math.random() * 16000); }; setTimeout(cars, 3000);
  }
}
