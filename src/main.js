import '@fontsource/alfa-slab-one/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/patrick-hand/400.css';
import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { PRESET, PRESET_SOURCE, SHOW_PERF, DYNRES, choosePreset } from './settings.js';
import { LEVEL, LEVELS, LEVEL_ORDER, travelTo } from './levels/index.js';
import { unlocks, recordDone, levelDone, tierCount, TIERS, selectBall, selectBoots, BOOTS, resetProgress, BALLS, ITEMS, saveUnlocks } from './unlocks.js';
import { wallet, saveWallet, earn, buySupper, resetWallet, fmt, GOAL, BONUS, cashFor, CHIPPY_TARGETS } from './wallet.js';
import { ballTexture, skyTexture, texManager, texStats } from './textures.js';
import { Sfx } from './audio.js';
import { Controls } from './controls.js';

const P = PRESET;
// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: P.antialias, powerPreference: 'high-performance' });
const basePixelRatio = Math.min(devicePixelRatio, P.maxPixelRatio);
let resScale = 1, dynResOn = DYNRES;
renderer.setPixelRatio(basePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = P.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // v2.7: softer shadow edges
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = P.pbr ? 1.05 : 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const HAZE = 0xdcc9ad; // v2.7: late-afternoon haze
const _HAZE_OLD = 0xd8d0c0; // v2.0: warmer, softer haze
scene.fog = new THREE.Fog(HAZE, 50, P.fogFar);
// Sky: CC0 Poly Haven kloofendal_48d_partly_cloudy_puresky (tonemapped WebP backdrop; the 1K HDR is only loaded on "high" for reflections).
scene.background = skyTexture(); scene.backgroundIntensity = 0.95;
let assetsLoaded = false;
texManager.onLoad = () => { assetsLoaded = true; };
if (P.env) new HDRLoader(texManager).load(import.meta.env.BASE_URL + 'hdri/sky_1k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(hdr).texture; pm.dispose(); hdr.dispose();
  scene.environmentIntensity = 0.55;
});
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 600);
// v1.8.2: Hor+ FOV. In portrait a fixed 72 deg vertical FOV left only ~36 deg across and hid the first ~2.4 m of ground,
// so a ball that looked 'at your feet' was really 2.5-3 m away (outside reach). Keep >=56 deg horizontal, cap at 88 deg vertical.
function fitFov() { const a = innerWidth / innerHeight, minH = 56 * Math.PI / 180; const v = 2 * Math.atan(Math.tan(minH / 2) / a) * 180 / Math.PI; camera.fov = Math.min(88, Math.max(72, v)); camera.aspect = a; camera.updateProjectionMatrix(); }
fitFov();
camera.rotation.order = 'YXZ';
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xf0dcc0, 0x6e5a46, P.pbr ? 1.05 : 1.45));
const sun = new THREE.DirectionalLight(0xffc68a, P.pbr ? 2.5 : 2.1); // warm, lowish sun from the south-west
const SUN_OFF = new THREE.Vector3(26, 30, -55); // lower, late-afternoon sun
if (P.shadows) {
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
}
scene.add(sun, sun.target);
addEventListener('resize', () => { fitFov(); renderer.setSize(innerWidth, innerHeight); });

// ---------- physics ----------
// Broadphase that only pairs bodies that can move (ball, player, cone) with everything else.
// The world has ~250 static colliders; naive N^2 pairing wasted most of the physics budget,
// and SAP mis-handled the long kerb boxes (ball tunnelled through).
class DynamicPairsBroadphase extends CANNON.NaiveBroadphase {
  constructor() { super(); this.useBoundingBoxes = true; }
  collisionPairs(world, p1, p2) {
    const bodies = world.bodies, n = bodies.length;
    for (let i = 0; i < n; i++) {
      const a = bodies[i]; if (a.type === CANNON.Body.STATIC) continue;
      for (let j = 0; j < n; j++) {
        const b = bodies[j]; if (b === a || (b.type !== CANNON.Body.STATIC && j < i)) continue;
        if (!this.needBroadphaseCollision(a, b)) continue;
        this.intersectionTest(a, b, p1, p2);
      }
    }
  }
}
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new DynamicPairsBroadphase();
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

