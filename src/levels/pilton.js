// Level 1: West Pilton, north Edinburgh. A compact, fictionalised street inspired by the 1930s-50s
// Edinburgh Corporation scheme (City Architect E. J. MacRae): harled three-storey flatted blocks with
// pitched roofs, a flat-roofed post-war block, four-in-a-block cottage flats with front gardens and low
// walls, a drying green up a grassy bank, a lock-up garage row, a bus stop, a wee shop parade with
// a chippy, and views north to the Forth, Fife and the Granton gasholder frame.
// Same batching approach as the Grassmarket: everything static is merged per material.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { GRIME_UV, SignAtlas, drawTargetDoor, harlTextureV2, brickTexture, garageDoorTexture, tarmacTexture } from '../textures.js';
import { buildParade } from './pilton-parade.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const BANK = { x0: 8, x1: 13, rise: 1.2, z0: -10, z1: 2 }; // grassy bank up to the drying green

function build(scene, world, mats, P) {
  const rand = mulberry32(1936);
  const B = new Batcher(), atlas = new SignAtlas();
  const targets = [], dynamics = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BOX = new THREE.BoxGeometry(1, 1, 1), ROOF = roofPrism();
  const cylCache = {};
  const CYL = (rt, rb, seg) => (cylCache[rt + ':' + rb + ':' + seg] ||= new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const M4 = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); return new THREE.Matrix4().compose(V(x, y, z), q, V(sx, sy, sz)); };
  function body(shape, x, y, z, { rx = 0, ry = 0, rz = 0, material = mats.ground, target = null, surface = null } = {}) {
    const b = new CANNON.Body({ mass: 0, material, shape }); b.position.set(x, y, z);
    eul.set(rx, ry, rz, 'YXZ'); q.setFromEuler(eul); b.quaternion.set(q.x, q.y, q.z, q.w);
    if (target || surface) b.userData = { target, surface }; world.addBody(b); return b;
  }
  const boxBody = (x, y, z, w, h, d, o = {}) => body(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), x, y, z, o);
  function solid(key, x, y, z, w, h, d, color, { phys = true, rx = 0, ry = 0, rz = 0, tile = 0, grime = 0, target = null, surface = null } = {}) {
    B.add(key, BOX, M4(x, y, z, w, h, d, rx, ry, rz), color, { tile, grime });
    return phys ? boxBody(x, y, z, w, h, d, { rx, ry, rz, target, surface }) : null;
  }
  function cyl(key, x, y, z, rt, rb, h, color, { phys = true, seg = 8, target = null, surface = key === 'metal' ? 'metal' : null } = {}) {
    B.add(key, CYL(rt, rb, seg), M4(x, y, z, 1, h, 1), color, {});
    return phys ? body(new CANNON.Cylinder(rt, rb, h, seg), x, y, z, { target, surface }) : null;
  }
  const quad = (key, x, y, z, w, h, ry, uvRect = null, color = 0xffffff, { rx = 0, grime = 0, tile = 0 } = {}) => B.add(key, QUAD, M4(x, y, z, w, h, 1, rx, ry), color, { uvRect, grime, tile });
  const sign = (text, x, y, z, w, h, ry, bg, fg, font, border) => quad('atlas', x, y, z, w, h, ry, atlas.sign(text, bg, fg, w / h, font, border));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const ROT = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI };

  // ---------- ground: grass, road, pavements (flush: no kerb lip to launch the ball) ----------
  const ground = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
  B.add('flat', QUAD, M4(0, 0, 20, 220, 180, 1, -Math.PI / 2), 0x5f7d3f, { shade: (x, y, z) => 0.92 + 0.08 * Math.sin(x * 0.3) * Math.sin(z * 0.27) });
  quad('tarmac', 0, 0.004, -8, 8, 76, 0, null, 0x8a8c88, { rx: -Math.PI / 2, tile: 4 }); // v2.0 procedural tarmac
  quad('flat', 0, 0.006, -8, 0.12, 74, 0, null, 0xd8d0a0, { rx: -Math.PI / 2 }); // centre line... faded
  for (const s of [-1, 1]) quad('paving', s * 5, 0.008, -8, 2, 76, 0, null, 0xc9c4ba, { rx: -Math.PI / 2, tile: 1.2 });
  quad('paving', 0, 0.008, 32, 40, 4, 0, null, 0xc9c4ba, { rx: -Math.PI / 2, tile: 1.2 }); // in front of the parade
  { // v2.3 ground variety (decals, no physics): cracked/sunken flags, puddles, kerb weeds, desire paths, patchy grass
    const gr = mulberry32(77), R = (a, b) => a + gr() * (b - a);
    for (let i = 0; i < 26; i++) { const sd = gr() < 0.5 ? -1 : 1, x = sd * R(4.2, 5.8), z = R(-44, 28); quad('flat', x, 0.0095, z, R(0.5, 0.9), 0.025, 0, null, 0x77736a, { rx: -Math.PI / 2 }); if (gr() < 0.5) quad('flat', x, 0.0096, z + 0.2, 0.025, R(0.3, 0.6), 0, null, 0x77736a, { rx: -Math.PI / 2 }); } // cracks
    for (let i = 0; i < 10; i++) { const sd = gr() < 0.5 ? -1 : 1; quad('flat', sd * R(4.3, 5.7), 0.0094, R(-44, 28), 0.6, 0.6, 0, null, 0xa9a397, { rx: -Math.PI / 2 }); } // odd-coloured replacement flags
    for (const [x, z, w, d] of [[-3.2, -18, 1.6, 0.9], [2.6, 6, 1.1, 0.7], [3.4, 27.2, 1.4, 0.8], [-4.4, -36, 0.9, 0.6]]) quad('glass', x, 0.012, z, w, d, 0, null, 0x9fb0bf, { rx: -Math.PI / 2 }); // puddles at the road edge
    for (let i = 0; i < 40; i++) { const sd = gr() < 0.5 ? -1 : 1; solid('flat', sd * R(3.98, 4.06), 0.05, R(-44, 28), 0.08, R(0.06, 0.14), R(0.1, 0.3), gr() < 0.5 ? 0x4f6f2f : 0x6a7a3a, { phys: false }); } // kerb weeds
    for (const [x, z, l, a] of [[-6.5, -20, 6, 0.4], [6.8, -30, 5, -0.3], [-6.4, 18, 5, 0.6], [6.6, 4, 4, -0.5]]) quad('flat', x, 0.007, z, 0.7, l, a, null, 0x7a6f4f, { rx: -Math.PI / 2 }); // worn desire paths across the verges
    for (let i = 0; i < 18; i++) { const sd = gr() < 0.5 ? -1 : 1; quad('flat', sd * R(6.5, 7.6), 0.005, R(-44, 26), R(0.8, 2), R(0.8, 2.5), gr() * 3, null, pick([0x56743a, 0x6d8648, 0x7a8a4a]), { rx: -Math.PI / 2 }); } // patchy grass
  }
  quad('tarmac', 0, 0.005, 28, 40, 4, 0, null, 0x8a8c88, { rx: -Math.PI / 2, tile: 4 });
  // yellow lines + a wee bit of humour on the road
  quad('atlas', 0, 0.01, -20, 3.2, 0.8, 0, atlas.sign('SLOW', '#6a6c68', '#EFE3C8', 4, 'bold 60px "Barlow Condensed", Arial'), 0xffffff, { rx: -Math.PI / 2 });

  // ---------- buildings ----------
  const HARL = [0xc9c6be, 0xbdb9b0, 0xd2cdc2, 0xe6dcc6] /* v2.7: grey pebbledash, one cream block kept for warmth */, PINK = 0xdcc6b6, GREY = 0xc9c7c1;
  // windows + frames on one face. face: '+x' etc. Positions are along the face.
  function windows(face, fx, fz, len, floors, fh, base, { door = null, doorCol = 0x2f5a3a } = {}) {
    const ry = ROT[face], n = Math.max(1, Math.round(len / 3)), bw = len / n;
    const nx = face === '+x' ? 1 : face === '-x' ? -1 : 0, nz = face === '+z' ? 1 : face === '-z' ? -1 : 0, ax = -nz, az = nx;
    for (let i = 0; i < n; i++) for (let j = 0; j < floors; j++) {
      const s = (i + 0.5) * bw - len / 2, x = fx + ax * s, z = fz + az * s, y = base + j * fh + fh * 0.55;
      if (j === 0 && door && door.includes(i)) { // stair door with a canopy
        quad('flat', x + nx * 0.02, base + 1.05, z + nz * 0.02, 1.1, 2.1, ry, null, doorCol);
        solid('flat', x + nx * 0.35, base + 2.35, z + nz * 0.35, nx ? 0.7 : 1.6, 0.08, nz ? 0.7 : 1.6, 0xb8b4ac, { phys: false });
        continue;
      }
      const w = rand() < 0.3 ? 0.9 : 1.3;
      quad('flat', x + nx * 0.015, y, z + nz * 0.015, w + 0.16, 1.36, ry, null, 0xf2f2f0);
      quad('glass', x + nx * 0.025, y, z + nz * 0.025, w, 1.2, ry, null, 0xffffff);
      // v2.3 window variety: lit / net curtains / drawn curtains / blind, sill stain, the odd window box or satellite dish
      const r = rand(), o = (d) => [x + nx * d, z + nz * d];
      if (r < 0.14) { const [qx, qz] = o(0.028); quad('lamp', qx, y, qz, w * 0.92, 1.1, ry, null, 0xffffff); }
      else if (r < 0.36) { const [qx, qz] = o(0.03); quad('flat', qx, y - 0.12, qz, w * 0.95, 0.78, ry, null, pick([0xf0eee6, 0xe8e4d8])); } // net curtains
      else if (r < 0.56) { const c = pick([0x8a3a3a, 0x3a5a8a, 0xb89a4a, 0x5a7a4a, 0x7a5a7a]); for (const sd of [-1, 1]) { const qx = x + nx * 0.03 + ax * sd * w * 0.36, qz = z + nz * 0.03 + az * sd * w * 0.36; quad('flat', qx, y, qz, w * 0.28, 1.15, ry, null, c); } }
      else if (r < 0.68) { const [qx, qz] = o(0.03); quad('flat', qx, y + 0.3, qz, w * 0.95, 0.55, ry, null, pick([0xd9cfa8, 0xbfc8cc])); } // half-down blind
      { const qx = x + nx * 0.012, qz = z + nz * 0.012; quad('flat', qx, y - 0.86, qz, w * 0.7, 0.3, ry, null, 0xa59c8a); } // rain stain under the sill
      if (j > 0 && rand() < 0.08) { solid('flat', x + nx * 0.16, y - 0.68, z + nz * 0.16, nx ? 0.25 : w, 0.18, nz ? 0.25 : w, 0x6a4a2a, { phys: false }); for (let k = 0; k < 4; k++) solid('flat', x + nx * 0.16 + ax * (k - 1.5) * w * 0.22, y - 0.54, z + nz * 0.16 + az * (k - 1.5) * w * 0.22, 0.12, 0.12, 0.12, pick([0xc62d4a, 0xf2c94c, 0xe86fb0, 0x4a8a3a]), { phys: false }); }
      if (j === floors - 1 && rand() < 0.07) { const qx = x + nx * 0.25 + ax * (w * 0.5 + 0.35), qz = z + nz * 0.25 + az * (w * 0.5 + 0.35); B.add('metal', CYL(0.32, 0.32, 10), M4(qx, y + 0.4, qz, 1, 0.05, 1, Math.PI / 2, ry), 0xd8d8d4, {}); solid('metal', qx - nx * 0.15, y + 0.4, qz - nz * 0.15, 0.05, 0.05, 0.05, 0x555555, { phys: false }); }
    }
  }
  function block(x0, x1, z0, z1, h, floors, { col = pick(HARL), roof = 'pitched', front = '-x', doors = [1], back = true, chimneys = 2 } = {}) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    solid('harl', cx, h / 2, cz, w, h, d, col, { tile: 2.5, grime: 0.12 });
    solid('flat', cx, 0.45, cz, w + 0.06, 0.9, d + 0.06, 0x7a6254, { phys: false }); // v2.7: brown render base course, as on the walk-up flats
    const alongZ = d > w, fh = h / floors;
    const faces = alongZ ? [['-x', x0, cz, d], ['+x', x1, cz, d]] : [['-z', cx, z0, w], ['+z', cx, z1, w]];
    faces.forEach(([f, fx, fz, len], k) => { if (k === 1 && !back) return; windows(f, fx, fz, len, floors, fh, 0, { door: f === front ? doors : null, doorCol: pick([0x2f5a3a, 0x8e1c1c, 0x1d3b6b, 0x5a4a32]) }); });
    if (roof === 'pitched') {
      const rh = (alongZ ? w : d) * 0.32;
      B.add('roof', ROOF, M4(cx, h, cz, alongZ ? w + 0.5 : d + 0.5, rh, alongZ ? d + 0.4 : w + 0.4, 0, alongZ ? 0 : Math.PI / 2), 0x7d8088, { tile: 2 });
      for (let i = 0; i < chimneys; i++) { const t = (i + 0.5) / chimneys - 0.5; solid('harl', cx + (alongZ ? 0 : t * w * 0.9), h + rh * 0.8, cz + (alongZ ? t * d * 0.9 : 0), 1.1, 2.2, 0.7, col, { phys: false, tile: 2 });
        for (const dd of [-0.25, 0.25]) cyl('flat', cx + (alongZ ? 0 : t * w * 0.9) + (alongZ ? 0 : dd), h + rh * 0.8 + 1.25, cz + (alongZ ? t * d * 0.9 + dd : 0), 0.1, 0.12, 0.35, 0xa0522d, { phys: false, seg: 6 }); }
    } else { // post-war flat roof with a parapet and felt
      solid('flat', cx, h + 0.15, cz, w + 0.2, 0.3, d + 0.2, 0x9a978f, { phys: false });
      solid('flat', cx, h + 0.31, cz, w - 0.4, 0.04, d - 0.4, 0x3a3b3d, { phys: false });
    }
    // gutters + downpipes on the front
    const fx = front === '-x' ? x0 - 0.08 : front === '+x' ? x1 + 0.08 : cx, fz = front === '-z' ? z0 - 0.08 : front === '+z' ? z1 + 0.08 : cz;
    if (roof === 'pitched') solid('flat', fx, h - 0.05, fz, front.includes('x') ? 0.12 : w, 0.12, front.includes('x') ? d : 0.12, 0x2b2d30, { phys: false });
    for (const t of [-0.48, 0.48]) solid('flat', fx + (front.includes('z') ? t * w : 0), h / 2, fz + (front.includes('x') ? t * d : 0), 0.1, h, 0.1, 0x2b2d30, { phys: false });
  }
  // West side (+x): three-storey pitched-roof block, drying green on a bank, post-war flat-roofed block
  block(11, 20, -36, -12, 9, 3, { col: HARL[0], doors: [1, 6] });
  block(13.5, 22, 5, 26, 9, 3, { col: PINK, roof: 'flat', doors: [2, 5] });
  // East side (-x): four-in-a-block cottage flats with front gardens; lock-up garages; communal bins
  block(-18, -10, -34, -22, 6, 2, { col: HARL[1], front: '+x', doors: [0, 3], chimneys: 1 });
  block(-18, -10, -18, -6, 6, 2, { col: HARL[2], front: '+x', doors: [0, 3], chimneys: 1 });
  // front garden walls (harled, low) with gate gaps + hedges
  for (const [z0, z1] of [[-35, -21], [-19, -5]]) {
    const gate = (z0 + z1) / 2;
    solid('harl', -7.6, 0.4, (z0 + gate - 0.7) / 2, 0.3, 0.8, gate - 0.7 - z0, HARL[3], { tile: 1.5 });
    solid('harl', -7.6, 0.4, (gate + 0.7 + z1) / 2, 0.3, 0.8, z1 - gate - 0.7, HARL[3], { tile: 1.5 });
    solid('flat', -9.2, 0.55, (z0 + z1) / 2, 0.9, 1.1, z1 - z0 - 1, 0x3e5a2c, { phys: false }); // privet hedge behind the wall
  }
  // lock-up garages: a row of 6 with up-and-over doors, flat roof, facing the road
  const GZ0 = 3, GN = 6, GW = 3;
  solid('brick', -13.5, 1.35, GZ0 + GN * GW / 2, 7, 2.7, GN * GW, 0xffffff, { tile: 2, grime: 0.2 }); // v2.0 brick lock-ups
  solid('flat', -13.4, 2.78, GZ0 + GN * GW / 2, 7.4, 0.16, GN * GW + 0.3, 0x55575a, { phys: false });
  const doorCols = [0x2e9c8f, 0xf7c325, 0x3f6fa8, 0x6f8f4a, 0xd9d2c0]; // v2.0: Garage Teal, Chip-Shop Yellow, faded blue, green, cream
  for (let i = 0; i < GN; i++) {
    const z = GZ0 + (i + 0.5) * GW;
    if (i === 3) continue; // the target door is built below
    quad('garage', -9.98, 1.05, z, 2.4, 2.1, Math.PI / 2, null, doorCols[i % doorCols.length], { grime: 0.25 });
    quad('flat', -9.97, 2.05, z, 2.4, 0.08, Math.PI / 2, null, 0x3a3a3a);
  }
  sign('LOCK-UPS 1-6  NO PARKING', -9.97, 2.45, GZ0 + 1.5, 2.6, 0.32, Math.PI / 2, '#f4f1ea', '#a01818', 'bold 52px Arial', '#a01818');

  // ---------- the drying green: raised lawn up a grassy bank, with poles and a washing line ----------
  const { x0: bx0, x1: bx1, rise, z0: bz0, z1: bz1 } = BANK;
  const L = Math.hypot(bx1 - bx0, rise), a = Math.atan2(rise, bx1 - bx0), T = 1.5;
  const bcx = (bx0 + bx1) / 2 + Math.sin(a) * T / 2, bcy = rise / 2 - Math.cos(a) * T / 2;
  boxBody(bcx, bcy, (bz0 + bz1) / 2, L, T, bz1 - bz0, { rz: a, surface: 'grass' });
  B.add('flat', QUAD, M4((bx0 + bx1) / 2, rise / 2 + 0.01, (bz0 + bz1) / 2, L, bz1 - bz0, 1, -Math.PI / 2, 0, a), 0x6a8a44, {}); // sloped lawn
  solid('flat', (bx1 + 25) / 2, rise / 2, (bz0 + bz1) / 2, 25 - bx1, rise, bz1 - bz0, 0x6a8a44, { surface: 'grass' }); // the green itself
  solid('harl', (bx1 + 25) / 2, rise / 2 - 0.05, bz0 - 0.15, 25 - bx1, rise + 0.3, 0.3, HARL[3], { tile: 1.5 }); // retaining wall edges
  solid('harl', (bx1 + 25) / 2, rise / 2 - 0.05, bz1 + 0.15, 25 - bx1, rise + 0.3, 0.3, HARL[3], { tile: 1.5 });
  const POLES = [[19, -6.2], [19, -1.8]];
  for (const [px, pz] of POLES) { cyl('metal', px, rise + 1.1, pz, 0.05, 0.06, 2.2, 0x6c7378, { seg: 6, target: null }); solid('metal', px, rise + 2.2, pz, 0.06, 0.06, 0.8, 0x6c7378, { phys: false }); }
  for (const dz of [-0.3, 0, 0.3]) solid('flat', 19 + dz, rise + 2.18, -4, 0.01, 0.01, 4.4, 0xdddddd, { phys: false }); // lines
  sign('DRYING GREEN · RESIDENTS ONLY', 24.9, rise + 0.9, -4, 1.8, 0.24, -Math.PI / 2, '#f4f1ea', '#111', 'bold 46px Arial', '#111');

  // ---------- v2.1 The Pilton Parade (see pilton-parade.js) ----------
  const { counter: COUNTER } = buildParade({ solid, quad, atlas, cyl, windows, V, boxBody });

  // ---------- street furniture ----------
  function lamp(x, z, side, target = null) { // concrete column, swan-neck head
    cyl('flat', x, 3, z, 0.09, 0.14, 6, 0xb9b7ae, { seg: 6, target });
    for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI / 2; solid('flat', x - side * (0.3 - Math.cos(a) * 0.3), 6 + Math.sin(a) * 0.3, z, 0.09, 0.14, 0.12, 0xb9b7ae, { phys: false, rz: side * a }); } // v2.7: true swan neck
    solid('flat', x - side * 0.65, 6.3, z, 0.7, 0.08, 0.12, 0xb9b7ae, { phys: false, rz: side * -0.08 });
    solid('flat', x - side * 1.05, 6.22, z, 0.55, 0.12, 0.26, 0x8f8d86, { phys: false }); solid('lamp', x - side * 1.05, 6.14, z, 0.45, 0.05, 0.2, 0xffffff, { phys: false });
  }
  for (let z = -40; z <= 24; z += 16) { if (z !== 24) lamp(5.6, z, 1); if (z !== -8 && z !== 24) lamp(-5.6, z + 8, -1); }
  lamp(4.3, 24, 1); lamp(-4.6, 30.3, -1); // v2.3: moved to the kerb so they don't stand in front of the shopfronts
  // bins: green wheelies by the cottage-flat gates; big communal bins by the garages
  function wheelie(x, z, col, ry = 0) { solid('flat', x, 0.5, z, 0.6, 1.0, 0.72, col, { ry }); solid('flat', x, 1.02, z, 0.66, 0.06, 0.78, new THREE.Color(col).multiplyScalar(0.8), { phys: false, ry }); }
  // v2.7: commercial 1100-litre bins (grey, domed lids, four castors) and a concrete kerb island with bollards
  function bigBin(x, z, col) { solid('flat', x, 0.62, z, 1.25, 1.0, 1.0, col, { surface: 'plastic' }); B.add('flat', new THREE.CylinderGeometry(0.52, 0.52, 1.3, 10, 1, false, -Math.PI / 2, Math.PI), M4(x, 1.12, z, 1, 1, 0.6, 0, 0, Math.PI / 2), new THREE.Color(col).multiplyScalar(0.85), {});
    for (const [dx, dz] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) cyl('flat', x + dx, 0.07, z + dz, 0.07, 0.07, 0.1, 0x1a1a1a, { phys: false, seg: 6 }); }
  bigBin(-9.2, -44.6, 0x6f7472); bigBin(-10.8, -44.6, 0x2e5a34);
  solid('flat', 0, 0.07, -43.5, 1.4, 0.14, 4, 0xb4b0a6, { phys: false }); boxBody(0, 0.07, -43.5, 1.4, 0.14, 4, { surface: 'paving' });
  for (const dz of [-1.6, 1.6]) { cyl('flat', 0, 0.55, -43.5 + dz, 0.12, 0.14, 0.9, 0xe8e6e0, { seg: 8 }); cyl('flat', 0, 0.82, -43.5 + dz, 0.125, 0.125, 0.12, 0x1d3b6b, { phys: false, seg: 8 }); }
  for (let k = 0; k < 4; k++) cyl('flat', -5.2, 0.4, -44 + k * 1.6, 0.13, 0.15, 0.8, 0xc9c6bc, { seg: 6 }); // concrete bollards at the kerb
  wheelie(-6.6, -31.5, 0x2e5a34); wheelie(-6.6, -14.2, 0x1d1f1f); wheelie(-6.6, -10.8, 0x2e5a34);
  // grass verges with "keep off" humour, a bench, the bus stop and a trolley
  sign('DOGS MUST BE KEPT ON A LEAD', 7.3, 0.85, -40, 2.4, 0.3, -Math.PI / 2, '#1d3b6b', '#fff', 'bold 30px Arial', '#fff');
  cyl('metal', 7.3, 0.4, -40, 0.03, 0.03, 0.8, 0x333333, { phys: false, seg: 4 });
  // boundary: hedges + fences (and invisible walls so you can't wander off the map)
  solid('flat', 0, 0.6, -47, 60, 1.2, 1, 0x3e5a2c); solid('flat', 28, 0.6, -10, 1, 1.2, 74, 0x3e5a2c); solid('flat', -28, 0.6, -10, 1, 1.2, 74, 0x3e5a2c);
  for (const [x, z, w, d] of [[0, -47, 60, 1], [28, -2, 1, 90], [-28, -2, 1, 90], [0, 43, 60, 1]]) boxBody(x, 3, z, w, 6, d); // v2.5: side walls now reach the back wall (z 27-43 gap let you walk out to the Forth)
  solid('flat', -21, 0.6, 33, 14, 1.2, 1, 0x3e5a2c); solid('flat', 21, 0.6, 33, 14, 1.2, 1, 0x3e5a2c);

  // ---------- distant views: Forth, Fife, gasholder frame, the tower blocks ----------
  { // v2.3: stylised Edinburgh skyline to the south / south-east (Castle on its rock ~SSE, Arthur's Seat ~SE). East is -x here.
    const card = (draw, w, h, bearingDeg, dist, size, col) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; draw(g, w, h);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * h / w), new THREE.MeshBasicMaterial({ map: tx, color: col, transparent: true, alphaTest: 0.3, fog: false, depthWrite: false }));
      const b = bearingDeg * Math.PI / 180; m.position.set(-Math.sin(b) * dist, size * h / w / 2 - 6, Math.cos(b) * dist); m.lookAt(0, m.position.y, 0); m.renderOrder = -1; m.name = 'skyline'; scene.add(m); return m;
    };
    card((g, w, h) => { // castle rock + castle
      g.beginPath(); g.moveTo(0, h); g.bezierCurveTo(w * 0.15, h * 0.75, w * 0.25, h * 0.55, w * 0.35, h * 0.5); g.lineTo(w * 0.7, h * 0.48); g.bezierCurveTo(w * 0.8, h * 0.5, w * 0.85, h * 0.7, w, h); g.fill();
      const blk = (x, y, bw, bh) => g.fillRect(w * x, h * y, w * bw, h * bh);
      blk(0.36, 0.34, 0.12, 0.17); blk(0.47, 0.28, 0.1, 0.23); blk(0.56, 0.36, 0.14, 0.15); blk(0.5, 0.2, 0.025, 0.1); // halls, palace, tower
      for (let i = 0; i < 12; i++) blk(0.36 + i * 0.03, 0.31, 0.015, 0.03); // crenellations
      blk(0.512, 0.12, 0.003, 0.08); g.fillRect(w * 0.515, h * 0.12, w * 0.03, h * 0.025); // flagpole + flag
    }, 512, 256, 154, 430, 120, 0x7f8a97);
    card((g, w, h) => { // Arthur's Seat: the lion's head and haunch, Salisbury Crags below
      g.beginPath(); g.moveTo(0, h); g.bezierCurveTo(w * 0.1, h * 0.8, w * 0.2, h * 0.7, w * 0.3, h * 0.62); g.lineTo(w * 0.36, h * 0.6); g.bezierCurveTo(w * 0.42, h * 0.5, w * 0.5, h * 0.25, w * 0.56, h * 0.22);
      g.bezierCurveTo(w * 0.6, h * 0.24, w * 0.62, h * 0.38, w * 0.66, h * 0.45); g.bezierCurveTo(w * 0.78, h * 0.52, w * 0.9, h * 0.75, w, h); g.fill();
      g.fillRect(w * 0.08, h * 0.78, w * 0.3, h * 0.22);
    }, 512, 200, 132, 470, 200, 0x8d98a4);
  }
  B.add('flat', QUAD, M4(0, -0.6, 330, 1400, 400, 1, -Math.PI / 2), 0x6f8796, {}); // the Forth
  for (let i = 0; i < 9; i++) { const x = -600 + i * 150 + rand() * 60, h = 25 + rand() * 30; B.add('flat', new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, -1, 560 + rand() * 40, 120 + rand() * 80, h, 40), 0x6d7d6a, {}); } // Fife hills
  { const gx = 60, gz = 150, R = 22, N = 12; // Granton gasholder guide frame (the survivor), dark green-grey lattice
    for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; B.add('metal', CYL(0.5, 0.6, 5), M4(gx + Math.cos(t) * R, 21, gz + Math.sin(t) * R, 1, 42, 1), 0x4f5a55, {}); }
    for (const y of [10, 20, 30, 41]) for (let i = 0; i < N; i++) { const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2, xa = gx + Math.cos(t0) * R, za = gz + Math.sin(t0) * R, xb = gx + Math.cos(t1) * R, zb = gz + Math.sin(t1) * R;
      B.add('metal', BOX, M4((xa + xb) / 2, y, (za + zb) / 2, 0.6, 0.8, Math.hypot(xb - xa, zb - za), 0, Math.atan2(xb - xa, zb - za)), 0x4f5a55, {});
      if (y < 41) B.add('metal', BOX, M4((xa + xb) / 2, y + 5, (za + zb) / 2, 0.3, 0.3, Math.hypot(xb - xa, zb - za) * 1.35, Math.PI / 4.5, Math.atan2(xb - xa, zb - za)), 0x4f5a55, {}); }
  }
  // ten-storey towers to the south-east (Inchcolm / Inchgarvie style) + a 16-storey (Northview style)
  for (const [x, z, h] of [[-75, 60, 30], [-95, 40, 30], [70, 70, 48]]) { solid('harl', x, h / 2, z, 16, h, 12, 0xd2cdc2, { phys: false, tile: 4 }); for (let y = 2; y < h; y += 3) solid('glass', x, y, z - 6.02, 14, 1.1, 0.04, 0xffffff, { phys: false }); }
  for (let i = 0; i < 40; i++) { const x = (rand() - 0.5) * 260, z = 60 + rand() * 50; if (Math.abs(x) < 34 && z < 70) continue; const w = 10 + rand() * 12, h = 6 + rand() * 4;
    B.add('harl', BOX, M4(x, h / 2, z, w, h, 8), pick(HARL), {}); B.add('roof', ROOF, M4(x, h, z, w, 2.4, 8.4, 0, Math.PI / 2), 0x6f737a, {}); }

  // ---------- targets ----------
  const ringGeo = new THREE.RingGeometry(1, 1.1, 32);
  function addTarget(t) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r);
    m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m;
    if (t.zone) t.zoneInv = new THREE.Matrix4();
    t.done = false; targets.push(t); return t;
  }
  // dark liner + pale rim so the opening reads as an open top (visual only)
  function darkInside(x, y0, z, w, d, h, th) {
    const k = 0x161a17, e = th / 2 + 0.006, iw = w - th - 0.012, id = d - th - 0.012;
    solid('flat', x, y0 + 0.006, z, iw, 0.01, id, k, { phys: false });
    solid('flat', x - w / 2 + e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false }); solid('flat', x + w / 2 - e, y0 + h / 2, z, 0.006, h - 0.03, id, k, { phys: false });
    solid('flat', x, y0 + h / 2, z - d / 2 + e, iw, h - 0.03, 0.006, k, { phys: false }); solid('flat', x, y0 + h / 2, z + d / 2 - e, iw, h - 0.03, 0.006, k, { phys: false });
    for (const [sx, sz, ww, dd] of [[-1, 0, th + 0.02, d + 0.02], [1, 0, th + 0.02, d + 0.02], [0, -1, w + 0.02, th + 0.02], [0, 1, w + 0.02, th + 0.02]])
      solid('flat', x + sx * w / 2, y0 + h + 0.012, z + sz * d / 2, ww, 0.025, dd, 0x9aa39a, { phys: false });
  }
  const bin = (x, z, w, d, h, c, id) => { // hollow bin: floor + 4 thin walls; the zone is the inside
    const th = 0.06;
    solid('flat', x, 0.05, z, w, 0.1, d, c);
    solid('flat', x - w / 2, h / 2, z, th, h, d, c); solid('flat', x + w / 2, h / 2, z, th, h, d, c);
    solid('flat', x, h / 2, z - d / 2, w, h, th, c); solid('flat', x, h / 2, z + d / 2, w, h, th, c);
    darkInside(x, 0.1, z, w, d, h - 0.1, th);
    return new THREE.Box3(V(x - w / 2, 0.1, z - d / 2), V(x + w / 2, h, z + d / 2));
  };
  // 1. Garage door (easy): the one with the goal painted on it
  { const z = GZ0 + 3.5 * GW;
    solid('wood', -10.05, 1.05, z, 0.1, 2.1, 2.4, 0x8e1c1c, { target: 'garage' });
    quad('atlas', -9.99, 1.05, z, 2.4, 2.1, Math.PI / 2, atlas.draw(256, 224, (g) => { g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, 256, 224); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(28, 30, 200, 194); g.beginPath(); g.moveTo(28, 110); g.lineTo(228, 110); g.stroke(); for (let y = 0; y < 224; y += 22) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y, 256, 3); } g.fillStyle = '#c8102e'; g.font = 'bold 26px Arial'; g.fillText('No 4  - SHOOT HERE', 40, 80); }));
    addTarget({ id: 'garage', name: 'Garage Door No.4', hint: 'skelp the painted goal', points: 40, cash: 40, diff: 'easy', tier: 'easy', kind: 'hit', pos: V(-9.6, 0, z), ringR: 1.3, stand: V(-3, 0, z), aim: V(-10, 0.6, z),
      lines: ["BOOM! Wee Tam's da is coming oot.", 'Top bins! Well... middle bins.', 'That door has taken a few.'] }); }
  // 2. Shopping trolley on the verge (easy) - v1.9: moved next to spawn so the first target you meet is easy
  { const x = -6.6, z = -25;
    for (const [w, h, d, y] of [[0.6, 0.04, 0.9, 0.3], [0.6, 0.5, 0.03, 0.6], [0.03, 0.5, 0.9, 0.6]]) for (const o of (d < 0.1 ? [-0.45, 0.45] : w < 0.1 ? [-0.3, 0.3] : [0])) solid('metal', x + (w < 0.1 ? o : 0), y, z + (d < 0.1 ? o : 0), w, h, d, 0xa7adb2, { phys: false, rz: 0.12 });
    solid('flat', x, 0.86, z - 0.5, 0.6, 0.06, 0.06, 0xd0302a, { phys: false });
    boxBody(x, 0.55, z, 0.62, 0.9, 0.92, { target: 'trolley' });
    addTarget({ id: 'trolley', name: 'Abandoned Trolley', hint: 'hit the trolley', points: 50, cash: 50, diff: 'easy', tier: 'easy', kind: 'hit', pos: V(x, 0, z), ringR: 1.0, stand: V(-3.2, 0, z), aim: V(x, 0.5, z),
      lines: ['Clang! Take it back for the pound.', "It's been there since 1997. Respect.", 'Supermarket sweep!'] }); }
  // 3. Bus stop shelter (medium)
  { const x = 5.6, z = -2;
    solid('metal', x + 0.55, 2.45, z, 1.3, 0.08, 3.2, 0x2d3a4a, { phys: false });
    for (const dz of [-1.5, 1.5]) solid('metal', x + 0.55, 1.2, z + dz, 1.2, 2.4, 0.05, 0x2d3a4a);
    solid('glass', x + 1.15, 1.25, z, 0.04, 2.2, 3.0, 0xffffff, { target: 'busstop' });
    boxBody(x + 0.55, 1.2, z, 1.25, 2.4, 3.1, { target: 'busstop' });
    cyl('metal', x - 0.4, 1.5, z + 2.2, 0.05, 0.05, 3, 0x333333, { seg: 6, target: 'busstop' });
    sign('BUS STOP  21 27 37', x - 0.4, 2.75, z + 2.2, 0.55, 0.42, -Math.PI / 2, '#c8102e', '#fff', 'bold 40px Arial', '#fff');
    sign('NEXT BUS: AYE, RIGHT', x + 1.12, 2.1, z, 1.8, 0.24, -Math.PI / 2, '#111', '#ffb000', 'bold 44px Courier New');
    addTarget({ id: 'busstop', name: 'Bus Stop', hint: 'hit the shelter', points: 75, cash: 75, diff: 'medium', tier: 'easy', kind: 'hit', pos: V(x + 0.5, 0, z), ringR: 1.6, stand: V(1.2, 0, z), aim: V(x + 0.6, 1.0, z),
      lines: ["Three 21s turn up at once.", "Driver: 'Exact fare, pal.'", 'Shelter rattled. Nae bus, mind.'] }); }
  // 4. Lamppost (medium): the one with a missing-cat poster
  { const x = -5.6, z = 0; lamp(x, z, -1, 'lamp'); quad('atlas', x + 0.15, 1.6, z, 0.3, 0.4, Math.PI / 2, atlas.sign('LOST CAT', '#fff', '#111', 0.75, 'bold 30px Arial'));
    addTarget({ id: 'lamp', name: 'Lamppost (lost cat)', hint: 'ping the post', points: 75, cash: 75, diff: 'medium', tier: 'easy', kind: 'hit', pos: V(x, 0, z), ringR: 0.8, stand: V(-2.2, 0, z), aim: V(x, 0.6, z),
      lines: ['PING! The cat has not been found.', 'Concrete clang!', 'Off the post and doon.'] }); }
  // 5. Communal bin by the garages (medium chip)
  { const x = -7.4, z = 24.5; const zone = bin(x, z, 1.3, 1.0, 1.25, 0x3f5a3f);
    solid('flat', x - 0.79, 1.68, z, 0.06, 0.9, 1.0, 0x2f4a2f, { rz: 0.3 }); // open lid, hinged at the back (away from the street)
    sign('RECYCLING', x + 0.66, 0.75, z, 0.9, 0.18, Math.PI / 2, '#2f4a2f', '#fff', 'bold 60px Arial');
    addTarget({ id: 'bin', name: 'Communal Bin', hint: 'chip it IN the bin', points: 100, cash: 100, diff: 'medium', tier: 'tricky', kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 1.3, stand: V(-3.0, 0, z), aim: V(x, 0.6, z), zone,
      lines: ['In the bucket! The cooncil thanks you.', 'Recycling? Close enough.', 'Bin day came early.'] }); }
  solid('flat', 19, rise + 1.4, -5.0, 0.04, 1.44, 1.8, 0xf2efe6, { phys: true }); // Mrs Kerr's sheets on the line: only a gap in the middle
  solid('flat', 19, rise + 1.4, -2.6, 0.04, 1.44, 1.0, 0x7fa3c9, { phys: true });
  // 6. Drying green: through the poles (hard), up the bank
  addTarget({ id: 'gap', name: 'Drying Green Poles', hint: 'kick it between the poles (up the bank)', points: 125, cash: 125, diff: 'hard', tier: 'tricky', kind: 'zone', pos: V(19, rise, -4), ringR: 1.0, stand: V(14.5, rise, -4), aim: V(22, rise + 0.3, -3.6),
    zone: new THREE.Box3(V(19.08, rise, -5.9), V(19.5, rise + 2.1, -2.1)), minSpeed: 1, // just past the line, so the sheets count
    lines: ["Through the posts! Mind Mrs Kerr's sheets.", 'GOAL! The washing applauds.', 'Wembley? Naw. Pilton drying green.'] });
  // 7. Wheelie bin chip (hard): open green wheelie by the gate
  { const x = 7.6, z = 12; const zone = bin(x, z, 0.8, 0.9, 1.0, 0x2e5a34); zone.max.y += 0.4; // v1.9: swapped with the trolley (was right by spawn)
    solid('flat', x + 0.47, 1.25, z, 0.06, 0.55, 0.84, 0x244a2a, { rz: -0.5 }); // lid flipped open at the back
    addTarget({ id: 'wheelie', name: 'Green Wheelie Bin', hint: 'chip it in the wee bin (hard!)', points: 150, cash: 150, diff: 'hard', tier: 'tricky', kind: 'zone', openTop: true, pos: V(x, 0, z), ringR: 0.8, stand: V(4.0, 0, z), aim: V(x, 0.6, z), zone,
      lines: ['Garden waste: ONE football. Lovely.', 'Chipped in! Messi who?', 'Brown bin? Naw, green. Still counts.'] }); }
  // 8. "NO BALL GAMES" sign on the block (cheeky, hard)
  { const x = 10.94, y = 2.4, z = -24;
    sign('NO BALL GAMES', x, y, z, 1.4, 0.5, -Math.PI / 2, '#f4f1ea', '#c8102e', 'bold 54px Arial', '#c8102e');
    sign('BY ORDER - CITY OF EDINBURGH COUNCIL', x, y - 0.36, z, 1.4, 0.14, -Math.PI / 2, '#f4f1ea', '#222', 'bold 30px Arial');
    boxBody(x - 0.02, y + 0.03, z, 0.06, 0.32, 0.62, { target: 'noballs' });
    addTarget({ id: 'noballs', name: "'No Ball Games' Sign", hint: 'hit the sign. Go on.', points: 125, cash: 125, diff: 'hard', tier: 'tricky', kind: 'hit', pos: V(x - 0.4, 0, z), ringR: 1.0, stand: V(6.2, 0, z), aim: V(x, y, z),
      lines: ['Ironic. Very ironic.', "Mrs Kerr's at the windae. RUN.", 'The council will be hearing aboot this.'] }); }

  // ---------- optional CHALLENGES (experimental): hidden, hard, separate from the 8 targets ----------
  const challenges = [];
  const addChallenge = (t) => { addTarget(t); targets.pop(); t.challenge = true; t.tier = 'legend'; challenges.push(t); return t; };
  // C1. Garage roof: lob it up onto the lock-up roof (and keep it there long enough to count)
  { const yR = 2.86; solid('flat', -13.4, yR + 0.12, GZ0 + 0.1, 7.4, 0.12, 0.14, 0x55575a, { phys: true }); // wee upstand at the back edge
    addChallenge({ id: 'c_roof', name: 'On the Lock-up Roof', hint: 'there\'s a ba\' up there already...', points: 0, cash: 100, kind: 'zone', pos: V(-13.4, yR, GZ0 + GN * GW / 2), ringR: 1.6,
      stand: V(-2.5, 0, 9), aim: V(-16.0, yR + 0.3, 4.6), zone: new THREE.Box3(V(-16.9, yR, GZ0 + 0.2), V(-15.4, yR + 0.45, GZ0 + 2.8)), maxSpeed: 2.5, // by the old burst ba' at the far corner
      lines: ["It's up there wi' the other forty balls.", "Wee Tam's da: 'That's comin' oot yer pocket money.'"] }); }
  { const old = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.55, 1), new THREE.MeshLambertMaterial({ color: 0x9a6a3a })); old.position.set(-15.8, 3.0, 5.2); scene.add(old); } // clue: an old burst ba' already up there
  // C2. Mrs Kerr's open upstairs windae (2nd floor of the pitched-roof block)
  { const x = 10.96, y = 4.65, z = -28.5;
    quad('flat', x - 0.005, y, z, 1.45, 1.5, -Math.PI / 2, null, 0xf2f2f0);
    quad('flat', x - 0.012, y - 0.08, z, 1.2, 1.1, -Math.PI / 2, null, 0x0f1012); // open: dark room behind
    quad('glass', x - 0.016, y + 0.42, z, 1.2, 0.5, -Math.PI / 2, null, 0xffffff); // sash pushed up
    quad('flat', x - 0.02, y - 0.1, z + 0.45, 0.25, 0.9, -Math.PI / 2, null, 0xd77a9a); // curtain blowing
    solid('flat', x - 0.1, y - 0.7, z, 0.2, 0.08, 1.45, 0xd8d4cc, { phys: false }); // sill
    boxBody(x - 0.03, y - 0.15, z, 0.06, 0.36, 0.4, { target: 'c_window' });
    addChallenge({ id: 'c_window', name: "Mrs Kerr's Windae", hint: 'somebody\'s left their windae open', points: 0, cash: 100, kind: 'hit', pos: V(x - 0.6, 0, z), ringR: 1.0, stand: V(4.5, 0, z), aim: V(x, y, z),
      lines: ["MRS KERR: 'WHO KICKED THAT?!'", 'Straight in the front room. Mind the good china.'] }); }
  // C3. Long-range drying green: through the poles from the far pavement (14 m+, up the bank)
  addChallenge({ id: 'c_longpoles', name: 'Worldie Through the Poles', hint: 'the big boys shoot from the far pavement', points: 0, cash: 100, kind: 'zone', pos: V(-4.6, 0, -4), ringR: 0.8,
    stand: V(-4.6, 0, -4), aim: V(22, rise + 0.3, -3.6), minRange: 14, rangeFrom: V(19, rise, -4), zone: new THREE.Box3(V(19.08, rise + 0.2, -3.95), V(19.5, rise + 1.6, -3.25)), minSpeed: 1,
    lines: ['WORLDIE! Fiona would be proud.', 'From there?! Absolute screamer.'] });
  // faint sparkles mark the challenge spots (one Points draw call)
  const spk = new THREE.Points(new THREE.BufferGeometry().setFromPoints([V(-13.4, 3.5, 12), V(10.7, 4.9, -28.5), V(-4.6, 0.25, -4)]),
    new THREE.PointsMaterial({ color: 0xfff2b0, size: 0.22, transparent: true, opacity: 0.5, depthWrite: false }));
  spk.name = 'challengeSparkles'; scene.add(spk);

  // ---------- gulls & pigeons (same instanced system as the Grassmarket) ----------
  const groups = [[-1, 0, -24], [2, 0, 20], [17, rise, -6]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, c.y + 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });

  // ---------- materials + build ----------
  const materials = makeMaterials(P, new THREE.Texture(), atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.harl = tm(harlTextureV2()); materials.brick = tm(brickTexture()); materials.garage = tm(garageDoorTexture()); materials.tarmac = tm(tarmacTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  { const rr = mulberry32(2707); // v2.7: oil stains and worn patches on the road, gutter dirt along the kerbs
    for (let k = 0; k < 22; k++) { const x = (rr() - 0.5) * 8, z = -44 + rr() * 66, w = 1.5 + rr() * 3; B.add('grime', QUAD, M4(x, 0.012, z, w, w * 0.7, 1, -Math.PI / 2, rr() * 3), 0xffffff, { uvRect: GRIME_UV[rr() < 0.6 ? 1 : 0] }); }
    for (const sx of [-1, 1]) for (let k = 0; k < 9; k++) B.add('grime', QUAD, M4(sx * 4.3, 0.013, -44 + k * 7.5, 1.0, 5, 1, -Math.PI / 2), 0xffffff, { uvRect: GRIME_UV[3] }); }
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [0, -36, 180, -8], midstreet: [0, 0, 180, -4], terrace: [15, -4, -90, 2, rise + 0.9] };
  return { targets, challenges, sparkles: spk, dynamics, pigeons: pig, materials, batches, views, counter: COUNTER };
}

