// Level 1: Pennywell Road (v3.2). Where Chris grew up: the 1960s Pennywell shopping centre (flats above the shops, the
// library through the back), then up Pennywell Road past the Old Kirk (left) and St Paul's (right) to Craigroyston High
// School at the top. Light roughcast harling, precast concrete, tarmac with bitumen seams, concrete kerbs, grass verges and
// green palisade railings. All shop names are fictional. NEW twist: the school gates are a goal - kick it through them.
// North = +z (up the road). Ground is y = 0 everywhere.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Batcher, QUAD, roofPrism } from '../batch.js';
import { facadeAtlas, FACADE, SignAtlas, drawTargetDoor, slabTexture, tarmacTexture, roughcastTexture, concretePanelTexture, copperTexture, stoneTexture, gasBrickTexture, grassTexture, GRIME_UV } from '../textures.js';
import { makeMaterials, mulberry32, mergeSimple } from '../world.js';

export const PW = { PARADE: -32, ROAD: 4, PAVE: 7, VERGE: 11.5, TOPZ0: 36, TOPZ1: 43, FENCE: 45, XW: 29 };
const G_PLAYER = 2, G_PWALL = 8;

function build(scene, world, mats, P) {
  const rand = mulberry32(1958), pick = (a) => a[Math.floor(rand() * a.length)];
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
  const { PARADE: PF, ROAD: RW, PAVE: PV, VERGE: VG, TOPZ0, TOPZ1, FENCE: FZ, XW } = PW, ACC = 0x4E8A3A, PAL = 0x3f6b3a, IRON = 0x24262a;
  const vt = (base = 0xf0ece4) => { const c = new THREE.Color(base), k = 0.86 + rand() * 0.18; return c.setRGB(c.r * k, c.g * k, c.b * (k + (rand() - 0.5) * 0.05)).getHex(); };
  const HARL = [0xf2f1ec, 0xe9e8e2, 0xeeebe3, 0xe4e3dc, 0xf4f2ea, 0xdedcd4];
  // uPVC-framed window: pane (dark glass, or a warm lit room), white frame + mullion, concrete sill, sometimes curtains
  const win = (x, y, z, ry, w = 1.8, h = 1.4, lit = rand() < 0.22) => { const nx = Math.sin(ry), nz = Math.cos(ry), ax = Math.cos(ry), az = -Math.sin(ry), P2 = (o, u = 0, v = 0) => [x + nx * o + ax * u, y + v, z + nz * o + az * u];
    B.add(lit ? 'interior' : 'glass', QUAD, M4(...P2(0.01), w, h, 1, 0, ry), lit ? pick([0xe8c98a, 0xdcc49a, 0xf0d8a0]) : 0xffffff, {});
    if (rand() < 0.55) { const cw = w * (0.18 + rand() * 0.2); for (const sd of [-1, 1]) B.add('interior', QUAD, M4(...P2(0.015, sd * (w / 2 - cw / 2)), cw, h, 1, 0, ry), pick([0xe9e5dc, 0xd8d0c0, 0x9a6a8a, 0x6a8aa0, 0xc8a070]), {}); }
    const F = 0xf2f2ee; for (const [u, v, bw, bh] of [[0, h / 2, w + 0.08, 0.07], [0, -h / 2, w + 0.08, 0.07], [-w / 2, 0, 0.07, h], [w / 2, 0, 0.07, h], [w * (rand() < 0.5 ? 0.12 : -0.12), 0, 0.05, h]]) B.add('flat', BOX, M4(...P2(0.035, u, v), bw, bh, 0.05, 0, ry), F, {});
    B.add('cpanel', BOX, M4(...P2(0.07, 0, -h / 2 - 0.07), w + 0.24, 0.08, 0.16, 0, ry), 0xc8c5be, {}); };
  const flatG = (key, x0, x1, z0, z1, col, o = {}) => quad(key, (x0 + x1) / 2, o.y ?? (key === 'slab' ? 0.02 : 0.008), (z0 + z1) / 2, x1 - x0, z1 - z0, 0, null, col, { rx: -Math.PI / 2, tile: o.tile || 0 });
  const pwall = (x, z, w, d, h = 4) => boxBody(x, h / 2, z, w, h, d, { playerOnly: true });

  // ---------- ground ----------
  boxBody(0, -1, 8, 90, 2, 130, { surface: 'tarmac' });
  flatG('grass', -45, 45, -52, 75, 0x6f8a45, { y: -0.03, tile: 3 }); // base: rough grass everywhere off the hard surfaces
  flatG('slab', -26, 24, PF, -17, 0xd2cfc8, { tile: 2.4 }); // the shopping-centre concourse
  flatG('tarmac', -RW, RW, -17, TOPZ0, 0x8d8f8c, { tile: 4 }); flatG('tarmac', -XW, XW, TOPZ0, TOPZ1, 0x8d8f8c, { tile: 4 }); // Pennywell Road + the top road
  for (const s of [-1, 1]) { flatG('slab', s > 0 ? RW : -PV, s > 0 ? PV : -RW, -17, TOPZ0, 0xc9c6bf, { tile: 1.8 }); // pavements
    flatG('slab', s > 0 ? PV : -XW, s > 0 ? XW : -PV, 33, TOPZ0, 0xc9c6bf, { tile: 1.8 }); }
  flatG('slab', -XW, XW, TOPZ1, FZ, 0xc9c6bf, { tile: 1.8, y: 0.015 });
  for (const s of [-1, 1]) { solid('flat', s * RW, 0.04, 9.5, 0.25, 0.08, 53, 0xb9b7b0, { phys: false }); solid('flat', s * (PV + 0.12), 0.05, 8, 0.22, 0.1, 50, 0xb4b2aa, { phys: false }); } // concrete kerbs + verge edging
  solid('flat', 0, 0.04, TOPZ1, XW * 2, 0.08, 0.25, 0xb9b7b0, { phys: false }); solid('flat', 0, 0.04, -17, 52, 0.08, 0.25, 0xb9b7b0, { phys: false });
  // road markings, bitumen crack-seal and patch repairs, ironwork
  for (let z = -14; z < 34; z += 4.5) flatG('flat', -0.08, 0.08, z, z + 2.2, 0xe8e6de, { y: 0.022 });
  for (const s of [-1, 1]) for (let z = -16; z < -8; z += 0.7) flatG('flat', s * (RW - 0.35) - 0.06, s * (RW - 0.35) + 0.06, z, z + 0.5, 0xd8b23a, { y: 0.022 }); // double yellows by the shops
  for (let x = -RW; x < RW; x += 0.9) flatG('flat', x, x + 0.5, TOPZ0 - 0.25, TOPZ0 - 0.05, 0xe8e6de, { y: 0.022 }); // give-way
  for (let i = 0; i < 26; i++) { const x = (rand() - 0.5) * 7, z = -16 + rand() * 50; quad('flat', x, 0.018, z, 0.07, 2 + rand() * 6, rand() * 3, null, 0x2b2c2d, { rx: -Math.PI / 2 }); } // bitumen seams
  for (let i = 0; i < 9; i++) { const x = (rand() - 0.5) * 6, z = -14 + rand() * 48; quad('flat', x, 0.016, z, 1 + rand() * 2.2, 0.8 + rand() * 2, rand() * 0.3, null, pick([0x5a5c5b, 0x6a6c6a, 0x4d4f4f]), { rx: -Math.PI / 2 }); } // patch repairs
  for (const [x, z] of [[-2.6, 2], [2.4, 18], [-1.5, 30], [1.8, -8]]) cyl('metal', x, 0.012, z, 0.32, 0.32, 0.02, 0x4a4b4d, { phys: false, seg: 10 }); // manhole covers
  for (const s of [-1, 1]) for (let z = -12; z < 34; z += 9) solid('flat', s * (RW - 0.25), 0.012, z, 0.4, 0.02, 0.8, 0x2e2f30, { phys: false }); // gully grates
  for (let i = 0; i < 70; i++) { const s = rand() < 0.5 ? -1 : 1; quad('grime', s * (RW + 0.2 + rand() * 3), 0.024, -16 + rand() * 50, 0.6 + rand() * 1.6, 0.5 + rand() * 1.4, rand() * 3, GRIME_UV[0], 0xffffff, { rx: -Math.PI / 2 }); }
  for (let i = 0; i < 45; i++) quad('grime', -24 + rand() * 46, 0.03, PF + 1 + rand() * 13, 0.8 + rand() * 2.4, 0.8 + rand() * 2, rand() * 3, GRIME_UV[rand() < 0.75 ? 0 : 1], 0xffffff, { rx: -Math.PI / 2 }); // concourse stains
  for (let i = 0; i < 160; i++) { const x = -24 + rand() * 46, z = PF + 0.5 + rand() * 14; quad('flat', x, 0.028, z, 0.07, 0.07, 0, null, 0x9a9890, { rx: -Math.PI / 2 }); } // chewing-gum spots
  for (let i = 0; i < 28; i++) { const s = rand() < 0.5 ? -1 : 1; quad('flat', s * (PV + 0.3 + rand() * 3.8), 0.006, -14 + rand() * 46, 0.6 + rand() * 1.6, 0.5 + rand() * 2, rand() * 3, null, pick([0x7c8a4a, 0x86884e, 0x5f7a3a, 0x8f8a5e]), { rx: -Math.PI / 2 }); } // worn verge patches
  for (let i = 0; i < 40; i++) { const s = rand() < 0.5 ? -1 : 1; quad('flat', s * (PV + 0.05), 0.02, -14 + rand() * 46, 0.05, 0.25, 0, null, pick([0x5f7a3a, 0x6d8648]), {}); } // weeds at the kerb edge
  for (let i = 0; i < 18; i++) { const x = (rand() - 0.5) * 50, z = PF + 1 + rand() * 50; if (Math.abs(x) < RW && z > -17) continue; quad('flat', x, 0.03, z, 0.12, 0.08, rand() * 3, null, pick([0xf2f2f2, 0xd4402c, 0x2d6cc4, 0xe7c23a]), { rx: -Math.PI / 2 }); } // litter

  // ---------- the shopping centre: shops below, flats above, canopy, the library through the back ----------
  const SHOPS = [ // x0, x1, name, sub, bg, fg
    [-26, -14, 'THE WEE GROCER', 'FRESH · FROZEN · OPEN 8 TIL LATE', '#2f6b3a', '#f4efe0'],
    [-14, -8, "R.J. McCALLUM'S", 'NEWS · SWEETS · PAPERS', '#b8202a', '#ffffff'],
    [-8, -2, "MACKIE'S PORK SHOP", 'SQUARE SAUSAGE · PIES', '#f3e9d2', '#8a2a1e'],
    [-2, 4, 'LUCKY HORSESHOE', 'BOOKMAKERS', '#1d4a2a', '#e9cf6a'],
    [4, 10, "HADDON'S WINES", 'OFF-LICENCE', '#4a1f2a', '#f1d98a'],
    [10, 16, 'EL MEXICANITO', 'PIZZA · KEBABS · CHIPS', '#e2a42a', '#7a1f12'],
  ];
  { const z0 = PF, D = 12, H = 10.4, xc = -1;
    solid('cpanel', -4.5, H / 2, z0 - D / 2, 43, H, D, 0xd9d6cf, { tile: 3.2, phys: false }); boxBody(-4.5, H / 2, z0 - D / 2, 43, H, D); // west part (to the pend)
    solid('cpanel', 22, H / 2, z0 - D / 2, 4, H, D, 0xd9d6cf, { tile: 3.2 }); // east of the pend
    solid('cpanel', 18.5, 7.2, z0 - D / 2, 3, 6.4, D, 0xd9d6cf, { tile: 3.2 }); // the pend: a passage through the back to the library
    boxBody(18.5, 2, z0 - D + 0.2, 3, 4, 0.4); solid('flat', 18.5, 2.0, z0 - 3, 0.1, 4, 6, 0x6a6c6a, { phys: false });
    // flats above: roughcast bands between concrete floor slabs, windows, a couple of balconies
    for (const [y0, y1] of [[4.0, 6.9], [7.3, 10.2]]) solid('harl', -2, (y0 + y1) / 2, z0 + 0.01, 52, y1 - y0, 0.02, HARL[1], { phys: false, tile: 2.5, grime: 0.1 });
    for (const y of [3.95, 7.1, 10.3]) solid('cpanel', -2, y, z0 + 0.12, 52.2, 0.32, 0.26, 0xcfccc4, { phys: false, tile: 1.5 });
    for (let i = 0; i < 17; i++) { const wx = -25 + i * 3.0 + 0.6; if (wx > 16.6 && wx < 20.4) continue; for (const wy of [5.45, 8.75]) { const mine = wx > 5.5 && wx < 9 && wy < 6; // Chris's old flat: above the off-licence
        win(wx, wy, z0 + 0.02, 0, 1.9, 1.5, mine ? true : undefined); } }
    solid('flat', 7.3, 4.7, z0 + 0.25, 2.2, 0.12, 0.4, 0x7b5a3a, { phys: false }); for (let k = 0; k < 4; k++) cyl('flat', 6.5 + k * 0.5, 4.88, z0 + 0.25, 0.1, 0.1, 0.22, pick([0xd4402c, 0xe7c23a, 0xd46aa0]), { phys: false, seg: 6 }); // window box under the old flat
    for (const bx of [-17, -5, 13]) { solid('cpanel', bx, 7.25, z0 + 0.7, 2.8, 0.15, 1.3, 0xcfccc4, { phys: false }); solid('metal', bx, 7.8, z0 + 1.32, 2.8, 0.9, 0.05, 0x9aa0a0, { phys: false }); } // balconies
    solid('flat', -2, 10.5, z0 - D / 2, 52.4, 0.35, D + 0.4, 0x8e8b84, { phys: false }); // flat-roof parapet
    // canopy along the parade (concrete, with a lip so a chipped ball can sit on it)
    solid('cpanel', -2, 3.35, z0 + 1.2, 52, 0.22, 2.4, 0xd2cfc8, { tile: 2 }); solid('cpanel', -2, 3.55, z0 + 2.33, 52, 0.22, 0.14, 0xc6c3bb, { tile: 2 });
    for (let x = -24; x <= 22; x += 6.6) cyl('cpanel', x, 1.62, z0 + 2.1, 0.13, 0.13, 3.24, 0xc4c1ba, { seg: 8 });
    for (const [x0, x1, name, sub, bg, fg] of SHOPS) { const w = x1 - x0, sx = (x0 + x1) / 2;
      solid('cpanel', x0 + 0.2, 1.6, z0 + 0.15, 0.4, 3.2, 0.3, 0xc9c6bf, { phys: false }); // pier between units
      solid('flat', sx, 0.3, z0 + 0.05, w - 0.8, 0.6, 0.1, 0x4a4b4d, { phys: false }); // window + stallriser
      B.add('atlasLit', QUAD, M4(sx, 2.95, z0 + 0.06, w - 0.6, 0.62, 1), 0xe6e6e6, { uvRect: atlas.fascia(name, sub, bg, fg, (w - 0.6) / 0.62) });
      B.add('interior', QUAD, M4(sx, 1.6, z0 - 0.6, w - 1.0, 2.3, 1), pick([0xb8ae98, 0xa89c88, 0xc0b8a8]), {}); for (let k = 0; k < 3; k++) B.add('interior', BOX, M4(sx - (w - 2) / 2 + k * (w - 2) / 2, 1.0 + rand() * 0.6, z0 - 0.45, 0.9, 0.12, 0.2), pick([0xd4402c, 0xe7c23a, 0x2d6cc4, 0xf2f2f2, 0x4a8a3a]), {});
      quad('grime', sx, 0.9, z0 + 0.04, w, 1.8, 0, GRIME_UV[2]); }
    // window displays (simple shelf blocks / posters) so the glass isn't empty
    for (const [x, c] of [[-23, 0x2f6b3a], [-20, 0xe7c23a], [-11, 0xd4402c], [-5, 0xf3e9d2], [1, 0x1d4a2a], [7, 0x6a1f2a], [13, 0xe2a42a]]) for (let k = 0; k < 3; k++) solid('flat', x + k * 0.9 - 0.9, 0.9 + (k % 2) * 0.5, z0 - 0.2, 0.7, 0.45, 0.2, c, { phys: false });
    // roller shutter on the end unit + stair door to the flats beside the off-licence
    solid('metal', 22, 1.6, z0 + 0.05, 3.4, 3.0, 0.08, 0x9a9c9c, { phys: false }); for (let y = 0.2; y < 3.1; y += 0.12) solid('flat', 22, y, z0 + 0.1, 3.4, 0.03, 0.02, 0x6e7070, { phys: false });
    sign('LIBRARY  →', 18.5, 3.9, z0 + 0.4, 2.6, 0.45, 0, '#2a3f6b', '#ffffff', 'bold 46px Arial');
    quad('glass', 18.5, 1.4, z0 - D + 0.45, 2.4, 2.6, 0, null, 0xfff3d0); sign('PUBLIC LIBRARY', 18.5, 3.1, z0 - D + 0.45, 2.6, 0.45, 0, '#2a3f6b', '#ffffff', 'bold 40px Arial');
    // bins, trolleys, a bench, cycle hoops, bollards on the concourse
    for (const [x, z, c] of [[-25, PF + 1.0, 0x2f5a3a], [-24, PF + 1.0, 0x5a5c5e], [21, PF + 1.0, 0x5a5c5e], [23.5, PF + 0.9, 0x2f5a3a]]) { solid('flat', x, 0.55, z, 0.75, 1.1, 0.8, c, { surface: 'plastic' }); solid('flat', x, 1.12, z - 0.05, 0.8, 0.08, 0.9, c, { phys: false }); }
    for (const [x, z, r] of [[-17, PF + 4, 0.3], [-16.2, PF + 4.3, 0.5], [14, PF + 5, -0.6]]) { solid('metal', x, 0.55, z, 0.55, 0.05, 0.9, 0x9aa0a6, { phys: false, ry: r }); solid('metal', x, 0.85, z, 0.55, 0.5, 0.04, 0x9aa0a6, { phys: false, ry: r }); boxBody(x, 0.5, z, 0.55, 1.0, 0.9, { ry: r, surface: 'metal' }); }
    solid('wood', -8, 0.45, PF + 6, 2.0, 0.08, 0.5, 0x7b5a3a); solid('cpanel', -8.8, 0.22, PF + 6, 0.2, 0.44, 0.5, 0xb8b5ae, { phys: false }); solid('cpanel', -7.2, 0.22, PF + 6, 0.2, 0.44, 0.5, 0xb8b5ae, { phys: false });
    for (let x = -24; x <= 24; x += 3) if (Math.abs(x) > 6) cyl('cpanel', x, 0.45, -17.6, 0.18, 0.2, 0.9, 0xc9c6bf, { seg: 8 }); // concrete bollards at the concourse edge
  }

  // ---------- the old filling-station nod: a retro petrol pump kept as a planter, with a wee plaque (target 1) ----------
  { const x = 5.6, z = -21.6;
    solid('flat', x, 0.15, z, 1.4, 0.3, 1.0, 0x9a978f); solid('flat', x, 1.05, z, 0.62, 1.5, 0.42, 0xb8302a, { surface: 'metal', target: 'oldpump' }); solid('flat', x, 1.32, z + 0.22, 0.46, 0.5, 0.02, 0xf2ede0, { phys: false });
    cyl('glass', x, 2.02, z, 0.2, 0.2, 0.36, 0xfff2c8, { phys: false, seg: 10 }); solid('flat', x - 0.36, 0.95, z + 0.05, 0.08, 0.7, 0.08, IRON, { phys: false });
    for (let k = 0; k < 5; k++) cyl('flat', x - 0.5 + k * 0.25, 0.38, z + 0.35, 0.08, 0.08, 0.2, pick([0xd4402c, 0xe7c23a, 0xf2f2f2, 0x8a3aa0]), { phys: false, seg: 6 });
    sign('PENNYWELL FILLING STATION · STOOD HERE 1960s', x, 0.62, z + 0.52, 1.3, 0.16, 0, '#2E2F2C', '#e9e2cf', 'bold 30px Arial');
    addTarget({ id: 'oldpump', name: 'The Auld Pump', hint: 'ping the old petrol pump (the filling station stood here)', points: 50, kind: 'hit', pos: V(x, 0, z - 1.2), ringR: 0.9, stand: V(4.2, 0, -27), aim: V(x, 1.0, z), lines: ['Fill her up! Four star, son.', "Ding! That pump's no' seen action since decimalisation.", 'Pumped. Lovely.'] }); }

  // ---------- targets on the parade ----------
  { // newsagent's paper board (topples)
    const ax = -12.4, az = PF + 1.6, parts = [], add = (geo, m, col) => { const gg = geo.clone().applyMatrix4(m).toNonIndexed(); const c = new THREE.Color(col), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg); };
    add(new THREE.BoxGeometry(0.62, 0.95, 0.05), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0, 0.12), 0xb8202a); add(new THREE.BoxGeometry(0.62, 0.95, 0.05), new THREE.Matrix4().makeRotationX(-0.2).setPosition(0, 0, -0.12), 0xb8202a);
    add(new THREE.BoxGeometry(0.5, 0.62, 0.01), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.03, 0.155), 0xf4f2ea); add(new THREE.BoxGeometry(0.44, 0.1, 0.012), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.2, 0.165), 0x1d1d1d); add(new THREE.BoxGeometry(0.44, 0.05, 0.012), new THREE.Matrix4().makeRotationX(0.2).setPosition(0, 0.05, 0.168), 0x555555);
    const geo = mergeSimple(parts), b = new CANNON.Body({ mass: 0.5, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.31, 0.47, 0.12)) }); b.position.set(ax, 0.48, az); b.userData = { target: 'newsboard', surface: 'board' }; world.addBody(b);
    dynamics.push({ geo, body: b, home: b.position.clone() });
    addTarget({ id: 'newsboard', name: "McCallum's Paper Board", hint: "knock over the newsagent's paper board", points: 50, kind: 'topple', body: b, pos: V(ax, 0, az), stand: V(ax, 0, az + 4.5), aim: V(ax, 0.5, az), lines: ['HOLD THE FRONT PAGE: BOARD FALLS OVER.', "Read all aboot it!", "That's the Evening News sorted."] }); }
  const shopDoor = (id, x, name, hint, lines, col, pts = 75) => { solid('wood', x, 1.15, PF + 0.06, 1.15, 2.3, 0.1, col, { target: id, surface: 'board' }); quad('atlas', x, 1.15, PF + 0.12, 1.15, 2.3, 0, atlas.draw(128, 256, drawTargetDoor));
    addTarget({ id, name, hint, points: pts, kind: 'hit', pos: V(x, 0, PF + 1.4), ringR: 0.95, stand: V(x, 0, PF + 6.5), aim: V(x, 1.0, PF), lines }); };
  shopDoor('porkshop', -5, "Mackie's Door", 'skelp the pork shop door', ['Square sausage, two rolls, nae sauce. Ta.', "Mackie's says: mind the windae.", 'Pure dead brilliant. And peppery.'], 0x8a2a1e);
  shopDoor('bookies', 1, 'Lucky Horseshoe', 'strike the bookies door', ['Each-way winner!', "The bookie's no' happy. You're on a roll.", 'Romped home at 33 to 1.'], 0x1d4a2a);
  shopDoor('mexicanito', 13, 'El Mexicanito', 'hit the takeaway door', ['One munchie box, extra chips!', "The chef's waving a spatula at ye.", 'Delivered hot.'], 0x7a1f12);
  { // the canopy above Haddon's Wines - Chris's old flat is right above it (chip target)
    addTarget({ id: 'canopy', name: "Up on Haddon's Canopy", hint: "chip it up onto the canopy over Haddon's Wines (that's the old flat above)", points: 125, kind: 'zone', pos: V(7, 0, PF + 3.2), ringR: 1.2, stand: V(7, 0, PF + 12.5), aim: V(7, 4.2, PF + 1.2),
      zone: new THREE.Box3(V(4, 3.45, PF + 0.1), V(10, 4.6, PF + 2.6)), lines: ["Up on the roof! Ma would've had your guts for garters.", "Left it on the canopy. Some things never change.", 'Chipped like a pro. The whole close heard it.'] }); }

  // ---------- Pennywell Road: verges, palisade railings, lamp standards, trees, bus stop, clutter ----------
  const palisade = (x0, z0, x1, z1, col = PAL, h = 1.9) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.round(L / 0.2), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const y of [0.35, h - 0.35]) solid('metal', mx, y, mz, 0.05, 0.07, L, col, { phys: false, ry: a });
    for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; B.add('metal', BOX, M4(x, h / 2, z, 0.07, h, 0.025, 0, a), col, {}); B.add('metal', ROOF, M4(x, h + 0.05, z, 0.07, 0.12, 0.025, 0, a), col, {}); }
    body(new CANNON.Box(new CANNON.Vec3(0.06, h / 2, L / 2)), mx, h / 2, mz, { ry: a, surface: 'metal' }); };
  palisade(VG, -14, VG, 32.5); palisade(-VG, -14, -VG, 32.5);
  palisade(-XW, FZ, -3, FZ); palisade(3, FZ, XW, FZ); // the school fence, with the gates as a goal in the middle
  for (const s of [-1, 1]) for (let z = -12; z < 34; z += 13) { const x = s * (PV - 0.4); cyl('cpanel', x, 3.6, z, 0.11, 0.16, 7.2, 0xb4b2ab, { seg: 7 }); solid('cpanel', x - s * 0.7, 7.15, z, 1.5, 0.12, 0.26, 0xb4b2ab, { phys: false }); solid('flat', x - s * 1.35, 7.05, z, 0.5, 0.12, 0.3, 0xfff1c0, { phys: false }); }
  for (const [x, z, s2] of [[9.3, -6, 1.1], [-9.3, -9, 1.2], [9.3, 26, 1.25], [-9.3, 30, 1.0], [24, 38.5, 1.1]]) { cyl('wood', x, 2.2 * s2, z, 0.22, 0.32, 4.4 * s2, 0x4e3c2a, { seg: 6 }); for (const [ox, oy, oz, r] of [[0, 6.2, 0, 2.6], [0.9, 5.4, 0.6, 1.9], [-0.8, 5.6, -0.7, 2.0], [0.2, 7.3, -0.2, 1.7]]) B.add('flat', new THREE.IcosahedronGeometry(r * s2, 1), M4(x + ox, oy * s2, z + oz, 1, 0.92, 1), pick([0x46672f, 0x557a36, 0x4c6e32]), {}); }
  // bus stop on the right-hand pavement (target, glass)
  { const x = -5.3, z = 5; solid('metal', x - 0.6, 1.25, z, 0.08, 2.5, 3.2, IRON, { phys: false }); quad('glass', x - 0.55, 1.3, z, 3.1, 2.1, Math.PI / 2, null, 0xd8e6ee); boxBody(x - 0.6, 1.25, z, 0.12, 2.5, 3.2, { target: 'busstop', surface: 'glass' });
    solid('metal', x, 2.55, z, 1.4, 0.08, 3.4, IRON, { phys: false }); for (const dz of [-1.6, 1.6]) solid('metal', x, 1.25, z + dz, 1.2, 2.5, 0.06, IRON, { phys: false }); solid('wood', x - 0.3, 0.55, z, 0.4, 0.06, 2.6, 0x6a6c6a, { phys: false });
    cyl('metal', x + 0.9, 1.4, z - 2.2, 0.05, 0.05, 2.8, IRON, { seg: 6 }); sign('BUS STOP', x + 0.9, 2.75, z - 2.2, 0.7, 0.32, Math.PI / 2, '#e7c23a', '#1d1d1d', 'bold 54px Arial');
    addTarget({ id: 'busstop', name: 'The Bus Shelter', hint: 'clatter the bus-stop panel', points: 75, kind: 'hit', pos: V(x + 0.3, 0, z), ringR: 1.2, stand: V(0.5, 0, z), aim: V(x - 0.6, 1.2, z), lines: ['Next bus: 20 minutes. Next goal: noo.', "Clang! That's woken the auld boy up.", 'Rattled the shelter like a 27 at full tilt.'] }); }
  // clutter: wheelie bins at the flats, a road-works barrier and cones, a grit bin, a dog bin, street nameplate
  for (const [x, z, c] of [[-8.6, -13, 0x2f5a3a], [-8.6, -12.1, 0x5a5c5e], [8.8, 22, 0x2f5a3a], [8.8, 22.9, 0x3a5aa0], [8.8, 23.8, 0x5a5c5e]]) { solid('flat', x, 0.55, z, 0.75, 1.1, 0.8, c, { surface: 'plastic' }); solid('flat', x, 1.12, z, 0.82, 0.08, 0.88, c, { phys: false }); }
  { const x = 5.6, z = 28; for (const dz of [-1, 1]) { solid('flat', x, 0.5, z + dz, 0.12, 1.0, 0.12, 0xd4402c, { phys: false }); } solid('flat', x, 0.85, z, 0.1, 0.22, 2.1, 0xf2f2f2, { phys: false }); solid('flat', x, 0.85, z, 0.11, 0.22, 0.5, 0xd4402c, { phys: false }); boxBody(x, 0.5, z, 0.2, 1.0, 2.2, { surface: 'plastic' });
    for (const dz of [-1.8, 2.0, 2.6]) { cyl('flat', 4.6, 0.36, z + dz, 0.04, 0.17, 0.72, 0xe85a1e, { seg: 8 }); cyl('flat', 4.6, 0.46, z + dz, 0.08, 0.12, 0.08, 0xf2f2f2, { phys: false, seg: 8 }); } }
  solid('flat', -8.6, 0.45, 20, 0.8, 0.9, 0.6, 0xe7c23a, { surface: 'plastic' }); solid('flat', -8.6, 0.93, 20, 0.86, 0.08, 0.66, 0xd8b23a, { phys: false }); // grit bin
  cyl('metal', 8.4, 0.5, 8, 0.04, 0.04, 1.0, IRON, { seg: 5, phys: false }); solid('flat', 8.4, 1.05, 8, 0.36, 0.42, 0.3, 0xb8202a, { phys: false });
  for (const [x, z, r] of [[VG - 0.2, -13, -Math.PI / 2], [-VG + 0.2, 33, Math.PI / 2]]) sign('PENNYWELL ROAD', x, 2.1, z, 1.7, 0.36, r, '#ffffff', '#1d1d1d', 'bold 50px Arial', '#1d1d1d');

  // ---------- the Old Kirk (left, +x): rustic rubble-stone porch tower, white harled nave, low wall + railings ----------
  { const x0 = 13.5;
    solid('rubble', x0 + 2.2, 5.2, 4, 4.4, 10.4, 6.2, 0xf0e6d2, { tile: 2.2 }); // stone porch tower
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) solid('glass', x0 - 0.01, 5.0 + j * 1.25, 2.4 + i * 1.6, 0.04, 0.85, 0.9, 0x55606a, { phys: false });
    for (const dz of [-0.55, 0.55]) solid('wood', x0 - 0.02, 1.4, 4 + dz, 0.06, 2.8, 1.0, 0x6a2a1e, { phys: false }); solid('rubble', x0 - 0.05, 3.0, 4, 0.16, 0.4, 2.6, 0xb8ab94, { phys: false });
    solid('roof', x0 + 2.2, 10.55, 4, 4.8, 0.3, 6.6, 0x3a3e44, { phys: false });
    solid('harl', x0 + 10, 3.6, 4, 11.5, 7.2, 13, HARL[0], { tile: 2.5, grime: 0.12 }); B.add('roof', ROOF, M4(x0 + 10, 7.2, 4, 13.4, 2.6, 11.7, 0, Math.PI / 2), 0x4a4e54, { tile: 2.2 });
    for (let i = 0; i < 4; i++) quad('glass', x0 + 6 + i * 2.6, 3.8, -2.51, 1.0, 2.6, Math.PI, null, 0x9fb0b8);
    solid('harl', x0 + 6, 2.6, 12.5, 6, 5.2, 4, HARL[2], { tile: 2.5 }); B.add('roof', ROOF, M4(x0 + 6, 5.2, 12.5, 4.4, 1.6, 6.2, 0, Math.PI / 2), 0x4a4e54, {}); // hall
    sign('THE OLD KIRK', x0 - 0.03, 8.1, 4, 3.0, 0.5, -Math.PI / 2, '#2E2F2C', '#efe3c8', 'bold 52px Georgia');
    solid('rubble', VG + 0.45, 0.45, 4, 0.5, 0.9, 16, 0xe6dcc8, { tile: 1.5 }); // low rubble boundary wall behind the railings
    // noticeboard at the gate (target)
    const nx = VG - 0.3, nz = 1.0; solid('wood', nx, 1.35, nz, 0.12, 1.1, 1.5, 0x2a3f6b, { target: 'kirknotice', surface: 'board' }); quad('flat', nx - 0.07, 1.4, nz, 1.3, 0.9, -Math.PI / 2, null, 0xf4f2ea);
    sign('ALL WELCOME', nx - 0.08, 1.75, nz, 1.2, 0.22, -Math.PI / 2, '#2a3f6b', '#ffffff', 'bold 44px Arial'); for (const dz of [-0.6, 0.6]) cyl('wood', nx, 0.4, nz + dz, 0.05, 0.05, 0.8, 0x2a3f6b, { seg: 5, phys: false });
    addTarget({ id: 'kirknotice', name: 'Old Kirk Noticeboard', hint: 'ping the kirk noticeboard at the railings', points: 100, kind: 'hit', pos: V(nx - 1.2, 0, nz), ringR: 0.9, stand: V(8.3, 0, nz), aim: V(nx, 1.35, nz), lines: ['Notice: fitba practice, Tuesdays.', "The minister says that'll be a fiver for the roof fund.", 'Pinged it. Hallelujah.'] }); }

  // ---------- St Paul's (right, -x): white walls under a weathered copper wedge roof, tall belfry gable to the road ----------
  { const xf = -14, xb = -28, z0 = 8, z1 = 24, Hlo = 3.4, Hhi = 18, zc = (z0 + z1) / 2;
    solid('harl', (xf + xb) / 2, Hlo / 2, zc, xf - xb, Hlo, z1 - z0, HARL[0], { tile: 2.5, grime: 0.15 });
    { const sh = new THREE.Shape(); sh.moveTo(xb - 0.3, Hlo - 0.1); sh.lineTo(xf + 0.4, Hlo - 0.1); sh.lineTo(xb - 0.3, Hhi - 2.5); sh.closePath(); // copper slope faces the road
      const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0 + 0.6, bevelEnabled: false }); g.translate(0, 0, z0 - 0.3); B.add('copper', g, null, 0xffffff, { tile: 3 });
      const w = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }); w.translate(0, 0, z0 - 0.3); B.add('harl', w, null, HARL[3], { tile: 2.5 }); const w2 = w.clone(); w2.translate(0, 0, z1 - z0 + 0.3); B.add('harl', w2, null, HARL[3], { tile: 2.5 });
      body(new CANNON.Box(new CANNON.Vec3((xf - xb) / 2, (Hhi - Hlo) / 2, (z1 - z0) / 2)), (xf + xb) / 2, Hlo + 1.5, zc); }
    solid('harl', xf + 0.35, 7.25, zc - 3, 0.7, 14.5, 6.5, HARL[0], { tile: 2.5, grime: 0.12 }); // tall belfry wall to the road
    for (let k = 0; k < 4; k++) solid('flat', xf + 0.72, 12.9, zc - 5.2 + k * 1.45, 0.05, 0.9, 0.7, 0x2a2c30, { phys: false }); // belfry slots
    solid('glass', xf + 0.72, 6.5, zc - 1.0, 0.05, 6.0, 0.9, 0x3a5a7a, { phys: false }); // tall slot window
    solid('flat', xf + 0.72, 1.2, zc - 4.6, 0.06, 2.4, 1.3, 0x2a5aa0, { phys: false }); solid('flat', xf + 0.73, 2.55, zc - 4.6, 0.06, 0.25, 1.6, 0x2a5aa0, { phys: false }); // blue door + band
    solid('harl', xf + 3, 2.3, zc + 4.5, 5, 4.6, 6, HARL[2], { tile: 2.5, grime: 0.15 }); B.add('roof', ROOF, M4(xf + 3, 4.6, zc + 4.5, 5.4, 1.8, 6.4), 0x4a4e54, {}); // porch wing
    for (let i = 0; i < 4; i++) quad('grime', xf + 0.73, 12.5 - (i % 2) * 3, zc - 5.6 + i * 1.6, 0.6, 3, Math.PI / 2, GRIME_UV[2]); // age streaks (no fire damage shown)
    sign("ST PAUL'S", xf + 5.53, 3.7, zc + 4.5, 2.0, 0.4, Math.PI / 2, '#ffffff', '#2a5aa0', 'bold 50px Georgia', '#2a5aa0');
    // the church gate in the railings (target)
    const gx = -VG + 0.12, gz = 15; for (const dz of [-1.15, 1.15]) solid('cpanel', gx, 0.95, gz + dz, 0.3, 1.9, 0.3, 0xcfccc4); solid('metal', gx, 0.95, gz, 0.06, 1.7, 2.0, 0x2a2c30, { target: 'stpaulsgate', surface: 'metal' });
    for (let k = 0; k < 9; k++) solid('metal', gx, 0.95, gz - 0.9 + k * 0.225, 0.07, 1.7, 0.03, 0x2a2c30, { phys: false });
    addTarget({ id: 'stpaulsgate', name: "St Paul's Gate", hint: "rattle St Paul's gate", points: 100, kind: 'hit', pos: V(gx + 1.2, 0, gz), ringR: 1.0, stand: V(-4.0, 0, gz), aim: V(gx, 0.9, gz), lines: ["Gate rattled. Father's lookin' oot the windae.", "Clang! That's the bell sorted for Sunday.", 'Sweet strike. Amen tae that.'] }); }

  // ---------- post-war harled flats lining the road (walk-ups with concrete bands and recessed balconies) ----------
  const flats = (x0, x1, z0, z1, floors, face, tone) => { const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, h = floors * 2.9 + 0.6;
    solid('harl', xc, h / 2, zc, w, h, d, tone, { tile: 2.6, grime: 0.12 }); solid('cpanel', xc, h + 0.2, zc, w + 0.3, 0.4, d + 0.3, 0xb8b5ae, { phys: false });
    const fx = face > 0 ? x0 - 0.02 : x1 + 0.02, ry = face > 0 ? -Math.PI / 2 : Math.PI / 2, n = Math.round(d / 3.2);
    for (let f = 0; f < floors; f++) { solid('cpanel', fx - face * 0.08, 0.6 + f * 2.9 + 0.05, zc, 0.16, 0.18, d, 0xc8c5be, { phys: false });
      for (let i = 0; i < n; i++) { const wz = z0 + (i + 0.5) * d / n; if (i % 3 === 1) { solid('flat', fx - face * 0.02, 1.95 + f * 2.9, wz, 0.04, 2.3, 1.9, 0x3a3c3e, { phys: false }); solid('metal', fx - face * 0.2, 1.3 + f * 2.9, wz, 0.04, 0.9, 2.0, 0xc8ccd0, { phys: false }); }
        else win(fx, 1.9 + f * 2.9, wz, ry, 1.9, 1.5); } }
    for (let i = 0; i < n; i += 3) quad('grime', fx - face * 0.015, 1.2, z0 + (i + 0.5) * d / n, 1.8, 2.4, ry, GRIME_UV[2]);
    const m = Math.max(1, Math.round(w / 3.2)); for (const [ez, er] of [[z0 - 0.02, Math.PI], [z1 + 0.02, 0]]) for (let f = 0; f < floors; f++) for (let i = 0; i < m; i++) win(x0 + (i + 0.5) * w / m, 1.9 + f * 2.9, ez, er, 1.2, 1.3); // gable-end windows
    for (const ez of [z0 - 0.03, z1 + 0.03]) quad('grime', xc, 1.4, ez, w, 2.8, ez < zc ? Math.PI : 0, GRIME_UV[3]); };
  flats(14, 27, 17, 33, 3, 1, HARL[1]); flats(-27, -14, -15, 5, 4, -1, HARL[4]); flats(14, 27, -16, -6, 3, 1, HARL[5]);
  // drying-green poles and a washing line on the left verge behind the railings
  for (const z of [19, 24, 29]) { cyl('metal', 12.6, 1.1, z, 0.04, 0.04, 2.2, 0x9a9c9c, { phys: false, seg: 5 }); } solid('flat', 12.6, 2.1, 24, 0.01, 0.01, 10, 0xe8e8e8, { phys: false });
  for (const [z, c] of [[20.5, 0xd4402c], [21.4, 0xf2f2f2], [22.6, 0x2d6cc4], [26, 0xf2f2f2]]) solid('flat', 12.6, 1.8, z, 0.02, 0.6, 0.55, c, { phys: false });
  // substation behind palisade (lived-in clutter) on the left
  solid('brick', 13.5, 1.4, -2.5, 3, 2.8, 2.6, 0xffffff, { tile: 1.5 }); solid('metal', 12.0, 1.0, -2.5, 0.05, 1.6, 1.4, 0x6a6c6a, { phys: false }); sign('DANGER  HIGH VOLTAGE', 11.97, 1.3, -2.5, 1.0, 0.35, -Math.PI / 2, '#e7c23a', '#1d1d1d', 'bold 40px Arial');

  // ---------- Craigroyston High School at the top: 1960s concrete curtain wall, red-brick end, tall chimney; gates = goal ----------
  { const z0 = 56, z1 = 66, H = 11;
    solid('cpanel', -6, H / 2, (z0 + z1) / 2, 46, H, z1 - z0, 0xd2cfc8, { tile: 3 });
    for (let f = 0; f < 3; f++) { const y = 1.9 + f * 3.4; quad('glass', -6, y, z0 - 0.02, 44, 1.5, Math.PI, null, 0xb8cad6); solid('flat', -6, y + 1.05, z0 - 0.05, 44.4, 0.55, 0.06, 0x2f5a8a, { phys: false }); // ribbon glazing + blue spandrels
      for (let x = -28; x <= 16; x += 2.2) solid('cpanel', x, y, z0 - 0.08, 0.14, 1.6, 0.1, 0xc9c6bf, { phys: false }); }
    solid('brick', 22, 3.6, (z0 + z1) / 2, 10, 7.2, z1 - z0, 0xffffff, { tile: 1.6 }); cyl('brick', 24, 13, z1 - 1, 0.9, 1.1, 26, 0xffffff, { seg: 10 });
    boxBody(0, 3, z0 + 6, 70, 6, 14);
    flatG('grass', -XW, XW, FZ, z0, 0x5f8a3e, { y: -0.01, tile: 3 }); flatG('tarmac', -2.6, 2.6, FZ, z0, 0x8d8f8c, { y: 0.008, tile: 4 });
    // gate posts + sign arch: a proper goal frame
    for (const s of [-1, 1]) { solid('cpanel', s * 2.95, 1.3, FZ, 0.5, 2.6, 0.5, 0xd2cfc8, { tile: 1 }); solid('metal', s * 1.6, 0.95, FZ + 0.9, 0.04, 1.8, 2.2, PAL, { phys: false, ry: s * 1.0 }); } // gates swung open
    solid('metal', 0, 2.75, FZ, 6.2, 0.12, 0.12, PAL, { phys: false }); sign('CRAIGROYSTON HIGH SCHOOL', 0, 3.15, FZ - 0.05, 5.6, 0.62, Math.PI, '#1f3f2a', '#f4efe0', 'bold 46px Arial');
    boxBody(0, 1.4, FZ + 0.6, 5.4, 2.8, 0.3, { playerOnly: true }); // the player stays on the street; the ball goes through
    addTarget({ id: 'schoolgate', name: 'School Gate Goal', hint: 'NEW: score through the school gates (kick it - no dribbling in)', points: 150, kind: 'zone', kickOnly: true, pos: V(0, 0, FZ - 2.5), ringR: 1.3, stand: V(0, 0, 37), aim: V(0, 0.6, FZ + 1),
      zone: new THREE.Box3(V(-2.6, 0, FZ + 0.3), V(2.6, 2.6, FZ + 3.5)), lines: ["GOAL! Straight through the school gates. Detention, the lot o' ye.", 'Top bins! The janny saw that.', "Back o' the net. Craigroyston's finest."] });
    for (let i = 0; i < 4; i++) { const x = -26 + i * 15; solid('flat', x, 0.45, 48.5 + (i % 2), 3.8, 0.9, 1.7, pick([0x8a2a2a, 0x3a5aa0, 0xd8d8d0, 0x2f5a3a]), { phys: false }); solid('glass', x - 0.2, 1.1, 48.5 + (i % 2), 2.0, 0.45, 1.5, 0x3a4a5a, { phys: false }); } } // parked cars in the school grounds

  // ---------- backdrop: more scheme flats, a high-rise and trees so no edge reads as void ----------
  for (const s of [-1, 1]) for (let z = -28; z < 56; z += 14) { if (s > 0 && z > -8 && z < 16) continue; if (s < 0 && z > 4 && z < 26) continue; const h = 9 + rand() * 4; solid('harl', s * 36, h / 2, z + 7, 12, h, 12, pick(HARL), { tile: 2.6, phys: false, grime: 0.12 }); solid('cpanel', s * 36, h + 0.2, z + 7, 12.3, 0.4, 12.3, 0xb8b5ae, { phys: false });
    for (let f = 0; f < 3; f++) for (let i = 0; i < 4; i++) win(s * 29.98, 1.9 + f * 2.9, z + 2 + i * 3, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1.8, 1.4); }
  { const x = 46, z = -24, h = 46; solid('cpanel', x, h / 2, z, 14, h, 14, 0xc9c3b6, { tile: 3, phys: false }); for (let f = 0; f < 15; f++) solid('glass', x - 7.02, 2 + f * 3, z, 0.04, 1.3, 11, 0x9aa6ae, { phys: false }); solid('flat', x, h + 0.6, z, 14.4, 1.2, 14.4, 0x9a958c, { phys: false }); }
  for (let i = 0; i < 14; i++) { const x = -40 + rand() * 80, z = 68 + rand() * 6, s2 = 1 + rand() * 0.5; cyl('wood', x, 2.5 * s2, z, 0.25, 0.32, 5 * s2, 0x4e3c2a, { phys: false, seg: 5 }); B.add('flat', new THREE.IcosahedronGeometry(3 * s2, 1), M4(x, 6.5 * s2, z, 1, 0.9, 1), pick([0x46672f, 0x557a36]), {}); }
  solid('cpanel', 0, 7, -60, 90, 14, 6, 0xc9c3b6, { phys: false, tile: 3 }); // flats behind the centre
  // world edges for the player (balls are kept in by buildings, railings and the fence)
  pwall(-XW - 0.5, 8, 1, 120); pwall(XW + 0.5, 8, 1, 120); 
  for (const s of [-1, 1]) { pwall(s * (VG + XW) / 2, -15.6, XW - VG, 1); pwall(s * (VG + XW) / 2, 33.6, XW - VG, 1); } // close the verge ends behind the railings
  pwall(0, 52, 70, 1); boxBody(0, 3, 70, 90, 6, 1); boxBody(-45, 3, 8, 1, 6, 130); boxBody(45, 3, 8, 1, 6, 130); boxBody(0, 3, -45, 90, 6, 1);
  // ---------- targets ----------
  function addTarget(t) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; const r = t.ringR || 1; m.scale.set(r, r, r); m.position.copy(t.pos).add(V(0, 0.03, 0)); m.visible = false; scene.add(m); t.ring = m; if (t.zone) t.zoneInv = new THREE.Matrix4(); t.done = false; targets.push(t); return t; }
  const groups = [[-14, 0, -24], [10, 0, -20], [-2, 0, 12], [6, 0, 40]].map((p) => V(...p));
  const pig = { list: [], body: new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), null, groups.length * 4), head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), null, groups.length * 4) };
  groups.forEach((c) => { for (let i = 0; i < 4; i++) { const home = V(c.x + (rand() - 0.5) * 2, 0.08, c.z + (rand() - 0.5) * 2); pig.list.push({ home, pos: home.clone(), rot: rand() * 6.28, state: 'idle', t: rand() * 3, vel: V(0, 0, 0) }); } });
  const materials = makeMaterials(P, facadeTex, atlas.tex);
  const tm = (t) => { const m = materials.flat.clone(); m.map = t; return m; };
  materials.slab = tm(slabTexture()); materials.tarmac = tm(tarmacTexture()); materials.harl = tm(roughcastTexture()); materials.harl.color.setRGB(1.06, 1.08, 1.12); materials.harl.emissive?.setRGB(0.1, 0.1, 0.11); materials.cpanel = tm(concretePanelTexture()); materials.copper = tm(copperTexture()); materials.copper.side = THREE.DoubleSide;
  materials.rubble = tm(stoneTexture('rubble')); materials.grass = tm(grassTexture()); materials.brick = tm(gasBrickTexture());
  pig.body.material = materials.pigeon; pig.head.material = materials.pigeonHead; scene.add(pig.body, pig.head);
  for (const d of dynamics) { d.mesh = new THREE.Mesh(d.geo, materials.flat); d.mesh.castShadow = P.shadows; scene.add(d.mesh); }
  materials.interior = new THREE.MeshBasicMaterial({ vertexColors: true }); materials.atlasLit = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true });
  const batches = B.build(scene, materials, { shadows: P.shadows });
  const views = { spawn: [4.2, -27, 180, 2], road: [0, -8, 180, 4], kirk: [3, 2, 270, 6], stpauls: [-2, 12, 90, 8], school: [0, 30, 180, 6], parade: [0, -20, 0, 4] };
  return { targets, dynamics, pigeons: pig, materials, batches, views };
}
const ringGeo = new THREE.RingGeometry(1, 1.1, 32);