// v2.0: shop fascias are painted on a canvas, so wait (briefly) for the bundled fonts before building.
await Promise.race([Promise.all(['40px "Alfa Slab One"', '700 40px "Barlow Condensed"'].map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
const built = LEVEL.build(scene, world, mats, P);
const { targets, dynamics, pigeons, materials, views } = built;
const SPAWN_YAW = LEVEL.spawnYaw * Math.PI / 180, BOUNDS = LEVEL.bounds;
const challenges = built.challenges || [];
const DONE_RING = 0x47d16c; // v1.9: bagged targets keep a solid bright-green ring
const allTargets = targets.concat(challenges); // challenges share the scoring code but have their own counter
for (const t of targets) t.tier ||= LEVEL.tiers?.[t.id];
for (const t of targets) t.tier ||= t.diff === 'hard' ? 'tricky' : 'easy';
{ const d = levelDone(LEVEL.id); for (const t of allTargets) if (d[t.id]) { t.done = true; t.ring.material.color.set(DONE_RING); } } // saved progress
const targetById = Object.fromEntries(allTargets.map((t) => [t.id, t]));
// Static bodies were positioned after construction: refresh their AABBs once, or AABB broadphase misses them.
// (This stale-AABB effect is also what made SAPBroadphase look "broken" in v1.)
for (const b of world.bodies) b.updateAABB();
// v1.7: container floors are dead (low bounce) so a ball that drops in stays in
mats.binFloor = new CANNON.Material('binFloor');
world.addContactMaterial(new CANNON.ContactMaterial(mats.ball, mats.binFloor, { friction: 0.5, restitution: 0.08 }));
const containers = allTargets.filter((t) => t.kind === 'zone' && t.openTop);
const inContainer = (p) => containers.some((t) => { const q = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(t.zoneInv), z = t.zone;
  return q.x > z.min.x && q.x < z.max.x && q.z > z.min.z && q.z < z.max.z && q.y > z.min.y - 0.3 && q.y < z.max.y + 0.1; });
for (const b of world.bodies) if (b.type === CANNON.Body.STATIC && b.aabb.upperBound.y - b.aabb.lowerBound.y < 0.25) {
  const c = b.aabb.lowerBound.vadd(b.aabb.upperBound).scale(0.5); if (inContainer(c)) b.material = mats.binFloor; }

// player: a sphere that slides along walls
const PLAYER_SPAWN = new CANNON.Vec3(...LEVEL.spawn);
const player = new CANNON.Body({ mass: 70, material: mats.player, shape: new CANNON.Sphere(0.35), fixedRotation: true, collisionFilterGroup: G_PLAYER });
player.position.copy(PLAYER_SPAWN); world.addBody(player);
let yaw = SPAWN_YAW, pitch = -0.25;

// balls (mass, size, damping unchanged from v1)
const BALL_R = 0.22;
const ballGeo = new THREE.SphereGeometry(BALL_R, P.ballSeg[0], P.ballSeg[1]);
const ballTex = ballTexture(unlocks.ball);
const ballMat = P.pbr ? new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.36, metalness: 0 }) : new THREE.MeshLambertMaterial({ map: ballTex });
const BALL_HOMES = LEVEL.ballHomes(views);
const balls = BALL_HOMES.map(([x, y, z]) => {
  const body = new CANNON.Body({ mass: 0.43, material: mats.ball, shape: new CANNON.Sphere(BALL_R), linearDamping: 0.08, angularDamping: 0.25, collisionFilterGroup: G_BALL });
  body.position.set(x, y, z); world.addBody(body);
  const mesh = new THREE.Mesh(ballGeo, ballMat); mesh.castShadow = P.shadows; scene.add(mesh);
  const b = { body, mesh, home: new CANNON.Vec3(x, y, z), lastKick: -1e9, lastSound: 0, prevP: new THREE.Vector3(x, y, z), prevQ: new THREE.Quaternion() };
  body.addEventListener('collide', (e) => onBallCollide(b, e));
  return b;
});

// boot (kick animation), attached to the camera: one mesh
// a scuffed trainer (default) or unlockable classic black boots, with shin; cosmetic only (no physics)
function footGeo(style) {
  const parts = [], B = (w, h, d, x, y, z, c) => parts.push([new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(), c]);
  B(0.11, 0.48, 0.11, 0, 0.33, 0.01, 0x3b4a63); // trouser shin
  B(0.105, 0.07, 0.105, 0, 0.08, 0.01, style === 'boots' ? 0x101010 : 0xe8e8e4); // sock / collar
  if (style === 'boots') {
    B(0.13, 0.085, 0.27, 0, 0.035, -0.07, 0x141414); B(0.12, 0.05, 0.08, 0, 0.02, -0.19, 0x1c1c1c); B(0.135, 0.022, 0.285, 0, -0.016, -0.07, 0x2a2a2a);
    for (const z of [-0.17, -0.09, 0.02]) for (const x of [-0.045, 0.045]) B(0.022, 0.02, 0.022, x, -0.035, z, 0x8a8a8a); // studs
    B(0.03, 0.006, 0.12, 0, 0.08, -0.08, 0xdddddd); // white laces
  } else {
    B(0.135, 0.09, 0.26, 0, 0.035, -0.07, 0xdedcd6); B(0.125, 0.06, 0.08, 0, 0.02, -0.18, 0xc9c6bf); // upper + scuffed toe
    B(0.145, 0.035, 0.285, 0, -0.012, -0.07, 0x8d8f93); B(0.04, 0.007, 0.12, 0, 0.082, -0.07, 0x9a9a9a); // sole, laces
    B(0.137, 0.03, 0.06, 0, 0.03, -0.205, 0x6f6a62); // mucky scuff
  }
  const g = new THREE.BufferGeometry(), cols = [];
  for (const [p, c] of parts) { const k = new THREE.Color(c), n = p.attributes.position.count, arr = new Float32Array(n * 3); for (let q = 0; q < n; q++) arr.set([k.r, k.g, k.b], q * 3); p.setAttribute('color', new THREE.BufferAttribute(arr, 3)); }
  for (const k of ['position', 'normal', 'uv', 'color']) { const tot = parts.reduce((a, [p]) => a + p.attributes[k].array.length, 0), arr = new Float32Array(tot); let o = 0;
    for (const [p] of parts) { arr.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(arr, parts[0][0].attributes[k].itemSize)); }
  return g;
}
const bootGeo = footGeo(unlocks.boots);
const boot = new THREE.Mesh(bootGeo, materials.flat);
boot.position.set(0.18, -1.05, -0.35); camera.add(boot);
let kickAnim = 1;

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const sfx = new Sfx(); sfx.spots = LEVEL.sounds || { birds: [[0, 0], [-19, -6]], far: [[-60, 0], [60, 40]], roadX: 50 };
const surfaceAt = LEVEL.surfaceAt || (() => 'paving');
const TARGET_SURF = { garage: 'garage', bin: 'plastic', wheelie: 'plastic', busstop: 'glass', trolley: 'metal', lamp: 'metal', gap: 'metal', noballs: 'metal', tardis: 'metal', post: 'metal', door: 'wall', bench: 'board', skip: 'metal', case: 'board', cone: 'plastic' };
let score = 0, started = false, paused = true, chargeT0 = 0, toastTimer = 0;
function toast(text, ms = 2400) { const el = $('toast'); el.innerHTML = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms); }
function updateHud() { if (LEVEL.id !== "pilton") try { updateWallet(); } catch (e) { /* v2.9: keep the per-level goal bar in step (wallet not ready during boot) */ } $('scoreVal').textContent = score; $('targetVal').textContent = `${targets.filter((t) => t.done).length}/${targets.length}`;
  const tc = (tier) => `${tierCount(LEVEL.id, allTargets, tier)}/${allTargets.filter((x) => x.tier === tier).length}`;
  // v2.3: compact challenge line for phones (full names live in Help)
  $('chal').classList.remove('hidden'); $('chalVal').textContent = `⭐ ${tc('easy')}  🔥 ${tc('tricky')}` + (challenges.length ? `  ✨ ${tc('legend')}` : '');
  $('chal').title = 'Warm-Up · Cocky · Away Ye Go!'; }
updateHud();
// ---------- wallet (pocket money) ----------
let lastEarn = null, stepDist = 0, stepLen = 1.25;
const piltonBagged = () => Object.keys(levelDone('pilton') || {}).filter((k) => !k.startsWith('c_')).length;
const chippyEarned = () => piltonBagged() >= CHIPPY_TARGETS;
function updateWallet(pop = false) {
  $('walletVal').textContent = fmt(wallet.pence);
  const n = Math.min(piltonBagged(), CHIPPY_TARGETS), f = Math.min(1, wallet.pence / GOAL.pence, n / CHIPPY_TARGETS);
  if (LEVEL.id !== 'pilton') { // v2.6: the supper is a Pilton goal; elsewhere show this level's own progress
    const k = targets.filter((t) => t.done).length; $('goalFill').style.width = `${k / targets.length * 100}%`;
    $('goalTxt').innerHTML = k >= targets.length ? `🏆 <b>${LEVEL.short} cleared!</b> ${k}/${targets.length}` : `🎯 ${LEVEL.short}: <b>${k}/${targets.length}</b> targets`;
    $('wallet').classList.toggle('full', k >= targets.length);
    if (pop) { $('wallet').classList.remove('pop'); void $('wallet').offsetWidth; $('wallet').classList.add('pop'); }
    return;
  }
  $('goalFill').style.width = `${f * 100}%`;
  $('goalTxt').innerHTML = f >= 1 ? (built.counter ? '🍟 <b>Chippy unlocked!</b> Visit the counter' : '🍟 <b>Chippy unlocked!</b> Back tae Pilton') : `🍟 Supper: <b>${n}/${CHIPPY_TARGETS}</b> Pilton targets · <b>${fmt(Math.min(wallet.pence, GOAL.pence))}/${fmt(GOAL.pence)}</b>`;
  $('wallet').classList.toggle('full', f >= 1);
  if (pop) { $('wallet').classList.remove('pop'); void $('wallet').offsetWidth; $('wallet').classList.add('pop'); }
}
function showGoal(bought = false) {
  $('goalBig').textContent = '🍟 🥤'; $('goalTitle').textContent = bought ? 'One fish supper an\' an Irn-Bru!' : 'Chippy unlocked!';
  $('goalLine').innerHTML = bought
    ? `"That's ${fmt(GOAL.pence)}, son. Salt an' vinegar? ...Course ye dae."<br><small>Suppers bought: ${wallet.suppers}. Wallet: ${fmt(wallet.pence)}</small>`
    : `You've saved ${fmt(wallet.pence)} - enough for a chippy an' an Irn-Bru.<br><small>${LEVEL.id === 'pilton' ? 'Head to the counter at The Pilton Plaice (top of the street).' : 'Get yersel tae West Pilton - The Pilton Plaice is open.'}</small>`;
  $('goalCard').classList.remove('hidden'); sfx.success(true);
  if (document.pointerLockElement) document.exitPointerLock();
}
$('goalOk').addEventListener('click', () => { $('goalCard').classList.add('hidden'); if (started && !paused && !controls.touch) renderer.domElement.requestPointerLock?.(); });
{ const sb = $('soundBtn'), lab = () => { sb.textContent = sfx.on ? '🔊 Sound: on' : '🔇 Sound: off'; }; lab(); sb.addEventListener('click', () => { sfx.setOn(!sfx.on); lab(); });
  const vs = $('volSlider'); vs.value = Math.round(sfx.vol * 100); vs.addEventListener('input', () => sfx.setVolume(vs.value / 100)); }
