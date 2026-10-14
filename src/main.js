import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { buildWorld } from './world.js';
import { ballTexture } from './textures.js';
import { Sfx } from './audio.js';
import { Controls } from './controls.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = isTouch || /Android|iPhone|iPad/i.test(navigator.userAgent);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !lowPower;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKY = 0xaebfcf;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 70, 300);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe4ecf5, 0x6a5a48, 1.6));
const sun = new THREE.DirectionalLight(0xffe0b5, 2.2);
sun.position.set(30, 60, -20);
if (renderer.shadowMap.enabled) {
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 });
}
scene.add(sun, sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
// Naive broadphase: SAP mis-handled long static kerb boxes (ball tunnelled through).
world.defaultContactMaterial.friction = 0.3;
world.defaultContactMaterial.restitution = 0.3;
const mats = { ground: new CANNON.Material('ground'), ball: new CANNON.Material('ball'), player: new CANNON.Material('player'), kerb: new CANNON.Material('kerb') };
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.kerb, { friction: 0.2, restitution: 0.35 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.player, mats.kerb, { friction: 0, restitution: 0 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.ground, { friction: 0.25, restitution: 0.58 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.player, mats.ground, { friction: 0, restitution: 0 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.player, { friction: 0.05, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.ball, { friction: 0.1, restitution: 0.7 }));
const G_STATIC = 1, G_PLAYER = 2, G_BALL = 4;

const { targets, dynamics, pigeons } = buildWorld(scene, world, mats, { shadows: renderer.shadowMap.enabled });
const targetById = Object.fromEntries(targets.map((t) => [t.id, t]));

// player: a capsule-ish sphere that slides along walls
const PLAYER_SPAWN = new CANNON.Vec3(0, 0.5, -36);
const player = new CANNON.Body({ mass: 70, material: mats.player, shape: new CANNON.Sphere(0.35), fixedRotation: true, collisionFilterGroup: G_PLAYER });
player.position.copy(PLAYER_SPAWN); world.addBody(player);
let yaw = Math.PI, pitch = -0.25;

// balls
const BALL_R = 0.22;
const ballGeo = new THREE.SphereGeometry(BALL_R, lowPower ? 16 : 24, lowPower ? 12 : 16);
const ballMat = new THREE.MeshLambertMaterial({ map: ballTexture() });
const balls = [[0.3, 0.4, -33.6], [-19, 0.4, -6], [2, 3.4, 54]].map(([x, y, z]) => {
  const body = new CANNON.Body({ mass: 0.43, material: mats.ball, shape: new CANNON.Sphere(BALL_R), linearDamping: 0.08, angularDamping: 0.25, collisionFilterGroup: G_BALL });
  body.position.set(x, y, z); world.addBody(body);
  const mesh = new THREE.Mesh(ballGeo, ballMat); mesh.castShadow = true; scene.add(mesh);
  const b = { body, mesh, home: new CANNON.Vec3(x, y, z), lastKick: -1e9, lastSound: 0 };
  body.addEventListener('collide', (e) => onBallCollide(b, e));
  return b;
});

// boot (kick animation), attached to the camera
const boot = new THREE.Group();
const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), new THREE.MeshLambertMaterial({ color: 0x24324a }));
shin.position.y = 0.25; boot.add(shin);
const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.28), new THREE.MeshLambertMaterial({ color: 0x111111 }));
shoe.position.set(0, 0, -0.08); boot.add(shoe);
boot.position.set(0.18, -1.05, -0.35); camera.add(boot);
let kickAnim = 1;

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const sfx = new Sfx();
let score = 0, started = false, paused = true, chargeT0 = 0, toastTimer = 0;
function toast(text, ms = 2400) { const el = $('toast'); el.innerHTML = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms); }
function updateHud() { $('scoreVal').textContent = score; $('targetVal').textContent = `${targets.filter((t) => t.done).length}/${targets.length}`; }
updateHud();

