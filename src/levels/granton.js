// Level 3: Granton (v2.9). The harbour, Middle Pier, an old cobbled slipway, Granton Square and the 1901 gasholder frame
// (the same one you can see from Pilton), squeezed together into one playable waterfront.
// North = +z = the Forth. Land and quays are at y = 0; harbour water sits at y = -1.3. Balls can be lost to the sea
// (main.js: LEVEL.sea) and come straight back; the player is kept on the quay by player-only walls.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, tarmacTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const GT = { QUAY: 20, WATER: -1.3, PIER: [10, 22, 62], SLIP: [-30, -24, 34, -2] };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1901), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const Q = GT.QUAY, WY = GT.WATER, [PX0, PX1, PZ1] = GT.PIER, TEAL = 0x3f8f86, IRON = 0x2a2d31, PURGE = 0x3fa6d0;

  // ---------- land, quays, pier, water ----------
  boxBody(0, -2, (-48 + Q) / 2, 140, 4, Q + 48, { surface: 'setts' }); // the land
  boxBody((PX0 + PX1) / 2, -2, (Q + PZ1) / 2, PX1 - PX0, 4, PZ1 - Q, { surface: 'concrete' }); // Middle Pier
  B.add('flat', QUAD, M4(0, WY, 90, 400, 160, 1, -Math.PI / 2), 0x52687a, {}); // the harbour / the Forth
  for (let i = 0; i < 60; i++) { const x = -70 + rand() * 140, z = 22 + rand() * 120, w = 2 + rand() * 6; B.add('flat', QUAD, M4(x, WY + 0.01, z, w, 0.12, 1, -Math.PI / 2, rand() * 0.3), 0x8698a6, {}); } // glints / ripples
  B.add('paving', QUAD, M4(0, 0.004, -14, 140, 68, 1, -Math.PI / 2), 0xd2d0cc, { tile: 1.6 }); // flags
  B.add('cobble', QUAD, M4(-24, 0.006, (8 + Q) / 2, 72, Q - 8, 1, -Math.PI / 2), 0xc2beb6, { tile: 1.6 }); // old quayside setts
  B.add('tarmac', QUAD, M4(0, 0.008, 5, 140, 6, 1, -Math.PI / 2), 0x8a8c88, { tile: 4 }); // harbour road
  B.add('tarmac', QUAD, M4(0, 0.008, -17, 12, 38, 1, -Math.PI / 2), 0x8a8c88, { tile: 4 }); // road up to the square
  B.add('paving', QUAD, M4((PX0 + PX1) / 2, 0.006, (Q + PZ1) / 2, PX1 - PX0, PZ1 - Q, 1, -Math.PI / 2), 0xcfcdc8, { tile: 3 }); // pier concrete
  B.add('cobble', QUAD, M4(40, 0.006, (8 + Q) / 2, 36, Q - 8, 1, -Math.PI / 2), 0xc2beb6, { tile: 1.6 });
  for (const s of [-1, 1]) for (const dz of [0.25, 0.4]) B.add('flat', QUAD, M4(0, 0.01, 5 + s * (3 - dz), 136, 0.09, 1, -Math.PI / 2), 0xe8c43a, {});
  // quay walls (stone, down to the water) + granite coping, and the pier sides
  const wallFace = (x0, x1, z, ry) => { solid('stone', (x0 + x1) / 2, WY / 2 - 0.4, z, Math.abs(x1 - x0), -WY + 0.8, 0.6, 0x9a968e, { phys: false, ry, tile: 1.5 }); solid('stone', (x0 + x1) / 2, 0.04, z, Math.abs(x1 - x0), 0.08, 0.7, 0xc4c0b8, { phys: false, ry }); };
  wallFace(-70, GT.SLIP[0], Q + 0.3, 0); wallFace(GT.SLIP[1], PX0, Q + 0.3, 0); wallFace(PX1, 70, Q + 0.3, 0);
  for (const x of [PX0 - 0.3, PX1 + 0.3]) solid('stone', x, WY / 2 - 0.4, (Q + PZ1) / 2, 0.6, -WY + 0.8, PZ1 - Q, 0x9a968e, { phys: false, tile: 1.5 });
  solid('stone', (PX0 + PX1) / 2, WY / 2 - 0.4, PZ1 + 0.3, PX1 - PX0 + 1.2, -WY + 0.8, 0.6, 0x9a968e, { phys: false, tile: 1.5 });
  for (const z of [30, 44, 58]) solid('wood', PX0 - 0.45, WY / 2, z, 0.3, -WY + 1.4, 0.3, 0x4a3a2a, { phys: false }); // timber fenders
  // player-only edge walls (the ball can still go in the water)
  for (const [x, z, w, d] of [[(-70 + PX0) / 2, Q + 0.35, 80 + PX0, 0.3], [(PX1 + 70) / 2, Q + 0.35, 70 - PX1, 0.3], [PX0 - 0.35, (Q + PZ1) / 2, 0.3, PZ1 - Q], [PX1 + 0.35, (Q + PZ1) / 2, 0.3, PZ1 - Q], [(PX0 + PX1) / 2, PZ1 + 0.35, PX1 - PX0, 0.3]]) boxBody(x, 1.5, z, w, 3, d, { playerOnly: true });
  for (const [x, z, w, d] of [[0, -46, 140, 1], [58.5, -12, 1, 70], [-58.5, -12, 1, 70]]) boxBody(x, 4, z, w, 8, d); // land boundary

  // ---------- the old slipway (setts and weed, sloping into the water) ----------
  { const [x0, x1, z1, y1] = GT.SLIP, len = z1 - Q, th = Math.atan2(-y1, len), cx = (x0 + x1) / 2, L = Math.hypot(len, y1);
    boxBody(cx, y1 / 2 - 0.3 * Math.cos(th), (Q + z1) / 2, x1 - x0, 0.6, L, { rx: th, surface: 'setts' });
    B.add('cobble', BOX, M4(cx, y1 / 2 - 0.3, (Q + z1) / 2, x1 - x0, 0.6, L, th), 0x9a968c, { tile: 1.4 });
    for (let i = 0; i < 26; i++) { const t = rand(), x = x0 + 0.3 + rand() * (x1 - x0 - 0.6), z = Q + t * len; B.add('grime', QUAD, M4(x, -t * -y1 + 0.03 + 0.005, z, 0.6 + rand(), 0.5 + rand(), 1, -Math.PI / 2 + th, rand() * 3), t > 0.55 ? 0x4f7a3a : 0xffffff, { uvRect: GRIME_UV[0] }); } // sea-moss and stains
    for (const x of [x0 - 0.2, x1 + 0.2]) solid('stone', x, y1 / 2 - 0.1, (Q + z1) / 2, 0.4, 0.4, L, 0x8a867e, { phys: false, rx: th });
  }

  // ---------- Granton Square: a Georgian sandstone terrace with chimney stacks ----------
  function terrace(x0, x1, zf, floors = 3) { const len = x1 - x0, xc = (x0 + x1) / 2, D = 10, h = floors * 3.4 + 0.8, nb = Math.round(len / 3.2), bw = len / nb;
    solid('stone', xc, h / 2, zf - D / 2, len, h, D, 0xe0dcd2, { tile: 3 });
    for (let i = 0; i < nb; i++) for (let j = 0; j < floors; j++) quad('facade', x0 + (i + 0.5) * bw, 0.8 + (j + 0.5) * 3.4, zf + 0.01, bw, 3.4, 0, cellUV(j === 0 ? (i % 4 === 1 ? FACADE.doorGreen : i % 7 === 3 ? FACADE.doorRed : FACADE.sashA) : j === floors - 1 ? FACADE.small : pick([FACADE.sashA, FACADE.sashB, FACADE.lit])), 0xf0ece4);
    solid('stone', xc, 0.4, zf + 0.06, len, 0.8, 0.12, 0xb8b2a6, { phys: false }); solid('stone', xc, h - 0.2, zf + 0.12, len + 0.1, 0.4, 0.3, 0xd8d2c6, { phys: false });
    B.add('roof', ROOF, M4(xc, h, zf - D / 2, D + 0.3, 3.2, len, 0, Math.PI / 2), 0x6e737a, { tile: 2.2 });
    for (let x = x0 + 4; x < x1 - 2; x += 8) { solid('stone', x, h + 2.2, zf - D / 2, 1.2, 3, 3.2, 0xd8d2c6, { phys: false, tile: 3 }); for (let k = -1.2; k <= 1.21; k += 0.6) cyl('flat', x, h + 3.9, zf - D / 2 + k, 0.13, 0.16, 0.5, 0xa65a3a, { phys: false, seg: 6 }); }
    for (let i = 0; i < nb; i += 2) quad('grime', x0 + (i + 0.5) * bw, h - 3, zf + 0.03, 1.6, 4, 0, GRIME_UV[2]); }
  terrace(-34, -8, -40); terrace(8, 40, -40);
  solid('stone', -8 - 9, 1.0, -38.6, 0.3, 2, 0.3, 0x2a2d31, { phys: false });
  // a shopfront in the terrace: the chandlery
  { const x0 = 9, x1 = 17, z = -40; solid('wood', (x0 + x1) / 2, 1.7, z + 0.1, x1 - x0, 3.2, 0.2, 0x2f5a6e, { phys: false });
    quad('atlas', (x0 + x1) / 2, 3.0, z + 0.22, x1 - x0 - 0.4, 0.6, 0, atlas.fascia('FORTH & FATHOM', 'CHANDLERY · ROPES · BAIT', '#2f5a6e', '#f1d98a', (x1 - x0 - 0.4) / 0.6));
    quad('glass', (x0 + x1) / 2 - 1, 1.4, z + 0.22, 4.2, 1.8, 0, null, 0xffffff); }
  // roundabout in the square, with the street sign (target)
  { const x = 14, z = -27; cyl('stone', x, 0.08, z, 3.2, 3.3, 0.16, 0xc8c2b6, { phys: false, seg: 18 }); cyl('flat', x, 0.17, z, 2.9, 2.9, 0.02, 0x5a7a3a, { phys: false, seg: 18 }); boxBody(x, 0.08, z, 6, 0.16, 6, { surface: 'paving' });
    cyl('metal', x - 0.9, 1.2, z - 1.6, 0.05, 0.05, 2.4, IRON, { seg: 6 }); cyl('metal', x + 0.9, 1.2, z - 1.6, 0.05, 0.05, 2.4, IRON, { seg: 6 });
    solid('flat', x, 2.0, z - 1.6, 2.1, 0.5, 0.06, 0xf4f1ea, { target: 'square', surface: 'board' }); sign('GRANTON SQUARE', x, 2.0, z - 1.64, 2.0, 0.42, Math.PI, '#f4f1ea', '#111', 'bold 60px Arial', '#111');
    addTarget({ id: 'square', name: 'Granton Square Sign', hint: 'hit the street sign', points: 50, kind: 'hit', pos: V(x, 0, z - 1.6), ringR: 1.2, stand: V(x, 0, z - 6), aim: V(x, 1.8, z - 1.6), lines: ['Signed, sealed, Granton.', 'Postcode confirmed: EH5.', 'Even the roundabout applauded. Slowly. In a circle.'] }); }

  // ---------- the gasholder frame (1901), scrubby ground, chain-link fence ----------
  const GH = { x: -38, z: -22, R: 12, H: 26 };
  B.add('flat', new THREE.CircleGeometry(GH.R + 4, 24).rotateX(-Math.PI / 2), M4(GH.x, 0.01, GH.z, 1, 1, 1), 0x7a7a52, {}); // dry scrub
  for (let i = 0; i < 40; i++) { const a = rand() * 7, r = rand() * (GH.R + 3); B.add('flat', new THREE.IcosahedronGeometry(0.4 + rand() * 0.4, 0), M4(GH.x + Math.cos(a) * r, 0.2, GH.z + Math.sin(a) * r, 1, 0.6, 1), pick([0x6b6a40, 0x80744a, 0x5a6a3a]), {}); }
  const NC = 16;
  for (let i = 0; i < NC; i++) { const a = i / NC * Math.PI * 2, x = GH.x + Math.cos(a) * GH.R, z = GH.z + Math.sin(a) * GH.R;
    cyl('metal', x, GH.H / 2, z, 0.28, 0.32, GH.H, TEAL, { seg: 8, target: i === 3 ? 'gasframe' : null }); cyl('metal', x, GH.H + 0.4, z, 0.4, 0.3, 0.8, TEAL, { phys: false, seg: 8 });
    const a2 = (i + 1) / NC * Math.PI * 2, x2 = GH.x + Math.cos(a2) * GH.R, z2 = GH.z + Math.sin(a2) * GH.R, mx = (x + x2) / 2, mz = (z + z2) / 2, L = Math.hypot(x2 - x, z2 - z), ry = -Math.atan2(z2 - z, x2 - x);
    for (const y of [9, 17.5, GH.H]) solid('metal', mx, y, mz, L, 0.35, 0.18, TEAL, { phys: false, ry });
    for (const [y0, y1] of [[0.5, 9], [9, 17.5], [17.5, GH.H]]) for (const s of [-1, 1]) solid('metal', mx, (y0 + y1) / 2, mz, 0.08, Math.hypot(L, y1 - y0), 0.08, TEAL, { phys: false, ry, rz: s * Math.atan2(L, y1 - y0) }); // lattice X-bracing
  }
  { const a = 3 / NC * Math.PI * 2, x = GH.x + Math.cos(a) * GH.R, z = GH.z + Math.sin(a) * GH.R; for (const y of [0.9, 1.5]) cyl('flat', x, y, z, 0.33, 0.33, 0.25, 0xf7c325, { phys: false, seg: 8 });
    addTarget({ id: 'gasframe', name: 'Gasholder Frame', hint: 'ping the banded column of the gasholder', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 1.0, stand: V(x + 4.2, 0, z - 4.2), aim: V(x, 1.2, z), lines: ["Off the gasholder! 1901 ironwork, still daein' a shift.", "You can see this frame fae Pilton. Now it's seen you.", 'BOING. The whole lattice hummed.'] }); }
  for (let i = 0; i < 18; i++) { const a = Math.PI * 0.95 + i / 17 * Math.PI * 0.9, r = GH.R + 6, x = GH.x + Math.cos(a) * r, z = GH.z + Math.sin(a) * r; cyl('metal', x, 1.1, z, 0.04, 0.04, 2.2, 0x8a8c88, { phys: false, seg: 5 }); } // fence posts (far side)
  sign('KEEP OUT · GAS FRAME', GH.x - 15.5, 1.4, GH.z - 6, 1.6, 0.5, Math.PI / 2, '#f7c325', '#111', 'bold 40px Arial', '#111');

  // ---------- the purge point (bright blue pipework, yellow valve) on a gravel pad ----------
  { const x = -20, z = -10; B.add('flat', QUAD, M4(x, 0.012, z, 6, 4, 1, -Math.PI / 2), 0x8a8478, {});
    for (const dx of [-1.6, 1.6]) { cyl('flat', x + dx, 0.75, z, 0.6, 0.6, 1.5, PURGE, { seg: 12, target: 'purge', surface: 'metal' }); cyl('flat', x + dx, 1.55, z, 0.66, 0.66, 0.1, PURGE, { phys: false, seg: 12 }); }
    cyl('flat', x, 0.85, z, 0.42, 0.42, 2.2, PURGE, { seg: 10, rz: Math.PI / 2, target: 'purge', surface: 'metal' }); cyl('flat', x, 0.85, z, 0.55, 0.55, 0.4, PURGE, { phys: false, seg: 10, rz: Math.PI / 2 });
    cyl('flat', x, 1.4, z, 0.04, 0.04, 0.4, 0xf7c325, { phys: false, seg: 5 }); solid('flat', x, 1.62, z, 0.5, 0.06, 0.1, 0xf7c325, { phys: false });
    sign('PURGE POINT', x - 1.6, 1.05, z - 0.62, 0.7, 0.32, Math.PI, '#111', '#f7c325', 'bold 50px Arial', '#111');
    addTarget({ id: 'purge', name: 'Purge Point', hint: 'hit the blue pipework', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 1.6, stand: V(x, 0, z + 4.6), aim: V(x, 0.8, z), lines: ['Purge point: purged.', "Relax, it's been empty for years. The gas, no' your talent.", 'That blue is so bright the gulls wear shades.'] }); }

  // ---------- harbour side: bollards, lifebuoy, the harbourmaster's office, buoy, boats ----------
  for (const x of [-52, -42, -12, 0, 30, 44]) { cyl('metal', x, 0.35, Q - 0.5, 0.22, 0.26, 0.7, IRON, { seg: 10 }); cyl('metal', x, 0.72, Q - 0.5, 0.3, 0.3, 0.08, IRON, { phys: false, seg: 10 }); }
  { const x = -20, z = Q - 0.6; cyl('metal', x, 0.38, z, 0.24, 0.28, 0.76, IRON, { seg: 10, target: 'bollard' }); cyl('metal', x, 0.78, z, 0.33, 0.33, 0.09, IRON, { phys: false, seg: 10 }); cyl('flat', x, 0.5, z, 0.25, 0.25, 0.12, 0xf7c325, { phys: false, seg: 10 });
    addTarget({ id: 'bollard', name: 'Mooring Bollard', hint: 'hit the bollard on the edge (miss and it\'s in the harbour)', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 0.8, stand: V(x, 0, z - 4.5), aim: V(x, 0.4, z), lines: ["Moored! That bollard's held trawlers, it'll haud you.", 'CLANG. Heard in Kirkcaldy.', 'Tied up nice. Nae knots required.'] }); }
  { const x = -44, z = Q - 0.7; cyl('wood', x, 1.0, z, 0.06, 0.06, 2.0, 0x6b4a2b, { phys: false, seg: 6 }); solid('flat', x, 1.3, z, 0.95, 1.1, 0.08, 0x1d3b6b, { target: 'lifebuoy', surface: 'board' });
    B.add('flat', new THREE.TorusGeometry(0.33, 0.08, 6, 14), M4(x, 1.3, z - 0.07, 1, 1, 1), 0xe8582a, {}); for (const a of [0, 1.57, 3.14, 4.71]) solid('flat', x + Math.cos(a) * 0.33, 1.3 + Math.sin(a) * 0.33, z - 0.09, 0.1, 0.1, 0.12, 0xf4f1ea, { phys: false });
    sign('LIFEBUOY', x, 1.95, z - 0.05, 0.7, 0.14, Math.PI, '#1d3b6b', '#fff', 'bold 50px Arial');
    addTarget({ id: 'lifebuoy', name: 'Lifebuoy Board', hint: 'hit the lifebuoy board', points: 75, kind: 'hit', pos: V(x, 0, z), ringR: 1.0, stand: V(x, 0, z - 4.2), aim: V(x, 1.0, z), lines: ['Man overboard drill: passed.', 'The lifebuoy has saved one life today: yours, fae boredom.', 'Bullseye on the ring. The coastguard are impressed.'] }); }
  { const x0 = -15, x1 = -5, z0 = 10, z1 = 16, h = 4.2; // harbourmaster's office: small stone building, slate roof
    solid('stone', (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 0xd8d2c6, { tile: 2.5 }); B.add('roof', ROOF, M4((x0 + x1) / 2, h, (z0 + z1) / 2, z1 - z0 + 0.4, 2.2, x1 - x0 + 0.4, 0, Math.PI / 2), 0x5c6168, {});
    for (const dx of [-3.4, 3.2]) quad('facade', (x0 + x1) / 2 + dx, 2.2, z0 - 0.01, 2.6, 3, Math.PI, cellUV(FACADE.small), 0xf0ece4);
    const dx = (x0 + x1) / 2; solid('wood', dx, 1.15, z0 - 0.06, 1.1, 2.3, 0.1, 0x1d3b6b, { target: 'hmdoor', surface: 'board' }); quad('atlas', dx, 1.15, z0 - 0.12, 1.1, 2.3, Math.PI, atlas.draw(128, 256, drawTargetDoor));
    sign('HARBOURMASTER', dx, 3.2, z0 - 0.08, 2.4, 0.4, Math.PI, '#f4f1ea', '#1d3b6b', 'bold 56px Georgia', '#1d3b6b');
    addTarget({ id: 'hmdoor', name: "Harbourmaster's Door", hint: 'strike the marked door', points: 75, kind: 'hit', pos: V(dx, 0, z0 - 0.8), ringR: 0.9, stand: V(dx, 0, z0 - 4.6), aim: V(dx, 0.6, z0 - 0.2), lines: ["Harbourmaster's oot. Leave it on the step.", 'Knock knock. "Tide tables are on the board, son."', 'Permission tae come ashore: granted.'] }); }
  { // red can buoy hauled out for painting (topples)
    const x = 4, z = 13, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.CylinderGeometry(0.42, 0.48, 1.2, 12), new THREE.Matrix4(), 0xc8202a); add(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), new THREE.Matrix4().makeTranslation(0, -0.2, 0), 0xf4f1ea); add(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8), new THREE.Matrix4().makeTranslation(0, 0.75, 0), 0x2a2d31);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 1.2, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.36, 0.6, 0.36)) }); b.position.set(x, 0.61, z); b.userData = { target: 'buoy', surface: 'plastic' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'buoy', name: 'Red Can Buoy', hint: 'knock the buoy over', points: 75, kind: 'topple', body: b, pos: V(x, 0, z), stand: V(x, 0, z - 4), aim: V(x, 0.5, z), lines: ['Buoy down! Shipping forecast: Forth, chaos.', 'Port-hand mark, starboard-hand boot.', "It's red, it's round, it's horizontal now."] }); }
  for (const [x, z, col, mast] of [[-40, 34, 0xf4f1ea, 9], [-14, 40, 0x1d3b6b, 0], [-50, 50, 0xc8202a, 0], [34, 32, 0xf4f1ea, 11], [44, 46, 0xf4f1ea, 8], [-2, 54, 0x2E9C8F, 0]]) { // moored boats
    solid('flat', x, WY + 0.35, z, 2.2, 0.9, 6, col, { phys: false }); B.add('flat', ROOF, M4(x, WY + 0.8, z + 3.4, 2.2, 0.5, 1.2, Math.PI / 2), col, {}); solid('flat', x, WY + 0.82, z, 2.25, 0.06, 6.05, 0x2a2d31, { phys: false });
    if (mast) { cyl('flat', x, WY + 0.8 + mast / 2, z - 0.5, 0.06, 0.06, mast, 0xdcdcdc, { phys: false, seg: 5 }); solid('flat', x, WY + 2, z - 1.6, 0.05, 0.05, 2.4, 0xdcdcdc, { phys: false, rx: Math.PI / 2 }); }
    else solid('flat', x, WY + 1.3, z - 0.4, 1.6, 1.0, 2.0, 0xe8e2d4, { phys: false }); }
  // ---------- Middle Pier: the Piece Box kiosk, creels, warehouses ----------
  { const x0 = 14.5, x1 = 17.5, z0 = 25.8, z1 = 28.3, h = 2.6, xc = (x0 + x1) / 2, W2 = 0.12, c = 0xf4f1ea, hx0 = 15.4, hx1 = 16.6, hy0 = 1.0, hy1 = 1.65;
    solid('flat', xc, h / 2, z1, x1 - x0, h, W2, c); solid('flat', x0, h / 2, (z0 + z1) / 2, W2, h, z1 - z0, c); solid('flat', x1, h / 2, (z0 + z1) / 2, W2, h, z1 - z0, c);
    solid('flat', (x0 + hx0) / 2, h / 2, z0, hx0 - x0, h, W2, c); solid('flat', (hx1 + x1) / 2, h / 2, z0, x1 - hx1, h, W2, c);
    solid('flat', xc, hy0 / 2, z0, hx1 - hx0, hy0, W2, c); solid('flat', xc, (hy1 + h) / 2, z0, hx1 - hx0, h - hy1, W2, c);
    solid('flat', xc, h + 0.06, (z0 + z1) / 2, x1 - x0 + 0.5, 0.12, z1 - z0 + 0.6, 0x3D6F8E, { phys: false }); solid('flat', xc, hy1 + 0.18, z0 - 0.35, hx1 - hx0 + 0.6, 0.04, 0.7, 0x3D6F8E, { phys: false, rx: -0.25 });
    solid('flat', xc, 0.95, (z0 + z1) / 2, x1 - x0 - 0.25, 0.06, z1 - z0 - 0.25, 0x6b4a2b); // counter shelf inside
    B.add('lamp', BOX, M4(xc, 1.9, z0 + 0.6, 0.6, 0.1, 0.3), 0xffffff, {});
    quad('atlas', xc, 2.2, z0 - 0.07, x1 - x0 - 0.2, 0.5, Math.PI, atlas.fascia('THE PIECE BOX', 'TEAS · ROLLS · TABLET', '#3D6F8E', '#EFE3C8', (x1 - x0 - 0.2) / 0.5));
    addTarget({ id: 'hatch', name: 'The Piece Box Hatch', hint: 'chip it through the kiosk hatch', points: 150, kind: 'zone', pos: V(xc, 0, z0 - 0.8), ringR: 1.0, stand: V(xc, 0, z0 - 4.6), aim: V(xc, 1.3, z0),
      zone: new THREE.Box3(V(hx0, 0.98, z0 + 0.05), V(hx1, 1.9, z1 - 0.1)), lines: ['One ball, nae sauce. Through the hatch!', 'Order up: one fitba\' roll, extra mud.', '"We don\'t do refunds, son."'] }); }
  { const x = 20.4, z = 35; for (const [dx, dy, dz] of [[0, 0.25, -0.8], [0, 0.75, -0.8], [0, 0.25, 0.8], [0.0, 0.75, 0.8]]) solid('flat', x + dx, dy, z + dz, 1.0, 0.5, 0.7, 0x2f5a3a, { phys: dy < 0.5 }); // creel stacks
    const w = 1.0, d = 0.8, h = 0.55, th = 0.05, c = 0x1d3b6b; solid('flat', x, 0.04, z, w, 0.08, d, c); for (const [cx, cz, ww, dd] of [[x - w / 2, z, th, d], [x + w / 2, z, th, d], [x, z - d / 2, w, th], [x, z + d / 2, w, th]]) solid('flat', cx, h / 2, cz, ww, h, dd, c);
    for (let k = -2; k <= 2; k++) solid('flat', x + k * 0.2, h - 0.02, z, 0.02, 0.02, d, 0xc8c4b8, { phys: false }); // netting hoops
    sign('M. LINDSAY · CREELS', x, 1.25, z, 1.2, 0.2, -Math.PI / 2, '#efe3c8', '#1d3b6b', 'bold 44px Georgia');
    addTarget({ id: 'creel', name: 'The Open Creel', hint: 'chip it in the creel', points: 150, kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 1.0, stand: V(x - 5, 0, z), aim: V(x, 0.4, z),
      zone: new THREE.Box3(V(x - w / 2 - 0.12, 0.08, z - d / 2 - 0.12), V(x + w / 2 + 0.12, h + 0.25, z + d / 2 + 0.12)), lines: ['In the creel! The lobsters are raging.', "Catch o' the day: one fitba'.", 'Landed. That\'s gaun on the chalkboard.'] }); }
  { const x0 = PX0 + 0.5, x1 = PX1 - 0.5, z0 = 42, z1 = 60, h = 6; // Middle Pier warehouse: stone, arched openings, pitched roof
    solid('stone', (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 0xa89a88, { tile: 2.5, grime: 0.3 });
    for (let i = 0; i < 3; i++) quad('facade', x0 + 1.8 + i * 3.6, 2, z0 - 0.01, 3.4, 4, Math.PI, cellUV(FACADE.arch), 0xd8d0c4);
    for (const x of [x0 - 0.01, x1 + 0.01]) for (let k = 0; k < 5; k++) quad('facade', x, 2.4, z0 + 1.8 + k * 3.6, 3.4, 3.4, x < 15 ? -Math.PI / 2 : Math.PI / 2, cellUV(k % 2 ? FACADE.blind : FACADE.small), 0xd8d0c4);
    B.add('roof', ROOF, M4((x0 + x1) / 2, h, (z0 + z1) / 2, x1 - x0 + 0.4, 2.6, z1 - z0 + 0.4), 0x7a5a4a, { tile: 2 });
    quad('atlas', (x0 + x1) / 2, 5.2, z0 - 0.05, 8, 0.6, Math.PI, atlas.fascia('MIDDLE PIER STORES', null, '#2E2F2C', '#EFE3C8', 8 / 0.6)); }
  // ---------- the slipway dinghy (roll it down the slip and in) ----------
  { const [x0, x1, z1, y1] = GT.SLIP, cx = (x0 + x1) / 2, zc = 29, slopeY = (z) => y1 * (z - Q) / (z1 - Q), yb = slopeY(zc + 0.8) + 0.02, c = 0xf4f1ea;
    solid('wood', cx, yb + 0.05, zc, 2.0, 0.1, 1.8, 0x6b4a2b); for (const s of [-1, 1]) solid('flat', cx + s * 1.0, yb + 0.3, zc, 0.08, 0.6, 1.8, c); solid('flat', cx, yb + 0.35, zc + 0.92, 2.08, 0.7, 0.08, c); // sides + transom (open uphill end)
    solid('flat', cx, yb + 0.62, zc, 2.1, 0.06, 1.85, 0x3D6F8E, { phys: false }); sign('WEE MAGGIE · LH 19', cx + 1.05, yb + 0.35, zc, 1.2, 0.2, Math.PI / 2, '#f4f1ea', '#1d3b6b', 'bold 44px Georgia');
    addTarget({ id: 'dinghy', name: 'Dinghy on the Slip', hint: 'roll it doon the slipway into the dinghy', points: 125, kind: 'zone', pos: V(cx, 0, Q - 0.5), ringR: 1.0, stand: V(cx, 0, Q - 4.5), aim: V(cx, yb, zc),
      zone: new THREE.Box3(V(cx - 1.0, yb + 0.05, zc - 0.9), V(cx + 1.0, yb + 0.8, zc + 0.9)), lines: ['Doon the slip and in the boat. Skipper material.', 'Launched! The Wee Maggie has a new crew.', 'Roll on, roll in. Tidy seamanship.'] }); }
  // ---------- distance: breakwaters, Fife across the Forth, waterfront flats ----------
  for (const [x0, x1, z] of [[-90, -10, 96], [26, 90, 90]]) solid('stone', (x0 + x1) / 2, WY + 0.6, z, x1 - x0, 1.4, 4, 0x8a867e, { phys: false, tile: 2 });
  solid('flat', 30, WY + 1.5, 92, 1.2, 4, 1.2, 0xf4f1ea, { phys: false }); B.add('lamp', BOX, M4(30, WY + 3.8, 92, 0.8, 0.6, 0.8), 0xffffff, {}); // breakwater light
  for (let i = 0; i < 9; i++) B.add('flat', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M4(-260 + i * 70 + rand() * 30, WY, 330 + rand() * 40, 60 + rand() * 50, 10 + rand() * 18, 30), 0x7f8c98, {}); // Fife hills
  for (let i = 0; i < 7; i++) { const x = -70 - i * 9, z = 40 + rand() * 30, h = 10 + rand() * 12; solid('flat', x, h / 2, z, 8, h, 10, pick([0xe8e4dc, 0xcfc9bf, 0xb8b2a8]), { phys: false }); for (let j = 1; j < h / 3; j++) solid('glass', x + 4.01, j * 3, z, 0.02, 0.9, 7, 0xffffff, { phys: false }); }
  for (const [x, z] of [[-6, -5], [6, -5], [-6, -20], [6, -20], [-30, 8], [20, 8]]) { cyl('metal', x, 2.6, z, 0.07, 0.11, 5.2, IRON, { seg: 6 }); solid('flat', x + 0.5, 5.2, z, 1.0, 0.08, 0.12, IRON, { phys: false }); solid('lamp', x + 0.95, 5.12, z, 0.35, 0.1, 0.2, 0xffffff, { phys: false }); } // lamp posts
  for (let i = 0; i < 30; i++) { const x = -56 + rand() * 112, z = -44 + rand() * 62; if (Math.hypot(x - GH.x, z - GH.z) < GH.R + 5) continue; B.add('grime', QUAD, M4(x, 0.012, z, 2 + rand() * 3, 2 + rand() * 2, 1, -Math.PI / 2, rand() * 3), 0xffffff, { uvRect: GRIME_UV[rand() < 0.7 ? 0 : 1] }); }

  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  // pigeons (gulls would be grander, but the quay pigeons do the job)
  const groups = [[-8, 0, 17], [12, 0, 4], [18, 0, 30], [-30, 0, -6]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  { const m = materials.flat.clone(); m.map = tarmacTexture(); materials.tarmac = m; }
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [0, -28, 180, -4], quay: [-20, 12, 180, 0], pier: [16, 22, 180, 0], gas: [-24, -10, 120, 18] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

// what's under foot / under the ball
export function surfaceAt(x, z) {
  if (z > GT.QUAY) return x >= GT.PIER[0] && x <= GT.PIER[1] ? 'concrete' : x >= GT.SLIP[0] && x <= GT.SLIP[1] ? 'setts' : 'water';
  if (Math.hypot(x + 38, z + 22) < 16) return 'gravel';
  if (Math.abs(x + 20) < 3 && Math.abs(z + 10) < 2) return 'gravel';
  if (z >= 8) return 'setts';
  if (z >= 2) return 'tarmac';
  if (Math.abs(x) < 6 && z > -36) return 'tarmac';
  return 'paving';
}
export default {
  id: 'granton', name: 'Granton Harbour', short: 'Granton', surfaceAt,
  sounds: { harbour: true, birds: [[-38, -22], [-20, -10]], gulls: [[0, 40], [-30, 30], [30, 50], [16, 30]], boats: [[-40, 34], [34, 32], [44, 46]], water: [[-20, 22], [16, 40], [40, 22]], far: [[-60, -40], [50, -40], [0, -60]], roadX: 80 },
  blurb: 'Level 3: Granton, doon the harbour. 10 targets round the quay, the pier, the slipway and the gasholder. Mind the edge: the Forth keeps whit it gets.',
  intro: "Welcome tae Granton!<br><small>That's the gasholder you can see fae Pilton. Easy first one: the Granton Square sign on the roundabout, front right. Mind the quay edge.</small>",
  build,
  tiers: { square: 'easy', bollard: 'easy', lifebuoy: 'easy', buoy: 'easy', hmdoor: 'easy', gasframe: 'easy', purge: 'easy', creel: 'tricky', dinghy: 'tricky', hatch: 'tricky' },
  spawn: [0, 0.5, -28], spawnYaw: 180,
  ballHomes: () => [[0.3, 0.4, -25.6], [16, 0.4, 23], [-24, 0.4, -6]],
  bounds: { x: 58, zMin: -46, zMax: 64 },
  sea: { y: -1.7, lines: ["Splash! That's in the Forth. Fife's keepin' it - here's another.", "Ower the edge! The seals say ta. Fresh ba' at your feet.", "In the harbour. The tide's no' bringin' that back. New ball's oot."] },
  next: 'pilton',
};