$('walletReset').addEventListener('click', () => { if (confirm('Reset your pocket money to £0.00?')) { resetWallet(); updateWallet(); } });
updateWallet();
let counterCool = 0;
function checkCounter() { // the chippy counter (West Pilton): buy a supper when you can afford one
  if (!built.counter || simTime < counterCool) return;
  if (Math.hypot(player.position.x - built.counter.x, player.position.z - built.counter.z) > 1.8) return;
  counterCool = simTime + 4;
  openCounter();
}
const MENU = ['wee', 'supper', 'munchie'];
function openCounter() {
  $('cntWallet').textContent = fmt(wallet.pence);
  for (const id of MENU) { const b = $('cnt_' + id), m = ITEMS[id], on = unlocks.items.includes(id);
    b.textContent = on ? `${m.name} ${fmt(m.pence)}` : `🔒 ${m.name} (${m.how})`; b.disabled = !on || wallet.pence < m.pence || (id === 'supper' && !chippyEarned()); if (on && id === 'supper' && !chippyEarned()) b.textContent = `🔒 ${m.name} (bag ${CHIPPY_TARGETS} Pilton targets)`; }
  $('cntLine').innerHTML = '"What can I get ye, pal?"';
  $('counterCard').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock();
}
function buyItem(id) {
  const m = ITEMS[id]; if (!m || !unlocks.items.includes(id) || wallet.pence < m.pence || (id === 'supper' && !chippyEarned())) return false;
  if (id === 'supper') { if (!buySupper()) return false; } else { wallet.pence -= m.pence; saveWallet(); }
  unlocks.bought[id] = (unlocks.bought[id] || 0) + 1; saveUnlocks(); updateWallet(true); return true;
}
for (const id of MENU) $('cnt_' + id).addEventListener('click', () => {
  if (!buyItem(id)) return;
  if (id === 'supper') { $('counterCard').classList.add('hidden'); showGoal(true); return; }
  $('cntLine').innerHTML = ITEMS[id].line; sfx.success(false); openCounterRefresh();
});
function openCounterRefresh() { const l = $('cntLine').innerHTML; openCounter(); $('cntLine').innerHTML = l; }
$('cntClose').addEventListener('click', () => { $('counterCard').classList.add('hidden'); if (started && !paused && !controls.touch) renderer.domElement.requestPointerLock?.(); });
// ---------- ball selector (cosmetic only: same body, mass, size) ----------
function applyBall(id) { if (!selectBall(id)) return false; ballMat.map = ballTexture(id); ballMat.needsUpdate = true; buildBallMenu(); return true; }
function applyBoots(id) { if (!selectBoots(id)) return false; boot.geometry.dispose(); boot.geometry = footGeo(id); buildBallMenu(); return true; }
function buildBallMenu() {
  const el = $('ballSel'); el.innerHTML = '';
  const row = document.createElement('div'); row.textContent = 'Feet: ';
  for (const [id, b] of Object.entries(BOOTS)) { const on = unlocks.bootsOwned.includes(id); const btn = document.createElement('button');
    btn.textContent = on ? b.name : `🔒 ${b.name} (${b.how})`; btn.disabled = !on; btn.dataset.boots = id; if (unlocks.boots === id) btn.classList.add('on');
    btn.addEventListener('click', () => applyBoots(id)); row.appendChild(btn); }
  el.appendChild(row); el.appendChild(document.createTextNode('Ball: '));
  for (const [id, b] of Object.entries(BALLS)) { const on = unlocks.balls.includes(id); const btn = document.createElement('button');
    btn.textContent = on ? b.name : `🔒 ${b.name} (${b.how})`; btn.disabled = !on; btn.dataset.ball = id; if (unlocks.ball === id) btn.classList.add('on');
    btn.addEventListener('click', () => applyBall(id)); el.appendChild(btn); }
}
buildBallMenu();
$('progressReset').addEventListener('click', () => { if (confirm('Reset progress: completed targets, unlocked balls/boots and chippy items and pocket money?')) { resetProgress(); resetWallet(); updateWallet(); ballMat.map = ballTexture('tango'); ballMat.needsUpdate = true; boot.geometry = footGeo('trainers'); buildBallMenu(); updateHud(); } });
// ---------- levels ----------
$('levelNow').textContent = LEVEL.name; $('levelBlurb').textContent = LEVEL.blurb;
document.querySelectorAll('[data-level]').forEach((b) => { if (b.dataset.level === LEVEL.id) b.classList.add('on'); b.addEventListener('click', () => { if (b.dataset.level !== LEVEL.id) travelTo(b.dataset.level); }); });
$('travelBtn').textContent = `Travel to ${LEVELS[LEVEL.next].name}`;
$('travelBtn').addEventListener('click', () => travelTo(LEVEL.next));
$('presetNow').textContent = `${P.name} (${PRESET_SOURCE})`;
document.querySelectorAll('[data-preset]').forEach((b) => {
  if (b.dataset.preset === (PRESET_SOURCE === 'auto' ? 'auto' : P.name)) b.classList.add('on');
  b.addEventListener('click', () => choosePreset(b.dataset.preset));
});
let perfOn = SHOW_PERF;
const setPerf = (on) => { perfOn = on; $('perf').classList.toggle('hidden', !on); $('perfBtn').classList.toggle('on', on); };
setPerf(perfOn);
$('perfBtn').addEventListener('click', () => setPerf(!perfOn));
addEventListener('keydown', (e) => { if (e.code === 'KeyP') setPerf(!perfOn); });

const controls = new Controls(renderer.domElement, {
  jump, fetchBall: () => requestBall(),
  requestLock: () => { if (started) renderer.domElement.requestPointerLock?.(); },
  unlocked: () => { if (started && $('goalCard').classList.contains('hidden') && $('counterCard').classList.contains('hidden')) pause(); },
  pause,
  chargeStart: () => { if (!paused) { chargeT0 = performance.now(); $('power').classList.add('on'); } },
  chargeEnd: () => { $('power').classList.remove('on'); if (!paused && chargeT0) kick(Math.min(1, (performance.now() - chargeT0) / 1000)); chargeT0 = 0; },
});
function pause() { paused = true; showPanel('mainPanel'); $('overlay').classList.add('paused'); $('overlay').classList.remove('hidden'); $('startBtn').textContent = 'Resume'; if (document.pointerLockElement) document.exitPointerLock(); }
function resume() {
  sfx.init(); started = true; paused = false; $('overlay').classList.add('hidden');
  if (!controls.touch) renderer.domElement.requestPointerLock?.();
  if (!resume.once) { resume.once = 1; toast(LEVEL.intro, 4500);
    let seen = false; try { seen = localStorage.getItem('ek-tip'); localStorage.setItem('ek-tip', '1'); } catch {}
    if (!seen) setTimeout(() => toast(controls.touch ? '<b>Tip:</b> hold KICK and release. Look up to chip it.' : '<b>Tip:</b> hold the mouse button and release to kick. Look up to chip it.', 4000), 4800); }
}
$('startBtn').addEventListener('click', resume);
function showPanel(id) { for (const p of ['mainPanel', 'lockerPanel', 'settingsPanel', 'helpPanel']) $(p).classList.toggle('hidden', p !== id); }
$('lockerBtn').addEventListener('click', () => showPanel('lockerPanel'));
$('settingsBtn').addEventListener('click', () => showPanel('settingsPanel'));
$('helpBtn').addEventListener('click', () => showPanel('helpPanel'));
document.querySelectorAll('#overlay .back').forEach((b) => b.addEventListener('click', () => showPanel('mainPanel')));
$('restartBtn').addEventListener('click', () => { restart(); resume(); });