// v2.4: what's under foot / under the ball (cheap zone lookup, matches the ground layout above)
const PUDDLES = [[-3.2, -18, 1.6, 0.9], [2.6, 6, 1.1, 0.7], [3.4, 27.2, 1.4, 0.8], [-4.4, -36, 0.9, 0.6]];
export function surfaceAt(x, z) {
  for (const [px, pz, w, d] of PUDDLES) if (Math.abs(x - px) < w / 2 && Math.abs(z - pz) < d / 2) return 'puddle';
  const ax = Math.abs(x);
  if (z >= 30 && z <= 34.5 && ax < 20) return 'paving'; // parade frontage
  if (z >= 26 && z < 30 && ax < 20) return 'tarmac'; // service road by the parade
  if (z < 30 && ax < 4) return 'tarmac';
  if (z < 30 && ax <= 6) return 'paving';
  return 'grass';
}
export default {
  id: 'pilton', surfaceAt,
  sounds: { fryer: { x: -9, z: 33.6 }, birds: [[19, -4], [-1, -24], [2, 20], [-20, -10], [22, 10]], gulls: [[0, 60], [30, 40], [-30, 50]], far: [[-60, -30], [55, 60], [40, -60], [-50, 40]], roadX: 45 }, name: 'West Pilton', short: 'Pilton',
  blurb: 'Level 2: a kickabout round the back o\' the flats in West Pilton. 8 targets, from easy to pure gallus.',
  intro: "Welcome tae West Pilton!<br><small>Ba' at your feet. Easy first one: the auld trolley just up the street on your right.</small>",
  build, spawn: [0, 0.5, -38], spawnYaw: 180,
  ballHomes: () => [[0.3, 0.4, -35.6], [14.8, 1.6, -2], [-2, 0.4, 26]],
  bounds: { x: 30, zMin: -50, zMax: 46 },
  next: 'granton',
};
