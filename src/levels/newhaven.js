// Level 4: Newhaven (v3.0). The old fishing village on the Forth: Main Street fishermen's cottages with outside stone
// forestairs and red pantile roofs, the wee harbour with its west pier and white lighthouse, the Victorian fishmarket and
// the black iron quay railings - squeezed into one compact, playable harbour corner.
// North = +z = the Forth. Land and quays are at y = 0; harbour water sits at y = -1.3. Balls kicked over the quay edge are
// lost to the sea (main.js: LEVEL.sea) and come straight back to your feet. NEW: the forestairs are solid stone steps, so
// they work as bounce ramps and chip targets (land it on a landing, or ping a first-floor door).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, limewashTexture, slabTexture, pantileTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const NH = { QUAY: 12, WATER: -1.3, WPIER: [-30, -24, 32], EQUAY: [24, 40, 28], FRONT: -20 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1572), pick = (a) => a[Math.floor(rand() * a.length)];
  const B = new Batcher(), atlas = new SignAtlas(), facadeTex = facadeAtlas();
  const targets = [], dynamics = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {}, CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(x, y, z), q, V(sx, sy, sz)); };
  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, surface = null, playerOnly = false } = {}) {
    const b = new CANNON.Body({ mass: 0, material, shape }); b.position.set(x, y, z); eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
    if (playerOnly) { b.collisionFilterGroup = G_PWALL; b.collisionFilterMask = G_PLAYER; }
    if (target || surface) b.userData = { target, surface }; world.addBody(b); return b; }
  const boxBody = (x, y, z, w, h, d, o = {}) => body(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), x, y, z, o);
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, grime = 0, target = null, surface = null } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile, grime }); return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, surface }) : null; }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null, rx = 0, rz = 0 } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1, rx, 0, rz), color, {}); return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface, rx, rz }) : null; }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, grime = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, tile });
  const sign = (text, x, y, z, w, h, ry, bg, fg, font, border) => quad('atlas', x, y, z, w, h, ry, atlas.sign(text, bg, fg, w / h, font, border));
  const cellUV = (i) => { const c = i % 4, r = Math.floor(i / 4), e = 0.004; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; };
  const Q = NH.QUAY, WY = NH.WATER, [WX0, WX1, WZ1] = NH.WPIER, [EX0, EX1, EZ1] = NH.EQUAY, F = NH.FRONT, IRON = 0x1e2124, ACC = 0xB8405E;
  const HARL = [0xffffff, 0xfbfaf6, 0xffffff, 0xf8f8f4, 0xffffff, 0xfaf8f2]; // v3.0.1: lime-wash white (was cream)

  // ---------- land, quays, pier, water ----------
  boxBody(0, -2, (-30 + Q) / 2, 80, 4, Q + 30, { surface: 'paving' }); // the land
  boxBody((WX0 + WX1) / 2, -2, (Q + WZ1) / 2, WX1 - WX0, 4, WZ1 - Q, { surface: 'concrete' }); // west pier
  boxBody((EX0 + EX1) / 2, -2, (Q + EZ1) / 2, EX1 - EX0, 4, EZ1 - Q, { surface: 'concrete' }); // east quay
  B.add('flat', QUAD, M4(0, WY, 110, 400, 200, 1, -Math.PI / 2), 0x55697a, {}); // harbour + Forth
  for (let i = 0; i < 50; i++) { const x = -60 + rand() * 120, z = Q + 2 + rand() * 100, w = 2 + rand() * 5; B.add('flat', QUAD, M4(x, WY + 0.01, z, w, 0.12, 1, -Math.PI / 2, rand() * 0.3), 0x8a9aa8, {}); }
  B.add('slab', QUAD, M4(0, 0.004, (F + 2 + Q) / 2 + 3, 80, Q - F - 8, 1, -Math.PI / 2), 0xffffff, { tile: 1.8 }); // quayside flags
  B.add('cobble', QUAD, M4(0, 0.006, F + 6, 80, 12, 1, -Math.PI / 2), 0xb0aca4, { tile: 1.5 }); // Main Street setts
  B.add('slab', QUAD, M4(0, 0.008, F + 0.9, 80, 1.8, 1, -Math.PI / 2), 0xd8d6d0, { tile: 1.8 }); // pavement in front of the cottages
  for (const [x0, x1, z1] of [[WX0, WX1, WZ1], [EX0, EX1, EZ1]]) B.add('slab', QUAD, M4((x0 + x1) / 2, 0.006, (Q + z1) / 2, x1 - x0, z1 - Q, 1, -Math.PI / 2), 0xe2e0dc, { tile: 2.4 });
  // quay walls (rubble stone down to the water) + granite cope
  const wallRun = (x0, x1, z0, z1) => { const w = Math.abs(x1 - x0) || 0.6, d = Math.abs(z1 - z0) || 0.6; solid('stone', (x0 + x1) / 2, WY / 2 - 0.4, (z0 + z1) / 2, w, -WY + 0.8, d, 0x8f8b82, { phys: false, tile: 1.5 }); solid('stone', (x0 + x1) / 2, 0.05, (z0 + z1) / 2, w + 0.1, 0.1, d + 0.1, 0xc4c0b8, { phys: false }); };
  wallRun(WX1, EX0, Q + 0.3, Q + 0.3); wallRun(-40, WX0, Q + 0.3, Q + 0.3); wallRun(EX1, 44, Q + 0.3, Q + 0.3);
  wallRun(WX0 - 0.3, WX0 - 0.3, Q, WZ1); wallRun(WX1 + 0.3, WX1 + 0.3, Q, WZ1); wallRun(WX0, WX1, WZ1 + 0.3, WZ1 + 0.3);
  wallRun(EX0 - 0.3, EX0 - 0.3, Q, EZ1); wallRun(EX0, EX1, EZ1 + 0.3, EZ1 + 0.3);
  // player-only edge walls (the ball still goes in the water)
  for (const [x, z, w, d] of [[(WX1 + EX0) / 2, Q + 0.35, EX0 - WX1, 0.3], [(-40 + WX0) / 2, Q + 0.35, WX0 + 40, 0.3], [WX0 - 0.35, (Q + WZ1) / 2, 0.3, WZ1 - Q], [WX1 + 0.35, (Q + WZ1) / 2, 0.3, WZ1 - Q], [(WX0 + WX1) / 2, WZ1 + 0.35, WX1 - WX0, 0.3], [EX0 - 0.35, (Q + EZ1) / 2, 0.3, EZ1 - Q], [(EX0 + EX1) / 2, EZ1 + 0.35, EX1 - EX0, 0.3]]) boxBody(x, 1.5, z, w, 3, d, { playerOnly: true });
  for (const [x, z, w, d] of [[0, -29, 90, 1], [40.5, 0, 1, 60], [-40.5, 0, 1, 60]]) boxBody(x, 4, z, w, 8, d); // land boundary
  // black iron quay railings (visual; the player is held by the walls above, balls fly over them)
  const railing = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i <= n; i++) { const t = i / n; cyl('metal', x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t, 0.035, 0.035, 1.1, IRON, { phys: false, seg: 5 }); }
    for (const y of [0.5, 1.08]) solid('metal', (x0 + x1) / 2, y, (z0 + z1) / 2, L, 0.05, 0.05, IRON, { phys: false, ry }); };
  for (const [a, b] of [[[WX1 + 1, Q - 0.2], [-14, Q - 0.2]], [[-10, Q - 0.2], [EX0 - 0.2, Q - 0.2]], [[WX0 + 0.2, Q], [WX0 + 0.2, WZ1 - 0.2]], [[WX1 - 0.2, Q + 1], [WX1 - 0.2, WZ1 - 0.2]], [[EX0 + 0.2, Q + 1], [EX0 + 0.2, EZ1 - 0.2]]]) railing(a[0], a[1], b[0], b[1]);

  // ---------- Main Street: fishermen's cottages, harled, red pantiles, outside stone forestairs ----------
  const cottages = [[-38, -30], [-30, -22], [-22, -14], [-14, -6], [-6, 2], [2, 10]];
  const stairs = [];
  cottages.forEach(([x0, x1], ci) => { const xc = (x0 + x1) / 2, w = x1 - x0, D = 7, h = 5.6, col = HARL[ci % HARL.length];
    solid('harl', xc, h / 2, F - D / 2, w, h, D, col, { tile: 2.4 });
    solid('stone', xc, 0.22, F + 0.04, w, 0.44, 0.1, 0x8a867e, { phys: false }); // painted base course
    B.add('pantile', ROOF, M4(xc, h, F - D / 2, D + 0.5, 3.0, w + 0.1, 0, Math.PI / 2), 0xffffff, { tile: 1.2 });
    solid('stone', xc, h + 0.06, F + 0.25, w + 0.1, 0.12, 0.2, 0xd8d2c6, { phys: false }); // skew / eaves
    if (ci === 0 || ci === cottages.length - 1) { const gx = ci === 0 ? x0 : x1; solid('harl', gx, h + 1.5, F - D / 2, 0.6, 3, D - 1, col, { phys: false }); } // crowstep-ish gable ends
    solid('harl', x1 - 0.3, h + 3.0, F - D / 2, 0.9, 1.6, 2.2, col, { phys: false }); for (const k of [-0.6, 0, 0.6]) cyl('flat', x1 - 0.3, h + 4.0, F - D / 2 + k, 0.12, 0.15, 0.45, 0xa65a3a, { phys: false, seg: 6 }); // chimney stacks + cans
    // forestair: rising westward along the front wall to a first-floor landing and door
    const xs = x1 - 0.6, N = ci === 1 || ci === 3 ? 7 : 9, rise = 0.31, tread = 0.3, deep = ci === 1 || ci === 3 ? 1.45 : 1.0, zc = F + deep / 2, lx1 = xs - N * tread, lx0 = lx1 - (ci === 1 || ci === 3 ? 1.9 : 1.3), LH = N * rise;
    for (let k = 0; k < N; k++) solid('stone', xs - (k + 0.5) * tread, (k + 1) * rise / 2, zc, tread, (k + 1) * rise, deep, 0xb9b4aa, { tile: 1.2, surface: 'setts' });
    solid('stone', (lx0 + lx1) / 2, LH / 2, zc, lx1 - lx0, LH, deep, 0xb9b4aa, { tile: 1.2, surface: 'setts' }); // landing on a solid stone base
    for (let k = 0; k < N; k++) cyl('metal', xs - (k + 0.5) * tread, (k + 1) * rise + 0.45, F + deep - 0.05, 0.02, 0.02, 0.9, IRON, { phys: false, seg: 4 });
    { const L = Math.hypot(N * tread, LH), ry = 0; solid('metal', xs - N * tread / 2, LH / 2 + 0.95, F + deep - 0.05, L, 0.05, 0.05, IRON, { phys: false, rz: -Math.atan2(LH, N * tread) }); }
    solid('metal', (lx0 + lx1) / 2, LH + 0.95, F + deep - 0.05, lx1 - lx0, 0.05, 0.05, IRON, { phys: false }); cyl('metal', lx0 + 0.05, LH + 0.45, F + deep - 0.05, 0.02, 0.02, 0.9, IRON, { phys: false, seg: 4 });
    if (ci === 1 || ci === 3) { const run = N * tread, L = Math.hypot(run, LH), th = Math.atan2(LH, run); // v3.0.1: worn stone ramp line over the steps: run a ball up the stair
      body(new CANNON.Box(new CANNON.Vec3(L / 2, 0.05, deep / 2 - 0.05)), xs - run / 2 + Math.sin(th) * 0.05, LH / 2 + Math.cos(th) * 0.05 - 0.04, zc, { rz: -th, surface: 'setts' }); }
    stairs.push({ ci, xs, lx0, lx1, LH, deep, zc });
    // windows + doors: ground-floor door under the landing, windows either side; upper floor door on the landing
    quad('facade', (lx0 + lx1) / 2 + 0.15, 1.15, F + deep + 0.01, 1.0, 2.2, 0, cellUV(FACADE.door), 0xffffff); // close door under the stair
    quad('facade', x0 + 1.6, 1.6, F + 0.01, 1.5, 1.8, 0, cellUV(FACADE.small), 0xf0ece4);
    quad('facade', x0 + 1.6, 4.3, F + 0.01, 1.3, 1.5, 0, cellUV(ci % 2 ? FACADE.sashA : FACADE.sashB), 0xf0ece4);
    if (ci !== 3) { quad('facade', (lx0 + lx1) / 2, LH + 1.05, F + 0.01, 1.0, 2.1, 0, cellUV(ci % 2 ? FACADE.doorGreen : FACADE.doorRed), 0xffffff); }
    if (rand() < 0.7) quad('facade', xs - 1.4, 1.5, F + deep + 0.01, 0.01, 0.01, 0, cellUV(FACADE.small), 0xf0ece4);
    quad('grime', xc, 0.8, F + 0.02, w, 1.6, 0, GRIME_UV[0]);
  });
  // behind Main Street: more roofs + a kirk spire so the skyline isn't empty
  for (let i = 0; i < 8; i++) { const x = -40 + i * 10 + rand() * 3, h = 7 + rand() * 4; solid('harl', x, h / 2, -32, 9, h, 6, pick(HARL), { phys: false, tile: 2.4 }); B.add(rand() < 0.6 ? 'pantile' : 'roof', ROOF, M4(x, h, -32, 6.4, 2.6, 9.1, 0, Math.PI / 2), rand() < 0.6 ? 0xffffff : 0x5c6168, { tile: 1.2 }); }
  { const x = -14, z = -40; solid('stone', x, 9, z, 5, 18, 5, 0xb8b2a6, { phys: false, tile: 3 }); B.add('flat', new THREE.ConeGeometry(2.6, 11, 8), M4(x, 23.5, z, 1, 1, 1, 0, Math.PI / 8), 0x5c6168, {}); }
  // gable end of the row (white, as on Main Street) and a stone boundary wall beyond the west end
  solid('stone', -39.5, 1.2, F + 5, 1, 2.4, 10, 0xb8b2a6, { tile: 1.5 });

  // ---------- the Victorian fishmarket (red-painted, arched bays, slate roof) on the east quay ----------
  { const x0 = 24, x1 = 38, z0 = -10, z1 = 10, h = 6.4, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, RED = 0xa8382c;
    solid('flat', xc, h / 2, zc, x1 - x0, h, z1 - z0, RED);
    solid('stone', xc, 0.3, zc, x1 - x0 + 0.2, 0.6, z1 - z0 + 0.2, 0x8a867e, { phys: false });
    for (let k = 0; k < 6; k++) { const z = z0 + 1.7 + k * 3.3; quad('facade', x0 - 0.02, 2.4, z, 2.9, 3.8, -Math.PI / 2, cellUV(FACADE.arch), 0xffd8d0); solid('flat', x0 - 0.06, 3.2, z - 1.65, 0.14, 6.4, 0.3, 0xefe3c8, { phys: false }); }
    B.add('roof', ROOF, M4(xc, h, zc, x1 - x0 + 0.6, 3.4, z1 - z0 + 0.6), 0x55595f, { tile: 2 });
    for (const zz of [z0 + 4, zc, z1 - 4]) { solid('flat', xc, h + 3.6, zz, 1.6, 1.2, 1.6, 0xefe3c8, { phys: false }); B.add('roof', ROOF, M4(xc, h + 4.2, zz, 1.9, 0.8, 1.9), 0x55595f, {}); } // roof ventilators
    quad('atlas', x0 - 0.12, 5.4, zc, 9, 0.8, -Math.PI / 2, atlas.fascia('NEWHAVEN FISHMARKET', 'HERRING · HADDIE · PARTANS', '#8a2a22', '#EFE3C8', 9 / 0.8));
    // the market door (target)
    const dz = 1.6 + 3.3 * 2 - 10 + 0; solid('wood', x0 - 0.08, 1.3, -1.6, 0.12, 2.6, 1.5, 0x2f4a3a, { target: 'fishdoor', surface: 'board' }); quad('atlas', x0 - 0.16, 1.3, -1.6, 1.5, 2.6, -Math.PI / 2, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'fishdoor', name: 'Fishmarket Door', hint: 'strike the marked fishmarket door', points: 75, kind: 'hit', pos: V(x0 - 0.8, 0, -1.6), ringR: 0.9, stand: V(x0 - 5, 0, -1.6), aim: V(x0, 1.0, -1.6), lines: ["Market's shut. Your fitba's no' for sale.", "Fresh in! Haddie, herring, and wan muddy ba'.", 'The fishwives would\'ve had you selling by noon.'] }); }

  // ---------- the west pier and its white lighthouse ----------
  { const x = (WX0 + WX1) / 2, z = WZ1 - 3, R = 1.5, W = 0xf6f4ee; // v3.0.1: proportions after the close-up ref
    cyl('flat', x, 0.4, z, R + 0.45, R + 0.55, 0.8, 0x9a958c, { seg: 8 }); // stone plinth
    cyl('flat', x, 3.9, z, 1.25, R, 6.2, W, { seg: 8 }); // tapering octagonal shaft
    cyl('flat', x, 7.15, z, 1.75, 1.25, 0.3, W, { phys: false, seg: 8 }); cyl('flat', x, 7.45, z, 1.8, 1.8, 0.3, W, { phys: false, seg: 8 }); // heavy cornice
    cyl('flat', x, 8.6, z, 0.95, 1.0, 2.0, W, { phys: false, seg: 8 }); // upper stage
    B.add('flat', new THREE.CircleGeometry(0.22, 12), M4(x, 8.7, z - 0.93, 1, 1, 1, 0, Math.PI), 0x2a3440, {}); // porthole
    cyl('flat', x, 9.62, z, 1.55, 1.0, 0.12, W, { phys: false, seg: 8 }); // gallery deck
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r = 1.62; B.add('flat', CYL(0.018, 0.018, 4), M4(x + Math.cos(a) * r, 10.05, z + Math.sin(a) * r, 1, 0.85, 1, -0.18 * Math.sin(a), 0, 0.18 * Math.cos(a)), W, {}); } // flared railing
    for (const y of [10.45, 9.75]) { const r = y > 10 ? 1.72 : 1.58; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, L = 2 * r * Math.sin(Math.PI / 8); solid('flat', x + Math.cos(a) * r * Math.cos(Math.PI / 8), y, z + Math.sin(a) * r * Math.cos(Math.PI / 8), L, 0.06, 0.06, W, { phys: false, ry: -a + Math.PI / 2 }); } }
    cyl('glass', x, 10.3, z, 0.75, 0.75, 1.2, 0xffffff, { phys: false, seg: 8 }); B.add('lamp', CYL(0.35, 0.35, 8), M4(x, 10.3, z, 1, 0.8, 1), 0xffffff, {});
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl('metal', x + Math.cos(a) * 0.76, 10.3, z + Math.sin(a) * 0.76, 0.03, 0.03, 1.2, W, { phys: false, seg: 4 }); }
    B.add('flat', new THREE.ConeGeometry(0.95, 0.65, 8), M4(x, 11.22, z, 1, 1, 1), W, {}); cyl('metal', x, 11.75, z, 0.04, 0.04, 0.5, IRON, { phys: false, seg: 4 }); B.add('flat', new THREE.SphereGeometry(0.09, 6, 4), M4(x, 12.0, z, 1, 1, 1), IRON, {});
    solid('wood', x, 1.2, z - R + 0.05, 0.9, 2.0, 0.12, 0x1d3b6b, { target: 'lighthouse', surface: 'board' }); quad('atlas', x, 1.2, z - R - 0.02, 0.9, 2.0, Math.PI, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'lighthouse', name: 'Lighthouse Door', hint: 'hit the door of the wee lighthouse', points: 100, kind: 'hit', pos: V(x, 0, z - R - 0.8), ringR: 1.0, stand: V(x, 0, z - R - 5), aim: V(x, 0.9, z - R), lines: ['Ding-dong! The keeper says he\'s no\' in.', 'Lit up! Ships fae Burntisland saw that.', 'Light. House. Ball. In that order.'] }); }
  // the "private pier" gate across the east quay end (target)
  { const z = EZ1 - 1.2, x0 = EX0 + 0.6, x1 = EX1 - 6, xc = (x0 + x1) / 2;
    for (const x of [x0, x1]) cyl('metal', x, 1.4, z, 0.08, 0.08, 2.8, IRON, { seg: 6 });
    for (let x = x0 + 0.25; x < x1; x += 0.25) solid('metal', x, 1.3, z, 0.03, 2.4, 0.03, IRON, { phys: false });
    for (const y of [0.15, 1.3, 2.5]) solid('metal', xc, y, z, x1 - x0, 0.06, 0.06, IRON, { phys: false });
    for (let x = x0; x < x1; x += 0.5) solid('metal', x, 2.8, z, 0.02, 0.5, 0.02, IRON, { phys: false, rz: 0.4 }); // spiky top
    boxBody(xc, 1.4, z, x1 - x0, 2.8, 0.2, { playerOnly: true });
    solid('flat', xc, 1.6, z - 0.08, 1.6, 0.9, 0.06, 0xf4f1ea, { target: 'piergate', surface: 'board' });
    sign("PRIVATE PIER · NAE FITBA' BEYOND", xc, 1.6, z - 0.12, 1.5, 0.8, Math.PI, '#f4f1ea', '#b31b1b', 'bold 40px Arial', '#b31b1b');
    addTarget({ id: 'piergate', name: 'Private Pier Sign', hint: 'hit the sign on the pier gate', points: 75, kind: 'hit', pos: V(xc, 0, z - 1), ringR: 1.0, stand: V(xc, 0, z - 5.5), aim: V(xc, 1.4, z), lines: ["Sign says nae fitba'. Sign got fitba'.", 'Out of bounds? Not for the ball.', 'Private pier. Public goal.'] }); }

  // ---------- quayside: planters with cabbage palms, benches, lamps, tide board, fish boxes, rowing boat, bell ----------
  const LEAF = new THREE.ConeGeometry(0.035, 1, 3), TRUNK = CYL(0.06, 0.09, 6);
  const palm = (x, z, y0) => { B.add('flat', TRUNK, M4(x, y0 + 0.35, z, 1, 0.7, 1), 0x6a5a40, {}); // v3.0.1: cabbage palm - a short trunk and a rosette of thin tapering leaves
    for (let i = 0; i < 22; i++) { const a = rand() * Math.PI * 2, t = 0.15 + rand() * 1.05, L = 0.7 + rand() * 0.45, yb = y0 + 0.7;
      B.add('flat', LEAF, M4(x + Math.sin(t) * Math.sin(a) * L / 2, yb + Math.cos(t) * L / 2, z + Math.sin(t) * Math.cos(a) * L / 2, 1, L, 1, t, a, 0), pick([0x5f7a3a, 0x6f8a42, 0x4f6a32, 0x8a8a4a]), {}); } };
  for (const x of [-18, 0, 12]) { solid('flat', x, 0.4, 4, 1.3, 0.8, 1.3, 0x4a4d50); palm(x, 4, 0.8); }
  { const x = -8, z = 4, w = 1.3, h = 0.8, th = 0.08, c = 0x4a4d50; // the target planter: hollow, soil, palm off to one side
    solid('flat', x, 0.3, z, w, 0.6, w, 0x3a2a1e); for (const [cx, cz, ww, dd] of [[x - w / 2, z, th, w], [x + w / 2, z, th, w], [x, z - w / 2, w, th], [x, z + w / 2, w, th]]) solid('flat', cx, h / 2, cz, ww, h, dd, c);
    palm(x + 0.4, z + 0.4, 0.6);
    addTarget({ id: 'planter', name: 'The Planter', hint: 'chip it in the planter', points: 150, kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 1.1, stand: V(x, 0, z - 5), aim: V(x, 0.6, z),
      zone: new THREE.Box3(V(x - w / 2 - 0.2, 0.6, z - w / 2 - 0.2), V(x + w / 2 + 0.2, h + 0.45, z + w / 2 + 0.2)), lines: ['In the planter! The cabbage palm\'s delighted.', 'Gardeners\' World: Newhaven edition.', 'Planted. Should sprout a wee fitba\' tree by spring.'] }); }
  for (const x of [-22, 4]) { solid('wood', x, 0.45, Q - 3, 1.8, 0.08, 0.5, 0x7a5a3a); solid('wood', x, 0.8, Q - 2.8, 1.8, 0.5, 0.06, 0x7a5a3a, { phys: false }); for (const s of [-0.8, 0.8]) solid('metal', x + s, 0.22, Q - 3, 0.06, 0.44, 0.5, IRON, { phys: false }); } // benches
  for (const [x, z] of [[-26, -6], [-12, -6], [2, -6], [16, -6], [-20, Q - 1], [-2, Q - 1], [16, Q - 1]]) { cyl('metal', x, 2.9, z, 0.07, 0.1, 5.8, IRON, { seg: 6 }); solid('lamp', x, 5.85, z, 0.4, 0.14, 0.4, 0xffffff, { phys: false }); }
  { const x = -14, z = Q - 0.7; for (const s of [-0.5, 0.5]) cyl('metal', x + s, 1.0, z, 0.04, 0.04, 2.0, IRON, { phys: false, seg: 5 });
    solid('flat', x, 1.3, z, 1.2, 1.3, 0.06, 0xf4f1ea, { target: 'tideboard', surface: 'board' });
    for (let k = 0; k < 6; k++) solid('flat', x - 0.3, 0.8 + k * 0.2, z - 0.04, k % 2 ? 0.2 : 0.4, 0.04, 0.02, 0x111111, { phys: false });
    sign('TIDE TIMES · ASK A FISHWIFE', x, 1.85, z - 0.05, 1.1, 0.18, Math.PI, '#f4f1ea', '#1d3b6b', 'bold 40px Arial');
    addTarget({ id: 'tideboard', name: 'Tide Board', hint: 'hit the tide board on the quay edge', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 1.0, stand: V(x, 0, z - 4.5), aim: V(x, 1.2, z), lines: ["High tide! Well, high ball.", 'The tide waits for nae man. The ball didnae wait either.', 'Tide board tidied.'] }); }
  { // fish boxes stacked by the market (topple)
    const x = 18, z = 2, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.8, 0.26, 0.55), new THREE.Matrix4().makeTranslation(0, -0.39 + k * 0.27, 0), [0x2E6E8E, 0xd0402e, 0x2E6E8E, 0xe8c43a][k]);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 1.6, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.4, 0.54, 0.28)) }); b.position.set(x, 0.55, z); b.userData = { target: 'fishboxes', surface: 'plastic' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'fishboxes', name: 'Fish Box Stack', hint: 'knock the fish boxes over', points: 75, kind: 'topple', body: b, pos: V(x, 0, z), stand: V(x - 4, 0, z), aim: V(x, 0.5, z), lines: ['Boxes doon! Smells like a Tuesday.', 'That\'s the haddies scattered.', 'Fish boxes: 0. You: 1.'] }); }
  { // rowing boat hauled up on the quay (zone)
    const x = 6, z = 7.5, L = 3.2, Wd = 1.4, c = 0x2E9C8F;
    solid('wood', x, 0.12, z, Wd, 0.1, L, 0x6b4a2b); for (const s of [-1, 1]) solid('flat', x + s * Wd / 2, 0.38, z, 0.08, 0.6, L, c); solid('flat', x, 0.38, z + L / 2, Wd, 0.6, 0.08, c); solid('flat', x, 0.38, z - L / 2, Wd, 0.6, 0.08, c);
    B.add('flat', ROOF, M4(x, 0.08, z + L / 2 + 0.4, Wd, 0.6, 0.8, Math.PI / 2), c, {}); solid('wood', x, 0.4, z, Wd - 0.1, 0.06, 0.3, 0x6b4a2b, { phys: false });
    sign('FISHWIFE II · LH 7', x + Wd / 2 + 0.05, 0.42, z, 1.4, 0.2, Math.PI / 2, '#2E9C8F', '#fff', 'bold 44px Georgia');
    addTarget({ id: 'rowboat', name: 'The Rowing Boat', hint: 'chip it into the rowing boat', points: 125, kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 1.2, stand: V(x - 5, 0, z), aim: V(x, 0.4, z),
      zone: new THREE.Box3(V(x - Wd / 2 - 0.15, 0.15, z - L / 2 - 0.15), V(x + Wd / 2 + 0.15, 0.95, z + L / 2 + 0.15)), lines: ['In the boat! Row, row, row yer ba\'.', 'All aboard the Fishwife II.', 'Shipshape. Ballshape.'] }); }
  { // the harbour bell on a post: the easy first one, in view of the spawn
    const x = 6, z = -6; cyl('wood', x, 1.4, z, 0.1, 0.12, 2.8, 0x4a3a2a, { seg: 6 }); solid('wood', x, 2.75, z + 0.35, 0.1, 0.1, 0.8, 0x4a3a2a, { phys: false });
    cyl('flat', x, 2.25, z + 0.65, 0.28, 0.42, 0.6, 0xc49a3a, { seg: 12, target: 'bell', surface: 'metal' }); cyl('flat', x, 2.25, z + 0.65, 0.3, 0.3, 0.9, 0xc49a3a, { phys: false, seg: 12 });
    boxBody(x, 2.2, z + 0.65, 0.9, 0.9, 0.9, { target: 'bell', surface: 'metal' });
    sign('RING FOR THE FERRY · 1572', x, 1.5, z - 0.12, 1.0, 0.2, Math.PI, '#1d3b6b', '#f1d98a', 'bold 40px Georgia');
    addTarget({ id: 'bell', name: 'Harbour Bell', hint: 'ring the bell on the post', points: 50, kind: 'hit', pos: V(x, 0, z), ringR: 1.0, stand: V(x + 3, 0, z - 3.2), aim: V(x, 2.0, z + 0.6), lines: ['DONG! Ferry tae Fife? Missed it by 200 years.', 'Bell rung. Dinner\'s ready somewhere.', 'Ring-a-ding. The gulls are complaining.'] }); }
  // forestair targets: a ball landed on a landing (zone), and a first-floor door (hit)
  { const s = stairs.find((t) => t.ci === 1);
    addTarget({ id: 'landing', name: "Granny's Landing", hint: 'chip it up onto the forestair landing (or bounce it up the steps)', points: 150, kind: 'zone', openTop: true, pos: V((s.lx0 + s.lx1) / 2, 0, F + s.deep + 1.2), ringR: 1.1, stand: V(s.xs + 4.5, 0, s.zc + 0.1), aim: V((s.lx0 + s.lx1) / 2, s.LH + 0.3, s.zc),
      zone: new THREE.Box3(V(s.lx0 - 0.35, s.LH + 0.02, F - 0.05), V(s.lx1 + 0.35, s.LH + 1.2, F + s.deep + 0.45)) /* v3.0.1: lower landing (7 steps) + bigger catch zone */, lines: ['On the landing! Granny says wipe yer feet.', 'Up the stair! Doon the stair! Stayed up the stair.', '"Is that you, son? Come in for yer tea."'] }); }
  { const s = stairs.find((t) => t.ci === 3), dx = (s.lx0 + s.lx1) / 2;
    solid('wood', dx, s.LH + 1.05, F + 0.06, 1.25, 2.1, 0.1, 0x8a2a22, { target: 'stairdoor', surface: 'board' }); quad('atlas', dx, s.LH + 1.05, F + 0.12, 1.25, 2.1, 0, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id: 'stairdoor', name: 'Up-the-Stair Door', hint: 'get it up to the first-floor door: run it up the forestair or chip it', points: 125, kind: 'zone', pos: V(dx, 0, F + s.deep + 1.2), ringR: 1.0, stand: V(s.xs + 4.5, 0, s.zc + 0.1), aim: V(dx, s.LH + 0.5, s.zc),
      zone: new THREE.Box3(V(s.lx0 - 0.3, s.LH + 0.02, F - 0.05), V(s.lx1 + 0.3, s.LH + 2.3, F + s.deep + 0.3)), lines: ['Chap chap! Up-the-stair door delivered.', "Second-floor service! Well, first. We're in Scotland.", 'Postie couldnae have done it better.'] }); }
  // distance: the Forth, Fife, Leith flats to the east, a breakwater with a light
  for (let i = 0; i < 9; i++) B.add('flat', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(-260 + i * 70 + rand() * 30, WY, 300 + rand() * 40, 60 + rand() * 50, 10 + rand() * 18, 30), 0x7f8c98, {});
  for (let i = 0; i < 6; i++) { const x = 46 + i * 9, z = -20 + rand() * 40, h = 12 + rand() * 10; solid('flat', x, h / 2, z, 8, h, 12, pick([0xd8cbb0, 0xcfc2a6, 0xe2d6bc]), { phys: false }); for (let j = 1; j < h / 3; j++) solid('glass', x - 4.01, j * 3, z, 0.02, 1.0, 10, 0xffffff, { phys: false }); B.add('roof', ROOF, M4(x, h, z, 8.2, 2, 12.2), 0x6a6e74, {}); }
  solid('stone', -10, WY + 0.6, 70, 70, 1.4, 4, 0x8a867e, { phys: false, tile: 2 });
  for (let i = 0; i < 30; i++) { const x = -38 + rand() * 76, z = F + 2 + rand() * (Q - F - 3); B.add('grime', QUAD, M4(x, 0.012, z, 2 + rand() * 3, 2 + rand() * 2, 1, -Math.PI / 2, rand() * 3), 0xffffff, { uvRect: GRIME_UV[rand() < 0.7 ? 0 : 1] }); }
  for (const [x, z, col, mast] of [[-10, 20, 0xf4f1ea, 8], [4, 24, 0x1d3b6b, 0], [14, 18, 0xc8202a, 0], [-18, 26, 0xf4f1ea, 9]]) { solid('flat', x, WY + 0.35, z, 2.0, 0.8, 5.2, col, { phys: false }); B.add('flat', ROOF, M4(x, WY + 0.75, z + 3.0, 2.0, 0.45, 1.0, Math.PI / 2), col, {});
    if (mast) cyl('flat', x, WY + 0.8 + mast / 2, z - 0.5, 0.06, 0.06, mast, 0xdcdcdc, { phys: false, seg: 5 }); else solid('flat', x, WY + 1.2, z - 0.4, 1.4, 0.9, 1.8, 0xe8e2d4, { phys: false }); }

  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[-6, 0, 9], [10, 0, -2], [-20, 0, 6], [-27, 0, 20]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.harl = tm(limewashTexture()); materials.harl.color.setRGB(1.12, 1.16, 1.24); materials.harl.emissive?.setRGB(0.16, 0.165, 0.18); /* v3.0.1: cool lift + a little self-light so lime-wash reads white under the warm sun, not beige */ materials.pantile = tm(pantileTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [14, -13, 108, 4], street: [-2, -12, 90, 4], harbour: [0, 8, 160, 2], lighthouse: [-27, 18, 180, 8], market: [14, -1, 270, 6] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

// what's under foot / under the ball
export function surfaceAt(x, z) {
  if (z > NH.QUAY) return (x >= NH.WPIER[0] && x <= NH.WPIER[1] && z <= NH.WPIER[2]) || (x >= NH.EQUAY[0] && z <= NH.EQUAY[2]) ? 'concrete' : 'water';
  if (z > NH.FRONT + 1.8 && z < NH.FRONT + 12) return 'setts';
  return 'paving';
}
export default {
  id: 'newhaven', name: 'Newhaven Harbour', short: 'Newhaven', surfaceAt,
  sounds: { harbour: true, birds: [[-20, -24], [10, -24]], gulls: [[0, 24], [-27, 30], [20, 20], [-10, 10]], boats: [[-10, 20], [4, 24], [-18, 26]], water: [[-14, 14], [6, 14], [-27, 33]], far: [[-40, -30], [40, -30], [0, -50]], roadX: 70 },
  blurb: 'Level 4: Newhaven, the old fishing village. 10 targets round the cottages, the forestairs, the harbour, the lighthouse and the fishmarket. Bounce it up the stairs. Mind the quay.',
  intro: "Welcome tae Newhaven!<br><small>Fishermen's cottages wi' outside stairs, and the wee lighthouse. Ball's at your feet. Easy first one: ring the harbour bell, straight ahead.</small>",
  build,
  tiers: { bell: 'easy', fishboxes: 'easy', tideboard: 'easy', piergate: 'easy', fishdoor: 'easy', lighthouse: 'easy', landing: 'tricky', stairdoor: 'tricky', planter: 'tricky', rowboat: 'tricky' },
  spawn: [14, 0.5, -13], spawnYaw: 108,
  ballHomes: () => [[11.5, 0.4, -12.2], [-2, 0.4, -12], [-27, 0.4, 16]],
  bounds: { x: 40, zMin: -28, zMax: 34 },
  sea: { y: -1.7, water: -1.3, lines: ["Splash! Intae the harbour. The partans are playin' keepy-uppy wi' it.", "Ower the railings! Newhaven's no' a beach, son.", "Gone fishin'. Fresh ball at your feet."] },
  next: 'leith',
};