// ---------- gameplay ----------
const tmpV = new THREE.Vector3();
function forwardFlat() { return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); }
const rayRes = new CANNON.RaycastResult(), rayTo = new CANNON.Vec3();
function grounded() {
  rayRes.reset(); rayTo.set(player.position.x, player.position.y - 0.47, player.position.z);
  world.raycastClosest(player.position, rayTo, { collisionFilterMask: G_STATIC, skipBackfaces: true }, rayRes);
  return rayRes.hasHit;
}
function jump() { if (!paused && grounded()) player.velocity.y = 5.2; }
function nearestBall() {
  let best = null, bd = 1e9;
  for (const b of balls) { const d = b.body.position.distanceTo(player.position); if (d < bd) { bd = d; best = b; } }
  return best;
}
// BALL recall: moves an existing ball (never spawns). Picks the ball you last kicked (the one you're
// playing with), falling back to the nearest; the placed spare balls stay where they are.
// The recalled ball is "trapped" at your feet: held still (kinematic, no gravity) so it can't roll
// downhill, until you kick it or walk more than TRAP_RELEASE m away.
const TRAP_DIST = 0.85, TRAP_RELEASE = 1.6;
let lastTouched = null;
function trap(b, x, y, z) {
  b.trapped = true; b.body.type = CANNON.Body.KINEMATIC; b.body.updateMassProperties();
  b.body.position.set(x, y, z); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.prevP.copy(b.body.position);
}
function release(b) {
  if (!b.trapped) return; b.trapped = false;
  b.body.type = CANNON.Body.DYNAMIC; b.body.updateMassProperties(); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.body.wakeUp();
  $('nearby').classList.remove('trap');
}
function seaReturnSpot() { // v2.9.3: a lost ball comes back a few metres in front of you (in view), never into the water
  const f = forwardFlat(), P = player.position;
  for (const [d, side] of [[3, 0], [2.2, 0], [1.4, 0], [2.2, 1], [2.2, -1], [-1.2, 0]]) { const x = P.x + f.x * d - f.z * side * 1.5, z = P.z + f.z * d + f.x * side * 1.5;
    if (LEVEL.surfaceAt?.(x, z) === 'water' || Math.abs(x) > BOUNDS.x - 1 || z < BOUNDS.zMin + 1 || z > BOUNDS.zMax - 1) continue;
    rayRes.reset(); const from = new CANNON.Vec3(x, P.y + 1, z); rayTo.set(x, P.y - 2, z); world.raycastClosest(from, rayTo, { collisionFilterMask: G_STATIC }, rayRes);
    if (rayRes.hasHit && rayRes.hitPointWorld.y > P.y - 1.2) return [x, rayRes.hitPointWorld.y + BALL_R + 0.02, z]; }
  return [P.x, P.y + 0.1, P.z]; }
// v2.9.3: splash + spray where a ball hits the sea (instanced droplets and two foam rings, ~1.3 s)
const SPL_N = 60, splDrops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 5, 4), new THREE.MeshBasicMaterial({ color: 0xf4fbff, fog: true }), SPL_N);
splDrops.frustumCulled = false; splDrops.count = 0; scene.add(splDrops);
const splRings = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; });
const splCol = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.8, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); splCol.visible = false; scene.add(splCol);
const spl = { t: 9, x: 0, y: 0, z: 0, d: [] }, splM = new THREE.Matrix4(), splV = new THREE.Vector3();
function splashFx(x, y, z) { spl.t = 0; spl.x = x; spl.y = y; spl.z = z; spl.d = Array.from({ length: SPL_N }, () => { const a = Math.random() * 6.283, r = 0.8 + Math.random() * 3.4; return { vx: Math.cos(a) * r, vz: Math.sin(a) * r, vy: 4.5 + Math.random() * 6, s: 0.6 + Math.random() * 1.2 }; }); }
function updateSplash(dt) { if (spl.t > 1.6) { splDrops.count = 0; splRings.forEach((m) => (m.visible = false)); splCol.visible = false; return; } spl.t += dt; const t = spl.t;
  let n = 0; for (const d of spl.d) { const yy = spl.y + d.vy * t - 4.9 * t * t; if (yy < spl.y - 0.2) continue; splV.set(spl.x + d.vx * t, yy, spl.z + d.vz * t); splM.makeScale(d.s, d.s, d.s).setPosition(splV); splDrops.setMatrixAt(n++, splM); }
  splDrops.count = n; splDrops.instanceMatrix.needsUpdate = true;
  splRings.forEach((m, i) => { const k = Math.max(0, t - i * 0.25); m.visible = k > 0; m.position.set(spl.x, spl.y + 0.03, spl.z); const r = 1 + k * 5; m.scale.set(r, r, r); m.material.opacity = Math.max(0, 0.85 - k * 0.65); });
  const h = Math.max(0.01, 4.2 * Math.sin(Math.min(1, t / 0.9) * Math.PI)); splCol.visible = t < 0.9; splCol.position.set(spl.x, spl.y + h / 2, spl.z); splCol.scale.set(1.6 + 2 * t, h, 1.6 + 2 * t); splCol.material.opacity = 0.75 * (1 - t / 0.9); }