const controls = new Controls(renderer.domElement, {
  jump, fetchBall,
  requestLock: () => { if (started) renderer.domElement.requestPointerLock?.(); },
  unlocked: () => { if (started) pause(); },
  pause,
  chargeStart: () => { if (!paused) { chargeT0 = performance.now(); $('power').classList.add('on'); } },
  chargeEnd: () => { $('power').classList.remove('on'); if (!paused && chargeT0) kick(Math.min(1, (performance.now() - chargeT0) / 1000)); chargeT0 = 0; },
});
function pause() { paused = true; $('overlay').classList.remove('hidden'); $('startBtn').textContent = 'Resume'; if (document.pointerLockElement) document.exitPointerLock(); }
function resume() {
  sfx.init(); started = true; paused = false; $('overlay').classList.add('hidden');
  if (!controls.touch) renderer.domElement.requestPointerLock?.();
  if (!resume.once) { resume.once = 1; toast('Welcome tae the Grassmarket!<br><small>There\'s a ba\' at your feet. Try the green bin up on the right.</small>', 4500); }
}
$('startBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => { restart(); resume(); });

// ---------- gameplay ----------
const tmpV = new THREE.Vector3();
function forwardFlat() { return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); }
function grounded() {
  const r = new CANNON.RaycastResult();
  world.raycastClosest(player.position, new CANNON.Vec3(player.position.x, player.position.y - 0.47, player.position.z), { collisionFilterMask: G_STATIC, skipBackfaces: true }, r);
  return r.hasHit;
}
function jump() { if (!paused && grounded()) player.velocity.y = 5.2; }
function nearestBall() {
  let best = null, bd = 1e9;
  for (const b of balls) { const d = b.body.position.distanceTo(player.position); if (d < bd) { bd = d; best = b; } }
  return best;
}
function fetchBall() {
  if (paused) return;
  const b = nearestBall(), f = forwardFlat();
  b.body.position.set(player.position.x + f.x * 1.2, player.position.y + 0.2, player.position.z + f.z * 1.2);
  b.body.velocity.setZero(); b.body.angularVelocity.setZero();
  toast('Here\'s your ba\'.', 1000);
}
function kick(power) {
  kickAnim = 0;
  const f = forwardFlat();
  let target = null, bestScore = -1;
  for (const b of balls) {
    const p = b.body.position, dx = p.x - player.position.x, dz = p.z - player.position.z, dy = p.y - player.position.y;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.9 || dy > 1.2 || dy < -1) continue;
    const dot = dist > 0.01 ? (dx * f.x + dz * f.z) / dist : 1;
    if (dot < 0.3 && dist > 0.8) continue;
    const s = dot - dist * 0.3; if (s > bestScore) { bestScore = s; target = b; }
  }
  if (!target) { sfx.whiff(); return false; }
  const elev = THREE.MathUtils.clamp(pitch + 0.38, 0.03, 1.05);
  const speed = 4 + power * 19;
  const v = target.body.velocity;
  v.set(f.x * Math.cos(elev) * speed, Math.sin(elev) * speed, f.z * Math.cos(elev) * speed);
  const w = (speed * Math.cos(elev) / BALL_R) * 0.2; // topspin roughly matching roll
  target.body.angularVelocity.set(f.z * w, (Math.random() - 0.5) * 3, -f.x * w);
  target.lastKick = performance.now();
  sfx.kick(power);
  return true;
}
function onBallCollide(b, e) {
  const iv = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const now = performance.now();
  if (iv > 1.2 && now - b.lastSound > 70) { b.lastSound = now; sfx.bounce(iv, iv > 6); }
  const id = e.body.userData?.target; if (!id) return;
  const t = targetById[id];
  if (t.kind === 'topple') { t.touched = now; return; }
  if (iv > 1.5 && now - b.lastKick < 8000) { if (id === 'lamp' || id === 'tardis') sfx.clang(); scoreTarget(t); }
}
let lastRepeat = 0;
function scoreTarget(t) {
  const now = performance.now();
  if (t.done) { if (now - lastRepeat > 2500) { lastRepeat = now; toast(`Already bagged the ${t.name}.`, 1200); } return; }
  t.done = true; score += t.points;
  t.ring.material.color.set(0x5fd35f);
  const all = targets.every((x) => x.done);
  sfx.success(all);
  const line = t.lines[Math.floor(Math.random() * t.lines.length)];
  toast(`<b>${t.name} +${t.points}</b><br>${line}`);
  if (all) setTimeout(() => toast(`<b>Pure dead brilliant!</b><br>All ${targets.length} targets. Final score ${score}.<br><small>Pause to restart.</small>`, 7000), 2600);
  updateHud();
}
function restart() {
  score = 0;
  for (const t of targets) { t.done = false; t.touched = 0; t.ring.material.color.set(0xffd75e); }
  for (const b of balls) { b.body.position.copy(b.home); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.lastKick = -1e9; }
  for (const d of dynamics) { d.body.position.copy(d.home); d.body.quaternion.set(0, 0, 0, 1); d.body.velocity.setZero(); d.body.angularVelocity.setZero(); }
  player.position.copy(PLAYER_SPAWN); player.velocity.setZero(); yaw = Math.PI; pitch = -0.25;
  updateHud();
}