export function surfaceAt(x, z) {
  const ax = Math.abs(x);
  if (z < -17) return 'paving';
  if (z >= PW.TOPZ0 && z <= PW.TOPZ1) return 'tarmac';
  if (z > PW.TOPZ1) return z < PW.FENCE ? 'paving' : 'grass';
  if (ax < PW.ROAD) return 'tarmac';
  if (ax <= PW.PAVE || z > 33) return 'paving';
  return 'grass';
}
export default {
  id: 'pennywell', name: 'Pennywell Road', short: 'Pennywell', surfaceAt,
  sounds: { birds: [[-9, -9], [9, 26], [24, 38], [-20, 50]], gulls: [[0, 60], [-30, 20], [30, -30]], far: [[-60, 0], [60, 30], [0, 80], [0, -70]], roadX: 50 },
  blurb: 'Level 1: Pennywell Road. Start ootside the shops, up past the Old Kirk and St Paul\'s to the school gates. 10 targets. NEW: the school gates are a goal.',
  intro: "Welcome tae Pennywell!<br><small>Ootside the shops, under the auld flat. Ball's at your feet. Easy first one: the old petrol pump, straight ahead.</small>",
  build,
  tiers: { oldpump: 'easy', newsboard: 'easy', porkshop: 'easy', bookies: 'easy', mexicanito: 'easy', busstop: 'easy', kirknotice: 'easy', stpaulsgate: 'tricky', canopy: 'tricky', schoolgate: 'tricky' },
  spawn: [4.2, 0.5, -27], spawnYaw: 180,
  ballHomes: () => [[4.2, 0.4, -24.5], [0, 0.4, 2], [0, 0.4, 34]],
  bounds: { x: 30, zMin: -33, zMax: 50 },
  next: 'pilton',
};