function trapSpot() { // in front of your feet, sat snug on the ground (works on the ramp)
  const f = forwardFlat(), x = player.position.x + f.x * TRAP_DIST, z = player.position.z + f.z * TRAP_DIST;
  rayRes.reset(); const from = new CANNON.Vec3(x, player.position.y + 1, z); rayTo.set(x, player.position.y - 2, z);
  world.raycastClosest(from, rayTo, { collisionFilterMask: G_STATIC }, rayRes);
  return [x, rayRes.hasHit ? rayRes.hitPointWorld.y + BALL_R - 2e-6 : player.position.y + 0.2, z];
}
function fetchBall() {
  if (paused) return;
  const b = lastTouched || nearestBall();
  const [x, y, z] = trapSpot();
  release(b); trap(b, x, y, z); b.anchor = { x: player.position.x, z: player.position.z }; lastTouched = b;
  toast('Here\'s your ba\' - foot on it. Kick, or walk off to let it go.', 1600);
}
// BALL is a rescue, not a shortcut: free if stuck / out of reach / far; 10p for the wee boy otherwise; refused when it's right there
const BALL_FEE = 10, FREE_FETCHES = 3, NEAR_REFUSE = 4; let ballMsg = '', freeFetchesLeft = FREE_FETCHES;
function requestBall() {
  if (paused) return 'paused';
  const b = lastTouched || nearestBall(), p = b.body.position, d = Math.hypot(p.x - player.position.x, p.z - player.position.z);
  const stuck = d > 4 && simTime - (b.stillT ?? simTime) > 4, high = p.y - player.position.y > 2.2, out = Math.abs(p.x) > BOUNDS.x - 1 || p.z < BOUNDS.zMin + 1 || p.z > BOUNDS.zMax - 1 || p.y < -2;
  const rescue = d > 40 || stuck || high || out || inContainer(p);
  if (!rescue && d < NEAR_REFUSE) { ballMsg = 'near'; toast("<b>Go get it yersel!</b><br>It's right there, ya lazy article.", 1800); return ballMsg; }
  const freebie = !rescue && freeFetchesLeft > 0; if (freebie) freeFetchesLeft--;
  const free = rescue || freebie;
  if (!free && wallet.pence < BALL_FEE) { ballMsg = 'skint'; toast("<b>Ye're skint.</b><br>The wee boy wants 10p. Go an' fetch it yersel.", 2000); return ballMsg; }
  if (!free) { wallet.pence -= BALL_FEE; saveWallet(); updateWallet(true); }
  fetchBall();
  ballMsg = free ? 'free' : 'paid';
  toast(freebie ? `<b>Freebie!</b><br>The wee boy's feelin' generous. ${freeFetchesLeft ? freeFetchesLeft + ' mair free yins.' : "That's yer last free yin - 10p after this."}` : free ? "<b>Rescued!</b><br>A wee boy got it back for nothin'. Lucky." : `<b>-${fmt(BALL_FEE)}</b><br>Paid a wee boy tae fetch it. "Pleasure doin' business."`, 1800);
  return ballMsg;
}
// v1.8.1: forgiving reach measured from the feet. <=1.2 m: any angle (even behind); <=2.2 m: anywhere in the front 180 deg.
// The kick always goes along the camera's flat forward, so a ball off to the side still goes where you look.
const KICK_REACH = 3.0, KICK_ANY = 1.4; // v1.8.2: front reach 3 m (what a portrait screen shows as 'at your feet')
function kickTarget(f = forwardFlat()) {
  let target = null, bestScore = -Infinity;
  for (const b of balls) {
    const p = b.body.position, dx = p.x - player.position.x, dz = p.z - player.position.z, dy = p.y - player.position.y;
    const dist = Math.hypot(dx, dz);
    if (dist > KICK_REACH || dy > 1.5 || dy < -1.5) continue;
    const dot = dist > 0.01 ? (dx * f.x + dz * f.z) / dist : 1;
    if (dot < 0 && dist > KICK_ANY) continue;
    const s = dot * 0.5 - dist; if (s > bestScore) { bestScore = s; target = b; }
  }
  return target;
}
// kick-range ring + off-screen arrow
const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8ff3a, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
const kickRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 40), ringMat); kickRing.rotation.x = -Math.PI / 2; kickRing.renderOrder = 2; scene.add(kickRing);
const ringV = new THREE.Vector3(); let inReach = false;
function updateBallAids(t) {
  const kt = kickTarget(), b = kt || lastTouched || nearestBall(); if (!b) return; // ring follows the kickable ball first
  const p = b.mesh.position, d = Math.hypot(p.x - player.position.x, p.z - player.position.z);
  const reach = !!kt;
  kickRing.position.set(p.x, p.y - BALL_R + 0.03, p.z);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.008);
  ringMat.color.setHex(reach ? 0xc8ff3a : 0xffffff);
  ringMat.opacity = reach ? 0.85 + 0.15 * pulse : 0; kickRing.visible = reach; // unlit = hidden (the old faint white read as a dark shadow)
  kickRing.scale.setScalar(reach ? 1.1 + 0.15 * pulse : 0.8);
  if (reach !== inReach) { inReach = reach; $('btnKick').classList.toggle('inreach', reach); }
  ringV.copy(p).project(camera);
  const behind = ringV.z > 1, onScreen = !behind && Math.abs(ringV.x) < 0.95 && Math.abs(ringV.y) < 0.95;
  const arr = $('ballArrow');
  if (onScreen || reach || d < 1.5 || !started || paused) { arr.style.display = 'none'; return; }
  let x = ringV.x, y = ringV.y; if (behind) { x = -x; y = -Math.abs(y) - 0.5; }
  const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x /= m; y /= m;
  const ang = Math.atan2(-y, x), W = innerWidth, H = innerHeight;
  arr.style.display = 'block';
  arr.style.left = `${(0.5 + x * 0.44) * W}px`; arr.style.top = `${(0.5 - y * 0.40) * H}px`;
  arr.firstElementChild.style.transform = `rotate(${ang}rad)`;
  arr.lastElementChild.textContent = `${Math.round(d)} m`;
}
let lastKickInfo = null;
function kick(power) {
  kickAnim = 0;
  const f = forwardFlat();
  const target = kickTarget(f);
  if (target) { release(target); lastTouched = target; } // a trapped ball kicks exactly like a resting one
  if (!target) { sfx.whiff(); lastKickInfo = { power, hit: false }; return false; }
  const elev = THREE.MathUtils.clamp(pitch + 0.3, 0.03, 1.05);
  const speed = 4 + power * 19;
  const v = target.body.velocity;
  v.set(f.x * Math.cos(elev) * speed, Math.sin(elev) * speed, f.z * Math.cos(elev) * speed);
  const w = (speed * Math.cos(elev) / BALL_R) * 0.2; // topspin roughly matching roll
  target.body.angularVelocity.set(f.z * w, (Math.random() - 0.5) * 3, -f.x * w);
  target.lastKick = performance.now(); target.kickSim = simTime; target.bounces = 0; target.kickFrom = { x: player.position.x, z: player.position.z };
  lastKickInfo = { power, hit: true, speed };
  sfx.kick(power);
  return true;
}
function onBallCollide(b, e) {
  const iv = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const now = performance.now();
  { const ob = e.body, tg = ob.userData?.target, ground = ob.shapes[0]?.type === CANNON.Shape.types.PLANE, bp = b.body.position;
    // v2.4: surface-aware impacts; per-ball cooldown, and rolling on the ground (low impact) stays silent
    if (iv > (ground ? 1.8 : 1.2) && now - b.lastSound > 90) { b.lastSound = now;
      const surf = ob.userData?.surface || (ground ? surfaceAt(bp.x, bp.z) : TARGET_SURF[tg] || 'wall');
      sfx.bounce(iv, iv > 6, surf, bp.x, bp.z); } }
  const id = e.body.userData?.target;
  const clean = (b.bounces | 0) === 0;
  if (iv > 0.8 && simTime - (b.kickSim ?? -1) > 0.05) b.bounces = (b.bounces | 0) + 1; // for the "clean in" bonus
  if (!id) return;
  const t = targetById[id];
  if (t.kind === 'topple') { t.touched = now; return; }
  if (iv > 1.5 && now - b.lastKick < 8000) { if (id === 'lamp' || id === 'tardis') sfx.clang();
    // accuracy bonus: struck near the target's centre, first time (no bounce on the way)
    const p = b.body.position, bull = t.aim && Math.hypot(p.x - t.aim.x, p.y - t.aim.y, p.z - t.aim.z) < 0.55 && clean;
    scoreTarget(t, bull ? 'Bullseye' : null); }
}
let lastRepeat = 0;
function scoreTarget(t, bonus = null) {
  const now = performance.now();
  if (t.done) { if (now - lastRepeat > 2500) { lastRepeat = now; toast(`Already bagged the ${t.name}.`, 1200); } return; }
  const rec = recordDone(LEVEL.id, t, allTargets); announce(rec.news);
  if (t.challenge) return scoreChallenge(t, rec.first);
  if (!rec.first) { // already paid for this one (e.g. after Restart level): no double pay
    t.done = true; t.ring.material.color.set(DONE_RING); lastEarn = { id: t.id, pence: 0, bonus: null };
    toast(`<b>${t.name}</b> - already bagged.<br><small>Ye got paid for that one already.</small>`, 1800); sfx.success(false); updateHud(); return; }
  t.done = true; score += t.points;
  const pence = cashFor(t) + (bonus ? BONUS : 0);
  lastEarn = { id: t.id, pence, bonus };
  const reached = earn(pence, chippyEarned()); updateWallet(true);
  if (reached) setTimeout(showGoal, 1800);
  t.ring.material.color.set(DONE_RING);
  const all = targets.every((x) => x.done);
  sfx.success(all);
  const line = t.lines[Math.floor(Math.random() * t.lines.length)];
  toast(`<b>${t.name} +${fmt(pence)}</b>${bonus ? ` <small>(${bonus}! +${fmt(BONUS)})</small>` : ''}<br>${line}`);
  if (all) setTimeout(() => toast(`<b>Pure dead brilliant!</b><br>All ${targets.length} targets done in ${LEVEL.name}.<br><small>Pause to restart, or travel to ${LEVELS[LEVEL.next].name}.</small>`, 7000), 2600);
  updateHud();
}
function announce(news) { // each unlock fires once ever: short sound + toast
  if (!news.length) return; lastUnlock = news;
  setTimeout(() => { sfx.success(true); toast(`<b>Unlocked!</b><br>${news.map((n) => n.text).join('<br>')}`, 4000); buildBallMenu(); }, 2300);
}
function scoreChallenge(t, first) {
  t.done = true; t.ring.material.color.set(DONE_RING);
  const line = t.lines[Math.floor(Math.random() * t.lines.length)];
  if (!first) { toast(`<b>${t.name}</b> - again!<br>${line}`, 2400); sfx.success(false); return; }
  const pence = t.cash || 0; if (pence) { const reached = earn(pence, chippyEarned()); updateWallet(true); if (reached) setTimeout(showGoal, 4500); }
  lastEarn = { id: t.id, pence, bonus: null };
  toast(`<b>AWAY YE GO! ${t.name}</b>${pence ? ' +' + fmt(pence) : ''}<br>${line}`, 3500); sfx.success(true);
  updateHud();
}
let lastUnlock = null;
function restart() {
  score = 0;
  for (const t of allTargets) { t.done = false; t.touched = 0; t.ring.material.color.set(0xffd93d); }
  lastTouched = null;
  for (const b of balls) { release(b); b.body.position.copy(b.home); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.lastKick = -1e9; b.prevP.copy(b.home); }
  for (const d of dynamics) { d.body.position.copy(d.home); d.body.quaternion.set(0, 0, 0, 1); d.body.velocity.setZero(); d.body.angularVelocity.setZero(); }
  player.position.copy(PLAYER_SPAWN); player.velocity.setZero(); yaw = SPAWN_YAW; pitch = -0.25; prevPlayer.copy(player.position);
  updateHud();
}