function checkZones(now) {
  for (const t of targets) {
    if (t.done && t.kind !== 'zone') continue;
    if (t.kind === 'zone') {
      for (const b of balls) {
        const p = b.body.position; tmpV.set(p.x, p.y, p.z);
        if (!t.zone.containsPoint(tmpV) || now - b.lastKick > 8000) continue;
        const sp = b.body.velocity.length();
        if (t.minSpeed && sp < t.minSpeed) continue;
        if (t.maxSpeed && sp > t.maxSpeed) continue;
        if (!t.done) scoreTarget(t);
      }
    } else if (t.kind === 'topple') {
      const up = t.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
      const moved = Math.hypot(t.body.position.x - t.pos.x, t.body.position.z - t.pos.z);
      if ((up.y < 0.5 || moved > 0.6) && now - (t.touched || -1e9) < 5000) scoreTarget(t);
    }
  }
}

let simTime = 0;
function step(dt) {
  simTime += dt;
  const now = performance.now();
  // look
  const [lx, ly] = controls.consumeLook();
  yaw -= lx * 0.0024; pitch = THREE.MathUtils.clamp(pitch - ly * 0.0024, -1.45, 1.35);
  // move
  const m = controls.getMove(), f = forwardFlat(), r = new THREE.Vector3(-f.z, 0, f.x);
  const wish = f.multiplyScalar(m.y).add(r.multiplyScalar(m.x));
  if (wish.lengthSq() > 1) wish.normalize();
  const speed = m.run ? 7.2 : 4.2, onGround = grounded(), k = Math.min(1, dt * (onGround ? 12 : 2.5));
  player.velocity.x += (wish.x * speed - player.velocity.x) * k;
  player.velocity.z += (wish.z * speed - player.velocity.z) * k;
  if (onGround && player.velocity.y > 0 && player.velocity.y < 2 && wish.lengthSq() > 0) player.velocity.y = Math.min(player.velocity.y, 1.5);
  world.step(1 / 120, dt, 12); // small step: a 20 m/s ball must not sink into kerbs
  // rolling resistance on the ground
  for (const b of balls) {
    const p = b.body.position, rr = new CANNON.RaycastResult();
    world.raycastClosest(p, new CANNON.Vec3(p.x, p.y - BALL_R - 0.06, p.z), { collisionFilterMask: G_STATIC }, rr);
    if (rr.hasHit) { const d = 1 - Math.min(1, 0.9 * dt); b.body.velocity.x *= d; b.body.velocity.z *= d; }
    if (p.y < -3 || Math.abs(p.x) > 40 || p.z < -60 || p.z > 75) { p.copy(b.home); b.body.velocity.setZero(); toast('Ball lost ower the wall - it\'s back where you found it.', 1800); }
  }
  if (player.position.y < -3) { player.position.copy(PLAYER_SPAWN); player.velocity.setZero(); }
  checkZones(now);
}

