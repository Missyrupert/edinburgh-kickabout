// Unified desktop (keyboard/mouse + pointer lock) and touch (joystick, look pad, buttons) input.
export class Controls {
  constructor(canvas, cb) {
    this.cb = cb; this.canvas = canvas;
    this.keys = {}; this.move = { x: 0, y: 0 }; this.run = false;
    this.lookDX = 0; this.lookDY = 0; this.charging = false; this.locked = false;
    this.touch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && !matchMedia('(pointer: fine)').matches);
    if (this.touch) document.body.classList.add('touch');
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { cb.jump(); e.preventDefault(); }
      if (e.code === 'KeyR') cb.fetchBall();
      if (e.code === 'KeyE' && !e.repeat) this.startCharge();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; if (e.code === 'KeyE') this.endCharge(); });
    canvas.addEventListener('mousedown', (e) => {
      if (this.touch || e.button !== 0) return;
      if (!this.locked) { cb.requestLock(); return; }
      this.startCharge();
    });
    addEventListener('mouseup', (e) => { if (!this.touch && e.button === 0) this.endCharge(); });
    addEventListener('mousemove', (e) => { if (this.locked) { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.charging = false; cb.unlocked(); }
    });
    this.setupTouch();
  }
  startCharge() { if (!this.charging) { this.charging = true; this.cb.chargeStart(); } }
  endCharge() { if (this.charging) { this.charging = false; this.cb.chargeEnd(); } }
  setupTouch() {
    const joy = document.getElementById('joyZone'), base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
    const look = document.getElementById('lookZone');
    let joyId = null, jc = null, lookId = null, lx = 0, ly = 0;
    const R = 55;
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
      const r = base.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      upd(e); e.preventDefault();
    });
    const upd = (e) => {
      let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const d = Math.hypot(dx, dy);
      const m = Math.min(d, R * 1.4); if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
      const kx = Math.max(-R, Math.min(R, dx)), ky = Math.max(-R, Math.min(R, dy));
      knob.style.transform = `translate(${kx}px,${ky}px)`;
      this.move.x = dx / R; this.move.y = -dy / R;
      const mag = Math.hypot(this.move.x, this.move.y); if (mag > 1) { this.move.x /= mag; this.move.y /= mag; }
      this.run = m > R * 1.05;
    };
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) upd(e); });
    const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.move.x = this.move.y = 0; this.run = false; knob.style.transform = ''; };
    joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
    look.addEventListener('pointerdown', (e) => { lookId = e.pointerId; look.setPointerCapture(e.pointerId); lx = e.clientX; ly = e.clientY; e.preventDefault(); });
    look.addEventListener('pointermove', (e) => { if (e.pointerId !== lookId) return; this.lookDX += (e.clientX - lx) * 1.6; this.lookDY += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
    look.addEventListener('pointerup', lookEnd); look.addEventListener('pointercancel', lookEnd);
    const btn = (id, down, up) => {
      const b = document.getElementById(id);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch {} down(); });
      if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); }
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    btn('btnKick', () => this.startCharge(), () => this.endCharge());
    btn('btnJump', () => this.cb.jump());
    btn('btnBall', () => this.cb.fetchBall());
    btn('btnPause', () => this.cb.pause());
  }
  consumeLook() { const d = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return d; }
  getMove() {
    if (this.touch && (this.move.x || this.move.y)) return { x: this.move.x, y: this.move.y, run: this.run };
    const k = this.keys;
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    return { x, y, run: !!(k.ShiftLeft || k.ShiftRight) };
  }
}