function checkZones(now) {
  for (const t of allTargets) {
    if (t.done && (t.kind !== 'zone' || t.challenge)) continue;
    if (t.kind === 'zone') {
      for (const b of balls) {
        const p = b.body.position; tmpV.set(p.x, p.y, p.z).applyMatrix4(t.zoneInv);
        // open-topped bins/skips: also count a ball whose centre is over the opening and just below the rim
        // (plus a small lip allowance) and not rising - it has dropped in, even if it then bounces on the floor.
        const z = t.zone, inside = z.containsPoint(tmpV) || (t.openTop && tmpV.x > z.min.x && tmpV.x < z.max.x && tmpV.z > z.min.z && tmpV.z < z.max.z && tmpV.y > z.min.y && tmpV.y < z.max.y + 0.12 && b.body.velocity.y < 1.5);
        if (!inside || now - b.lastKick > 8000) continue;
        if (t.minRange && (!b.kickFrom || Math.hypot(b.kickFrom.x - t.rangeFrom.x, b.kickFrom.z - t.rangeFrom.z) < t.minRange)) continue;
        const sp = b.body.velocity.length();
        if (t.minSpeed && sp < t.minSpeed) continue;
        if (t.maxSpeed && sp > t.maxSpeed) continue;
        if (t.done) { if (b.bagged === b.lastKick) continue; b.bagged = b.lastKick; }
        scoreTarget(t, (b.bounces | 0) === 0 ? 'Clean in' : null);
      }
    } else if (t.kind === 'topple') {
      const up = t.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
      const moved = Math.hypot(t.body.position.x - t.pos.x, t.body.position.z - t.pos.z);
      if ((up.y < 0.5 || moved > 0.6) && now - (t.touched || -1e9) < 5000) scoreTarget(t);
    }
  }
}

// ---------- fixed-timestep simulation (independent of frame rate) ----------
const FIXED = 1 / 120, MAX_STEPS = 15; // 120 Hz: a 20 m/s ball must not sink into kerbs
let simTime = 0, acc = 0, autopilot = null, respawns = 0, seaLost = 0, lastSeaReturn = null;
const prevPlayer = new THREE.Vector3().copy(player.position);
let moveInput = { x: 0, y: 0, run: false };
function fixedUpdate(h) {
  for (const b of balls) { const q = b.body.position; if (!b.stillP || Math.hypot(q.x - b.stillP.x, q.y - b.stillP.y, q.z - b.stillP.z) > 0.3) { b.stillP = { x: q.x, y: q.y, z: q.z }; b.stillT = simTime; } }

  simTime += h;
  const now = performance.now();
  for (const b of balls) { b.prevP.copy(b.body.position); b.prevQ.copy(b.body.quaternion); }
  prevPlayer.copy(player.position);
  let m = moveInput;
  if (autopilot) { // test hook: walk towards a waypoint using the normal movement code
    const w = autopilot.points[0], dx = w.x - player.position.x, dz = w.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { autopilot.points.shift(); if (!autopilot.points.length) { autopilot.done = true; autopilot = null; } }
    else yaw = Math.atan2(-dx, -dz);
    m = { x: 0, y: autopilot ? 1 : 0, run: true };
  }
  const f = forwardFlat(), r = new THREE.Vector3(-f.z, 0, f.x);
  const wish = f.multiplyScalar(m.y).add(r.multiplyScalar(m.x));
  if (wish.lengthSq() > 1) wish.normalize();
  const speed = m.run ? 7.2 : 4.2, onGround = grounded(), k = Math.min(1, h * (onGround ? 12 : 2.5));
  if (onGround && wish.lengthSq() > 0) { stepDist += Math.hypot(player.velocity.x, player.velocity.z) * h; if (stepDist > stepLen) { stepDist = 0; stepLen = (m.run ? 1.55 : 1.25) * (0.93 + Math.random() * 0.14); sfx.step(surfaceAt(player.position.x, player.position.z), m.run); } } // v2.4 surface-aware footsteps
  player.velocity.x += (wish.x * speed - player.velocity.x) * k;
  player.velocity.z += (wish.z * speed - player.velocity.z) * k;
  if (onGround && player.velocity.y > 0 && player.velocity.y < 2 && wish.lengthSq() > 0) player.velocity.y = Math.min(player.velocity.y, 1.5);
  // Idle on the ground: the player sphere is frictionless (so it slides along walls), so on the ramp gravity
  // used to slide it downhill (~0.15 m/s) with no input. Hold it still: zero velocity and cancel gravity.
  if (onGround && wish.lengthSq() === 0 && player.velocity.y < 0.5) { player.velocity.set(0, 0, 0); player.force.y += player.mass * -world.gravity.y; }
  for (const b of balls) if (b.trapped) {
    b.body.velocity.setZero(); b.body.angularVelocity.setZero();
    // foot on it: the ball stays in front of you as you turn; walk off (from where you trapped it) to let it go
    if (!b.anchor || Math.hypot(b.anchor.x - player.position.x, b.anchor.z - player.position.z) > TRAP_RELEASE - TRAP_DIST) release(b);
    else { const [x, y, z] = trapSpot(); b.body.position.set(x, y, z); }
  }
  world.step(h);
  for (const b of balls) { // rolling resistance on the ground
    const p = b.body.position; rayRes.reset(); rayTo.set(p.x, p.y - BALL_R - 0.06, p.z);
    world.raycastClosest(p, rayTo, { collisionFilterMask: G_STATIC }, rayRes);
    if (rayRes.hasHit) { const d = 1 - 0.9 * h; b.body.velocity.x *= d; b.body.velocity.z *= d; }
    if (LEVEL.sea && p.y < LEVEL.sea.y) { // v2.9: lost to the sea (Granton) -> splash, and the ball is back at its spot
      sfx.splash?.(p.x, p.z); seaLost++; splashFx(p.x, LEVEL.sea.water ?? LEVEL.sea.y + 0.4, p.z); release?.(b);
      const [rx, ry, rz] = seaReturnSpot(); p.set(rx, ry, rz); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.prevP.copy(p); lastSeaReturn = { x: rx, y: ry, z: rz, t: simTime };
      toast(`<span class="splash-msg">🌊 SPLASH!</span><br>${LEVEL.sea.lines[seaLost % LEVEL.sea.lines.length]}<br><small>Ball's back at your feet.</small>`, 3400); continue; }
    if (p.y < -3 || Math.abs(p.x) > BOUNDS.x + 15 || p.z < BOUNDS.zMin - 10 || p.z > BOUNDS.zMax + 10) { p.copy(b.home); b.body.velocity.setZero(); b.prevP.copy(b.home); toast('Ball lost ower the wall - it\'s back where you found it.', 1800); }
  }
  { const p = player.position; // v2.5: never lose the player - below ground or outside the level bounds -> back to the spawn
    if (p.y < -3 || Math.abs(p.x) > BOUNDS.x + 2 || p.z < BOUNDS.zMin - 2 || p.z > BOUNDS.zMax + 2) { p.copy(PLAYER_SPAWN); player.velocity.setZero(); prevPlayer.copy(p); yaw = SPAWN_YAW; respawns++; } }
  checkZones(now);
  checkCounter();
}
function advance(dt) { // frame -> fixed steps
  const [lx, ly] = controls.consumeLook();
  yaw -= lx * 0.0024; pitch = THREE.MathUtils.clamp(pitch - ly * 0.0024, -1.31, 1.31);
  moveInput = controls.getMove();
  acc += Math.min(dt, 0.25);
  let n = 0;
  while (acc >= FIXED && n < MAX_STEPS) { fixedUpdate(FIXED); acc -= FIXED; n++; }
  if (n === MAX_STEPS) acc = 0; // device too slow: drop time rather than spiral
}