function render(dt, t) {
  const p = player.position, sp = Math.hypot(player.velocity.x, player.velocity.z);
  const bob = Math.sin(t * 0.011) * Math.min(1, sp / 4) * 0.04;
  camera.position.set(p.x, p.y + 1.25 + bob, p.z);
  camera.rotation.set(pitch, yaw, 0);
  for (const b of balls) { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); }
  for (const d of dynamics) { d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion); }
  // kick animation: swing boot forward & up
  kickAnim = Math.min(1, kickAnim + dt * 4);
  const s = Math.sin(kickAnim * Math.PI);
  boot.position.set(0.18, -1.05 + s * 0.35, -0.35 - s * 0.5); boot.rotation.x = -s * 1.1;
  boot.visible = kickAnim < 1 || pitch < -0.6;
  if (chargeT0) $('powerFill').style.width = `${Math.min(1, (performance.now() - chargeT0) / 1000) * 100}%`;
  // target rings + nearby hint
  let near = null, nd = 1e9;
  for (const tg of targets) {
    const d = Math.hypot(tg.pos.x - p.x, tg.pos.z - p.z);
    tg.ring.material.opacity = tg.done ? 0.25 : THREE.MathUtils.clamp((16 - d) / 8, 0, 0.85) * (0.75 + 0.25 * Math.sin(t * 0.005));
    if (!tg.done && d < 14 && d < nd) { nd = d; near = tg; }
  }
  $('nearby').textContent = near ? `Nearby: ${near.name} - ${near.hint} (${near.points})` : '';
  // pigeons
  for (const pg of pigeons) {
    if (pg.state === 'idle') {
      pg.t -= dt; if (pg.t < 0) { pg.t = 1 + Math.random() * 3; pg.g.rotation.y += (Math.random() - 0.5) * 2; }
      const scare = (q) => q.distanceTo(pg.g.position) < 2.4;
      if (scare(tmpV.set(p.x, pg.g.position.y, p.z)) || balls.some((b) => scare(tmpV.set(b.body.position.x, b.body.position.y, b.body.position.z)))) {
        pg.state = 'fly'; pg.t = 4; pg.vel.set((Math.random() - 0.5) * 6, 4 + Math.random() * 2, (Math.random() - 0.5) * 6);
        if (Math.random() < 0.3) sfx.coo();
      }
    } else if (pg.state === 'fly') {
      pg.g.position.addScaledVector(pg.vel, dt); pg.vel.y += dt; pg.t -= dt;
      if (pg.t < 0) { pg.state = 'gone'; pg.g.visible = false; pg.t = 15; }
    } else { pg.t -= dt; if (pg.t < 0 && Math.hypot(p.x - pg.home.x, p.z - pg.home.z) > 10) { pg.state = 'idle'; pg.g.visible = true; pg.g.position.copy(pg.home); } }
  }
  sun.position.set(p.x + 30, 60, p.z - 20); sun.target.position.set(p.x, 0, p.z);
  renderer.render(scene, camera);
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (!paused) step(dt);
  render(dt, t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Test/debug hooks (used by scripts/verify.mjs).
window.__game = {
  get score() { return score; }, get simTime() { return simTime; },
  waitSim(sec) { const t0 = simTime; return new Promise((res) => { const f = () => (simTime - t0 >= sec ? res() : setTimeout(f, 30)); f(); }); }, targets, balls, player,
  start: () => { started = true; paused = false; $('overlay').classList.add('hidden'); },
  teleport(x, z, yawDeg, pitchDeg = -15, y) { player.position.set(x, y ?? player.position.y, z); player.velocity.setZero(); yaw = yawDeg * Math.PI / 180; pitch = pitchDeg * Math.PI / 180; },
  placeBall(i, x, y, z) { const b = balls[i].body; b.position.set(x, y, z); b.velocity.setZero(); b.angularVelocity.setZero(); },
  kick, restart, world,
  simulate(sec) { for (let i = 0; i < Math.round(sec * 60); i++) step(1 / 60); },
};
