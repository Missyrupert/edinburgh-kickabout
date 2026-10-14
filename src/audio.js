// Procedural WebAudio: no audio files needed.
export class Sfx {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 3;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }
  get ok() { return this.ctx && this.ctx.state === 'running'; }
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
  bounce(v, hard) {
    if (!this.ok) return; const t = this.ctx.currentTime; const a = Math.min(1, v / 12);
    this.tone(t, hard ? 260 : 140, hard ? 90 : 60, 0.09, 0.05 + a * 0.4);
    if (hard) this.noiseBurst(t, 0.05, 2500, 2, a * 0.25);
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
    const g = c.createGain(); g.gain.value = 0.07;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 300;
    lfo.connect(lg).connect(f.frequency); lfo.start();
    s.connect(f).connect(g).connect(this.master); s.start();
    // distant traffic rumble
    const s2 = c.createBufferSource(); s2.buffer = this.noiseBuf; s2.loop = true;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 120;
    const g2 = c.createGain(); g2.gain.value = 0.12;
    s2.connect(f2).connect(g2).connect(this.master); s2.start(0, 1.3);
    const loop = () => { this.gull(); setTimeout(loop, 7000 + Math.random() * 9000); };
    setTimeout(loop, 2500);
  }
}