// ---------- render ----------
const pigM = new THREE.Matrix4(), pigQ = new THREE.Quaternion(), pigS = new THREE.Vector3(1, 0.8, 1.4), pigH = new THREE.Vector3(), ZERO = new THREE.Vector3(0, 0, 0), UPY = new THREE.Vector3(0, 1, 0);
const iP = new THREE.Vector3(), iQ = new THREE.Quaternion();
const wings = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.012, 0.11), pigeons.body.material, pigeons.list.length * 2); wings.frustumCulled = false; scene.add(wings);
const wingE = new THREE.Euler(), wingQ = new THREE.Quaternion(), wingP = new THREE.Vector3(), wingOff = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
function render(dt, t) {
  const alpha = paused ? 1 : acc / FIXED; updateSplash(Math.min(0.05, dt));
  iP.lerpVectors(prevPlayer, player.position, alpha);
  const sp = Math.hypot(player.velocity.x, player.velocity.z);
  const bob = Math.sin(t * 0.011) * Math.min(1, sp / 4) * 0.04;
  camera.position.set(iP.x, iP.y + 1.25 + bob, iP.z);
  camera.rotation.set(pitch, yaw, 0); sfx.listen(iP.x, iP.z, yaw);
  for (const b of balls) { b.mesh.position.lerpVectors(b.prevP, b.body.position, alpha); iQ.copy(b.body.quaternion); b.mesh.quaternion.slerpQuaternions(b.prevQ, iQ, alpha); }
  for (const d of dynamics) { d.mesh.position.copy(d.body.position); d.mesh.quaternion.copy(d.body.quaternion); }
  kickAnim = Math.min(1, kickAnim + dt * 4);
  const s = Math.sin(kickAnim * Math.PI);
  boot.position.set(0.18, -1.05 + s * 0.35, -0.35 - s * 0.5); boot.rotation.x = -s * 1.1;
  const rest = kickAnim >= 1 && pitch < -0.6; // resting foot: tucked into view when you look down
  if (rest) { boot.position.set(0.2, -0.5, -0.72); boot.rotation.x = 0.35; }
  boot.visible = kickAnim < 1 || pitch < -0.6;
  if (chargeT0) $('powerFill').style.width = `${Math.min(1, (performance.now() - chargeT0) / 1000) * 100}%`;
  let near = null, nd = 1e9;
  for (const tg of allTargets) {
    const d = Math.hypot(tg.pos.x - iP.x, tg.pos.z - iP.z);
    if (tg.challenge) { // hidden: ring only when you're right there
      const o = tg.done ? 0 : THREE.MathUtils.clamp((6 - d) / 3, 0, 0.6) * (0.6 + 0.4 * Math.sin(t * 0.008));
      tg.ring.material.opacity = o; tg.ring.visible = o > 0.01; if (!tg.done && d < 6 && d < nd) { nd = d; near = tg; } continue;
    }
    const o = tg.done ? THREE.MathUtils.clamp((40 - d) / 10, 0, 0.9) : THREE.MathUtils.clamp((16 - d) / 8, 0, 0.85) * (0.75 + 0.25 * Math.sin(t * 0.005));
    tg.ring.material.opacity = o; tg.ring.visible = o > 0.01;
    if (!tg.done && d < 14 && d < nd) { nd = d; near = tg; }
  }
  $('nearby').textContent = near ? (near.challenge ? `${near.name} - ${near.hint}` : `Nearby: ${near.name} - ${near.hint} (${fmt(cashFor(near))})`) : '';
  if (built.sparkles) { const left = challenges.some((c) => !levelDone(LEVEL.id)[c.id]); built.sparkles.visible = left; built.sparkles.material.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.004)); }
  pigeons.list.forEach((pg, i) => {
    if (pg.state === 'idle') {
      pg.t -= dt; if (pg.t < 0) { pg.t = 1 + Math.random() * 3; pg.rot += (Math.random() - 0.5) * 2; }
      const scare = (x, z) => Math.hypot(x - pg.pos.x, z - pg.pos.z) < 2.4;
      if (scare(iP.x, iP.z) || balls.some((b) => scare(b.body.position.x, b.body.position.z))) {
        pg.state = 'fly'; pg.t = 4; { let ax = pg.pos.x - iP.x, az = pg.pos.z - iP.z; const l = Math.hypot(ax, az) || 1; const sp = 4.5 + Math.random() * 2, tw = (Math.random() - 0.5) * 0.8; // v2.3: fly away at a climb, not straight up
          ax /= l; az /= l; const cx = ax * Math.cos(tw) - az * Math.sin(tw), cz = ax * Math.sin(tw) + az * Math.cos(tw); pg.vel.set(cx * sp, 2.2 + Math.random(), cz * sp); pg.rot = Math.atan2(-cx, -cz); }
        sfx.flutter(pg.pos.x, pg.pos.z); if (Math.random() < 0.3) sfx.coo(pg.pos.x, pg.pos.z);
      }
    } else if (pg.state === 'fly') {
      pg.pos.addScaledVector(pg.vel, dt); pg.vel.y += dt * 0.5; pg.t -= dt;
      if (pg.t < 0) { pg.state = 'gone'; pg.t = 15; }
    } else { pg.t -= dt; if (pg.t < 0 && Math.hypot(iP.x - pg.home.x, iP.z - pg.home.z) > 10) { pg.state = 'idle'; pg.pos.copy(pg.home); } }
    const vis = pg.state !== 'gone';
    pigQ.setFromAxisAngle(UPY, pg.rot);
    pigM.compose(pg.pos, pigQ, vis ? pigS : ZERO); pigeons.body.setMatrixAt(i, pigM);
    pigH.set(-Math.sin(pg.rot) * 0.1, 0.08, -Math.cos(pg.rot) * 0.1).add(pg.pos);
    pigM.compose(pigH, pigQ, vis ? pigS.set(1, 1, 1) : ZERO); pigeons.head.setMatrixAt(i, pigM); pigS.set(1, 0.8, 1.4);
    // v2.3 wings: folded at rest, flapping in flight
    const flap = pg.state === 'fly' ? Math.sin(t * 0.045 + i) * 0.9 : 0.05;
    for (const sd of [-1, 1]) { wingE.set(0, pg.rot, sd * (pg.state === 'fly' ? flap : 1.35), 'YXZ'); wingQ.setFromEuler(wingE);
      wingP.set(Math.cos(pg.rot) * sd * 0.08, 0.04, -Math.sin(pg.rot) * sd * 0.08).add(pg.pos); wingOff.set(sd * 0.09, 0, 0).applyQuaternion(wingQ); wingP.add(wingOff);
      pigM.compose(wingP, wingQ, vis ? ONE : ZERO); wings.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), pigM); }
  });
  pigeons.body.instanceMatrix.needsUpdate = pigeons.head.instanceMatrix.needsUpdate = wings.instanceMatrix.needsUpdate = true;
  if (P.shadows) { // follow the player, snapped to shadow texels to avoid shimmer
    const snap = 64 / 2048, sx = Math.round(iP.x / snap) * snap, sz = Math.round(iP.z / snap) * snap;
    sun.position.set(sx + SUN_OFF.x, SUN_OFF.y, sz + SUN_OFF.z); sun.target.position.set(sx, 0, sz);
  } else sun.position.copy(SUN_OFF);
  updateBallAids(t);
  renderer.render(scene, camera);
}

// ---------- perf overlay + dynamic resolution ----------
const frameTimes = []; let lastPerfUpdate = 0, lastDynCheck = 0, goodSince = 0;
function perfTick(now, frameMs) {
  frameTimes.push(frameMs); if (frameTimes.length > 120) frameTimes.shift();
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  if (dynResOn && now - lastDynCheck > 1000 && frameTimes.length >= 30) {
    lastDynCheck = now; const old = resScale;
    if (avg > 22) { resScale = Math.max(P.minScale, resScale - 0.1); goodSince = now; }
    else if (avg < 14) { if (now - goodSince > 3000) resScale = Math.min(1, resScale + 0.05); }
    else goodSince = now;
    if (resScale !== old) renderer.setPixelRatio(basePixelRatio * resScale);
  }
  if (perfOn && now - lastPerfUpdate > 250) {
    lastPerfUpdate = now; const i = renderer.info, c = renderer.domElement;
    $('perf').textContent = `${(1000 / avg).toFixed(0)} fps  ${avg.toFixed(1)} ms  [${P.name}${dynResOn ? ' dynres' : ''}]\n` +
      `draws ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(1)}k  tex ${i.memory.textures} (~${(texStats.bytes / 1048576).toFixed(0)} MB)  geo ${i.memory.geometries}  prog ${i.programs.length}\n` +
      `res ${c.width}x${c.height} (x${(basePixelRatio * resScale).toFixed(2)})  shadows ${P.shadows ? 'on' : 'off'}`;
  }
}

let last = performance.now();
function loop(t) {
  const dt = Math.max(0, (t - last) / 1000); last = t;
  if (!paused) advance(dt);
  render(Math.min(dt, 0.1), t);
  perfTick(t, dt * 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Test/debug hooks (used by scripts/verify.mjs and scripts/profile.mjs).
window.__game = {
  get score() { return score; }, get assetsLoaded() { return assetsLoaded; }, get simTime() { return simTime; }, get resScale() { return resScale; },
  get yaw() { return yaw; }, get pitch() { return pitch; }, get lastKick() { return lastKickInfo; }, get textureMemoryMB() { return +(texStats.bytes / 1048576).toFixed(1); },
  preset: P.name, presetSource: PRESET_SOURCE, views, FIXED, level: LEVEL.id, levelName: LEVEL.name, levels: LEVEL_ORDER, travelTo, counter: built.counter || null,
  get wallet() { return { ...wallet }; }, challenges, get unlocks() { return JSON.parse(JSON.stringify(unlocks)); }, get lastUnlock() { return lastUnlock; }, applyBall, applyBoots, get bootTris() { return boot.geometry.attributes.position.count / 3; }, requestBall, get ballMsg() { return ballMsg; }, buyItem, resetProgress() { resetProgress(); buildBallMenu(); updateHud(); }, get ballMap() { return ballMat.map; }, openCounter, get lastEarn() { return lastEarn; }, resetWallet() { resetWallet(); updateWallet(); }, GOAL, scoreTarget,
  waitSim(sec) { const t0 = simTime; return new Promise((res) => { const f = () => (simTime - t0 >= sec ? res() : setTimeout(f, 30)); f(); }); }, targets, balls, player,
  pause, showPanel,
  start: () => { started = true; paused = false; $('overlay').classList.add('hidden'); },
  teleport(x, z, yawDeg, pitchDeg = -15, y) { player.position.set(x, y ?? player.position.y, z); player.velocity.setZero(); prevPlayer.copy(player.position); yaw = yawDeg * Math.PI / 180; pitch = pitchDeg * Math.PI / 180; },
  aim(yawRad, pitchRad) { yaw = yawRad; pitch = pitchRad; },
  placeBall(i, x, y, z) { const b = balls[i]; release(b); b.body.position.set(x, y, z); b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.prevP.set(x, y, z); },
  sfx, surfaceAt, get respawns() { return respawns; }, get seaLost() { return seaLost; }, get lastSeaReturn() { return lastSeaReturn; }, get splashT() { return spl.t; }, camera, spawn: PLAYER_SPAWN, kick, restart, fetchBall, get inReach() { return inReach; }, get freeFetchesLeft() { return freeFetchesLeft; }, get lastTouched() { return balls.indexOf(lastTouched); }, get trapped() { return balls.map((b) => !!b.trapped); }, get moveInput() { return moveInput; }, world, renderer, scene, camera,
  setDynRes(on) { dynResOn = on; if (!on) { resScale = 1; renderer.setPixelRatio(basePixelRatio); } },
  simulate(sec) { for (let i = 0; i < Math.round(sec / FIXED); i++) fixedUpdate(FIXED); },
  advance, // frame-path stepping (accumulator) for timestep-consistency tests
  walk(points) { autopilot = { points: points.map(([x, z]) => ({ x, z })), done: false }; return autopilot; },
  get autopilotActive() { return !!autopilot; },
};
// v1.8.2: cache-bust. Pages serves index.html with max-age=600; if a newer build is live, reload once.
const BUILD = 'v2.9.3';
addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); }); // v2.5: a back/forward-cache restore must rebuild the level fresh
fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((j) => {
  if (j.v && j.v !== BUILD && sessionStorage.getItem('reloadedFor') !== j.v) { sessionStorage.setItem('reloadedFor', j.v); location.reload(); }
}).catch(() => {});
