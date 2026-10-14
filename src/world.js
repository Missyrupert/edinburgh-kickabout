import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { tenementTexture, signTexture, doorTargetTexture, pbr, LOW_POWER } from './textures.js';

// Layout (metres). Street runs along +Z ("north", uphill toward the Castle).
// Grassmarket-style street z -50..30, Victoria-Street-style slope z 30..50 (rises 3 m),
// upper terrace z 50..66, and a close (pend) on the west side at z -10..-8.5 into a back court.
export const PAVE = 0.08; // pavement/kerb height
export const RAMP = { z0: 30, z1: 50, rise: 3 };

export function buildWorld(scene, world, mats, opts = {}) {
  const statics = [];
  const targets = [];
  const dynamics = []; // {mesh, body}
  const winTex = tenementTexture(import.meta.env.BASE_URL + 'tex/sandstone_diff.jpg');
  // Desktop: PBR (MeshStandard + HDRI reflections). Phones: Lambert with the same photo colour maps (much cheaper per pixel).
  const M = (c, extra = {}) => {
    if (LOW_POWER) { const { map, emissive } = extra; return new THREE.MeshLambertMaterial({ color: c, ...(map ? { map } : {}), ...(emissive ? { emissive } : {}) }); }
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...extra });
  };
  const wood = (c, rx = 1, ry = 1) => M(c, pbr('wood', rx, ry, { normal: false }));
  const roofMat = M(0x8a8e96, pbr('slate', 3, 3, { normal: false }));
  const stoneMat = M(0xd8c4a4, pbr('sandstone', 2, 2));
  const darkStone = M(0x9c8a72, pbr('sandstone', 3, 3));
  const iron = M(0x1c1f22, { roughness: 0.45, metalness: 0.7 });
  const sh = !!opts.shadows;

  function box(x, y, z, w, h, d, mat, { phys = true, rotX = 0, material = mats.ground, cast = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.rotation.x = rotX;
    mesh.castShadow = sh && cast; mesh.receiveShadow = sh;
    scene.add(mesh);
    let body = null;
    if (phys) {
      body = new CANNON.Body({ mass: 0, material, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)) });
      body.position.set(x, y, z); body.quaternion.setFromEuler(rotX, 0, 0);
      world.addBody(body); statics.push(body);
    }
    return { mesh, body };
  }
  function cyl(x, y, z, rt, rb, h, mat, { phys = true, seg = 10 } = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    mesh.position.set(x, y, z); mesh.castShadow = sh; scene.add(mesh);
    let body = null;
    if (phys) {
      body = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Cylinder(rt, rb, h, seg) });
      body.position.set(x, y, z); world.addBody(body); statics.push(body);
    }
    return { mesh, body };
  }
  function invisibleWall(x, y, z, w, h, d) {
    const b = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)) });
    b.position.set(x, y, z); world.addBody(b);
  }
  function plane(x, y, z, w, d, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    m.receiveShadow = sh; scene.add(m); return m;
  }
  function sign(text, x, y, z, w, h, rotY, bg, fg, font) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg, 512, Math.round(512 * h / w), font) }));
    m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
  }
  const tints = [0xffffff, 0xe8dccb, 0xd9cdb8, 0xf2e2c4, 0xcbbfa8, 0xbfae95];
  function tenement(x0, x1, z0, z1, h, base = 0, tint = 0) {
    const w = x1 - x0, d = z1 - z0;
    const tx = winTex.clone(); tx.needsUpdate = true; tx.repeat.set(Math.max(1, Math.round(d / 3.4)), Math.round(h / 3.3));
    const tz = winTex.clone(); tz.needsUpdate = true; tz.repeat.set(Math.max(1, Math.round(w / 3.4)), Math.round(h / 3.3));
    const col = tints[tint % tints.length];
    const mx = M(col, { map: tx, roughness: 0.9 }), mz = M(col, { map: tz, roughness: 0.9 });
    const { mesh } = box((x0 + x1) / 2, base + h / 2, (z0 + z1) / 2, w, h, d, [mx, mx, roofMat, roofMat, mz, mz]);
    // chimney stacks + cornice for Old Town skyline
    box((x0 + x1) / 2, base + h + 0.25, (z0 + z1) / 2, w + 0.3, 0.5, d + 0.3, darkStone, { phys: false });
    for (let zz = z0 + 2; zz < z1 - 1; zz += 5) {
      box((x0 + x1) / 2, base + h + 1.2, zz, 1, 2, 2.2, darkStone, { phys: false });
      for (let k = -0.6; k <= 0.61; k += 0.6) cyl((x0 + x1) / 2, base + h + 2.4, zz + k, 0.14, 0.14, 0.5, M(0xa0522d), { phys: false, seg: 6 });
    }
    return mesh;
  }

  // ---------- ground ----------
  const groundBody = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(groundBody); statics.push(groundBody);
  plane(0, -0.01, 0, 400, 400, M(0x9a948a, pbr('paving', 100, 100, { normal: false })));
  plane(0, 0.005, -10, 9, 80, M(0xd0ccc4, pbr('cobble', 4.5, 40)));
  // pavements (physical kerbs: the ball bounces off them)
  for (const s of [-1, 1]) {
    box(s * 5.75, PAVE - 0.55, -10, 2.5, 1.1, 80, M(0xcfc8bc, pbr('paving', 1.25, 40)), { phys: false });
    // physics: flat pavement from |x|=4.75 plus a bevelled kerb lip so balls and feet ride up it
    const pv = new CANNON.Body({ mass: 0, material: mats.kerb, shape: new CANNON.Box(new CANNON.Vec3(1.125, 0.55, 40)) });
    pv.position.set(s * 5.875, PAVE - 0.55, -10); world.addBody(pv);
    const th = s * Math.atan2(PAVE, 0.3), kb = new CANNON.Body({ mass: 0, material: mats.kerb, shape: new CANNON.Box(new CANNON.Vec3(0.17, 0.05, 40)) });
    kb.quaternion.setFromEuler(0, 0, th); kb.position.set(s * 4.6 + Math.sin(th) * 0.05, PAVE / 2 - Math.cos(th) * 0.05, -10); world.addBody(kb); // thick so the ball can't tunnel
    box(s * 4.55, PAVE / 2 + 0.005, -10, 0.2, PAVE + 0.01, 80, M(0x9a958c), { phys: false });
  }
  // slope (Victoria Street) + upper terrace
  const L = Math.hypot(RAMP.z1 - RAMP.z0, RAMP.rise), a = Math.atan2(RAMP.rise, RAMP.z1 - RAMP.z0);
  const cobMat2 = M(0xd0ccc4, pbr('cobble', 7, 10));
  box(0, RAMP.rise / 2 - 0.75 * Math.cos(a), (RAMP.z0 + RAMP.z1) / 2 + 0.75 * Math.sin(a), 14, 1.5, L, cobMat2, { rotX: -a });
  box(0, RAMP.rise / 2, 58, 14, RAMP.rise, 16, [darkStone, darkStone, M(0xd0ccc4, pbr('cobble', 7, 8)), darkStone, darkStone, darkStone]);

  // ---------- tenements ----------
  let ti = 0;
  const west = [[-50, -38, 15], [-38, -24, 17], [-24, -10, 14], [-8.5, 4, 16], [4, 17, 13], [17, 30, 18], [30, 40, 16], [40, 50, 19], [50, 58, 18], [58, 66, 20]];
  const east = [[-50, -36, 16], [-36, -24, 13], [-24, -12, 17], [-12, 0, 15], [0, 10, 14], [10, 20, 18], [20, 30, 15], [30, 40, 17], [40, 50, 16], [50, 58, 19], [58, 66, 17]];
  for (const [z0, z1, h] of west) tenement(-14, -7, z0, z1, h, 0, ti++);
  for (const [z0, z1, h] of east) tenement(7, 14, z0, z1, h, 0, ti++);
  // pend over the close
  box(-10.5, 8.5, -9.25, 7, 11, 1.5, stoneMat);
  sign("KICKER'S CLOSE", -6.98, 3.4, -9.25, 2.2, 0.32, Math.PI / 2, '#f4f1ea', '#111', 'bold 60px Arial, sans-serif');
  // back court behind the close
  box(-24.5, 2, -9, 1, 4, 19, stoneMat); box(-19, 2, -18.5, 10, 4, 1, stoneMat); box(-19, 2, 0.5, 10, 4, 1, stoneMat);
  // street-name plaques (black on white, Edinburgh style)
  sign('GRASSMARKET', -6.98, 3.6, -42, 2.6, 0.4, Math.PI / 2, '#f4f1ea', '#111', 'bold 60px Arial, sans-serif');
  sign('GRASSMARKET', 6.98, 3.6, -30, 2.6, 0.4, -Math.PI / 2, '#f4f1ea', '#111', 'bold 60px Arial, sans-serif');
  sign('VICTORIA STREET', 6.98, 4.6, 33, 2.8, 0.4, -Math.PI / 2, '#f4f1ea', '#111', 'bold 60px Arial, sans-serif');
  sign('EDINBURGH', -6.98, 4.8, 31, 1.4, 0.26, Math.PI / 2, '#f4f1ea', '#888', 'bold 60px Arial, sans-serif');

  // shopfronts (painted timber, gold lettering)
  const shops = [
    ['W', -46, -40, 'THE LAST DRAP', '#1d3b2a'], ['W', -36, -28, 'TARTAN TAT & TABLET', '#5b1b2a'],
    ['W', -22, -14, 'HAGGIS EMPORIUM', '#1e2c4f'], ['W', 6, 14, 'BOOKS & BAWBEES', '#3a2a1a'],
    ['E', -48, -40, 'THE WEE CHIPPY', '#0f3d5c'], ['E', -32, -26, 'IRN AGE CAFE', '#9a4a12'],
    ['E', 1, 9, "MACKAY'S BAKERY", '#2f4a2a'], ['E', 12, 18, 'TABLET & TEA', '#5b1b2a'],
    ['W', 41, 48, 'WITCHERY WOOLS', '#3b2350'], ['E', 32, 39, 'CANDLEMAKER', '#1d3b2a'],
  ];
  for (const [side, z0, z1, name, col] of shops) {
    const s = side === 'W' ? -1 : 1, x = s * 6.94, len = z1 - z0, zc = (z0 + z1) / 2;
    const yb = zc > RAMP.z0 ? RAMP.rise * Math.min(1, (zc - RAMP.z0) / (RAMP.z1 - RAMP.z0)) : 0;
    box(x, yb + 1.6, zc, 0.12, 3.2, len, wood(col, len / 2, 1.6), { phys: false });
    box(x - s * 0.02, yb + 1.5, zc - len * 0.15, 0.1, 1.8, len * 0.45, M(0x2b3a48, { emissive: 0x3a2f1a, roughness: 0.15, metalness: 0.3 }), { phys: false });
    sign(name, x - s * 0.08, yb + 2.85, zc, Math.min(len - 0.4, 5.5), 0.55, -s * Math.PI / 2, col, '#f1d98a');
  }

  // ---------- street furniture ----------
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const lamps = [];
  function lamppost(x, z, base = PAVE) {
    const p = cyl(x, base + 2.1, z, 0.07, 0.11, 4.2, iron);
    cyl(x, base + 4.4, z, 0.22, 0.12, 0.45, lampMat, { phys: false, seg: 6 });
    cyl(x, base + 4.7, z, 0.02, 0.26, 0.2, iron, { phys: false, seg: 6 });
    lamps.push(p); return p;
  }
  for (let z = -44; z <= 26; z += 14) { lamppost(-4.85, z); if (z + 7 !== 5 && z + 7 < 30) lamppost(4.85, z + 7); }
  function bollard(x, z, y = PAVE) { cyl(x, y + 0.45, z, 0.1, 0.13, 0.9, iron, { seg: 8 }); cyl(x, y + 0.95, z, 0.13, 0.13, 0.1, M(0xd4af37), { phys: false, seg: 8 }); }
  for (const x of [-6.3, -5.4, 5.4, 6.3]) bollard(x, 28.8);
  for (const z of [-11, -7.5]) bollard(-6.3, z);
  // railings: south end and terrace edge (with view to the Castle)
  function railings(x0, x1, z, y) {
    const n = Math.floor((x1 - x0) / 0.18), g = new THREE.CylinderGeometry(0.018, 0.018, 1.1, 4);
    const im = new THREE.InstancedMesh(g, iron, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeTranslation(x0 + i * 0.18, y + 0.55, z); im.setMatrixAt(i, m); }
    scene.add(im); box((x0 + x1) / 2, y + 1.1, z, x1 - x0, 0.05, 0.06, iron, { phys: false });
    box((x0 + x1) / 2, y + 0.3, z, x1 - x0, 0.6, 0.35, stoneMat); // low wall
  }
  railings(-7, 7, -50.2, 0); railings(-7, 7, 66.2, RAMP.rise);
  invisibleWall(0, 6, -50.6, 14, 12, 0.4); invisibleWall(0, 9, 66.6, 14, 12, 0.4);
  // ---------- skyline: Castle on its rock, Old Town roofs, a spire ----------
  const rockMat = M(0x4a4c44, { ...pbr('sandstone', 6, 3, { normal: false }), roughness: 1, envMapIntensity: 0.2 }), castleMat = M(0x9a9080, pbr('sandstone', 8, 2, { normal: false }));
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(40, 1), rockMat); rock.scale.set(1.6, 0.75, 1); rock.position.set(0, 6, 200); scene.add(rock);
  const cbox = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), castleMat); m.position.set(x, y, z); scene.add(m); };
  cbox(0, 40, 190, 60, 14, 18); cbox(-24, 48, 188, 12, 16, 12); cbox(14, 50, 192, 16, 22, 14); cbox(30, 44, 186, 10, 12, 10);
  cbox(-6, 44, 180, 30, 6, 4); // battery wall
  for (let x = -28; x <= 28; x += 4) cbox(x, 48, 181, 2, 2, 2);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10), iron); flagPole.position.set(14, 66, 192); scene.add(flagPole);
  const saltire = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: saltireTex(), side: THREE.DoubleSide }));
  saltire.position.set(17, 69, 192); scene.add(saltire);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4, 40, 6), castleMat); spire.position.set(-70, 30, 150); scene.add(spire);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M(0x7d6b55), 120), mm = new THREE.Matrix4();
  for (let i = 0; i < 120; i++) {
    const x = (Math.random() - 0.5) * 220, z = 75 + Math.random() * 90, h = 6 + Math.random() * 6 + Math.abs(x) * 0.08;
    mm.compose(new THREE.Vector3(x, h / 2 - 4, z), new THREE.Quaternion(), new THREE.Vector3(8 + Math.random() * 10, h, 6 + Math.random() * 8));
    roofs.setMatrixAt(i, mm);
  }
  scene.add(roofs);

  // ---------- targets ----------
  const ring = (x, y, z, r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 32), new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.03, z); scene.add(m); return m;
  };
  function addTarget(t) { t.ring = ring(t.pos.x, t.pos.y, t.pos.z, t.ringR || 1.0); t.done = false; targets.push(t); return t; }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tag = (body, id) => { body.userData = { target: id }; };

  // 1. Communal bin (get it in)
  {
    const x = 5.6, z = -22, w = 1.5, d = 1.0, h = 1.15, y = PAVE, th = 0.06, bm = M(0x3f5a3f);
    box(x, y + 0.05, z, w, 0.1, d, bm);
    box(x - w / 2, y + h / 2, z, th, h, d, bm); box(x + w / 2, y + h / 2, z, th, h, d, bm);
    box(x, y + h / 2, z - d / 2, w, h, th, bm); box(x, y + h / 2, z + d / 2, w, h, th, bm);
    const lid = box(x + 0.15, y + h + 0.45, z + d / 2 + 0.05, w, 0.9, 0.05, M(0x2f4a2f), { phys: false }); lid.mesh.rotation.x = -0.3;
    sign('GENERAL WASTE', x - w / 2 - 0.04, y + 0.75, z, 0.9, 0.18, -Math.PI / 2, '#2f4a2f', '#fff', 'bold 60px Arial');
    addTarget({ id: 'bin', name: 'Communal Bin', hint: 'get it IN the bin', points: 150, kind: 'zone', pos: V(x, y, z), ringR: 1.3,
      zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)),
      lines: ["Straight in the bucket! The cooncil thanks you.", "Recycling? Close enough.", "Bin there, done that."] });
  }
  // 2. Bench
  {
    const x = -5.9, z = -18, bm = wood(0x8a6a48, 1, 2);
    const parts = [box(x, PAVE + 0.45, z, 0.5, 0.08, 1.9, bm), box(x - 0.25, PAVE + 0.8, z, 0.08, 0.6, 1.9, bm)];
    for (const dz of [-0.8, 0.8]) parts.push(box(x, PAVE + 0.22, z + dz, 0.45, 0.44, 0.08, iron));
    parts.forEach((q) => tag(q.body, 'bench'));
    const back = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.45, 0.95)) });
    back.position.set(x - 0.05, PAVE + 0.5, z); world.addBody(back); tag(back, 'bench');
    const plaque = sign('In memory of Jimmy, who loved this street', x + 0.04, PAVE + 0.95, z, 1.2, 0.12, Math.PI / 2, '#d4af37', '#3a2a10', 'bold 40px Georgia');
    addTarget({ id: 'bench', name: 'Memorial Bench', hint: 'hit the bench', points: 50, kind: 'hit', pos: V(x, PAVE, z), ringR: 1.2,
      lines: ["Jimmy would've been proud.", "Thunk! Best seat in the Grassmarket.", "That bench has seen worse."] });
  }
  // 3. Traffic cone (knock it over) - dynamic
  {
    const x = 1.2, z = -11;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 12), M(0xff6a00)); mesh.castShadow = sh; scene.add(mesh);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.1, 12), M(0xffffff)); stripe.position.y = 0.05; mesh.add(stripe);
    const baseM = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.45), M(0x222222)); baseM.position.y = -0.33; mesh.add(baseM);
    const body = new CANNON.Body({ mass: 0.6, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.35, 0.16)) }); // box hull: cannon convex-vs-sphere is mushy
    body.position.set(x, 0.36, z); world.addBody(body); tag(body, 'cone');
    dynamics.push({ mesh, body, home: body.position.clone() });
    addTarget({ id: 'cone', name: 'Traffic Cone', hint: 'knock it over', points: 75, kind: 'topple', body, pos: V(x, 0, z),
      lines: ["Cone down! Somewhere in Glasgow, a statue weeps.", "Health and safety has left the chat.", "That cone had it coming."] });
  }
  // 4. Lamppost (thin, pricier)
  {
    const p = lamppost(4.85, -5 + 0); tag(p.body, 'lamp');
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.6), new THREE.MeshLambertMaterial({ color: 0x1e4fa8, side: THREE.DoubleSide }));
    rib.position.set(4.85, 2.4, -5.15); scene.add(rib);
    addTarget({ id: 'lamp', name: 'Lamppost (blue ribbon)', hint: 'ping the post', points: 100, kind: 'hit', pos: V(4.85, PAVE, -5), ringR: 0.8,
      lines: ["PING! Off the post!", "Clang! The whole street heard that.", "Woodwork! ...well, ironwork."] });
  }
  // 5. Close passage (kick it through)
  addTarget({ id: 'close', name: "Kicker's Close", hint: 'kick it through the close', points: 125, kind: 'zone', pos: V(-7.5, 0, -9.25), ringR: 0.7,
    zone: new THREE.Box3(V(-13.5, 0, -10), V(-9, 3, -8.5)), minSpeed: 1,
    lines: ["Threaded the needle! Right through the close.", "Through the pend like a ghost on a tour.", "Sneaky. Very Old Town."] });
  // 6. Wee dug statue in the back court
  {
    const x = -20, z = -12; tag(box(x, 0.6, z, 1.2, 1.2, 1.2, darkStone).body, 'dug');
    const dog = M(0x3d3a33);
    box(x, 1.5, z, 0.35, 0.3, 0.75, dog, { phys: false }); box(x, 1.75, z - 0.42, 0.28, 0.28, 0.3, dog, { phys: false });
    for (const [dx, dz] of [[-0.12, -0.25], [0.12, -0.25], [-0.12, 0.25], [0.12, 0.25]]) box(x + dx, 1.28, z + dz, 0.08, 0.18, 0.08, dog, { phys: false });
    const b = new CANNON.Body({ mass: 0, material: mats.ground, shape: new CANNON.Box(new CANNON.Vec3(0.62, 1.0, 0.62)) });
    b.position.set(x, 1.0, z); world.addBody(b); tag(b, 'dug');
    sign('A FAITHFUL WEE DUG', x + 0.61, 0.8, z, 1.0, 0.16, Math.PI / 2, '#d4af37', '#3a2a10', 'bold 44px Georgia');
    addTarget({ id: 'dug', name: 'Wee Dug Statue', hint: 'hit the statue (find the back court)', points: 125, kind: 'hit', pos: V(x, 0, z), ringR: 1.4,
      lines: ["Sorry, pal! Rub his nose for luck.", "Bobby's cousin did not appreciate that.", "Good boy. Didnae even flinch."] });
  }
  // 7. Bakery door (marked door)
  {
    const door = box(6.84, PAVE + 1.1, 5, 0.1, 2.2, 1.1, M(0xffffff, { map: doorTargetTexture() }));
    tag(door.body, 'door');
    addTarget({ id: 'door', name: "Bakery Door", hint: 'strike the marked door', points: 75, kind: 'hit', pos: V(6.3, PAVE, 5), ringR: 0.9,
      lines: ["Knock knock! 'We're SHUT, son.'", "Mrs Mackay is coming oot. Run.", "One steak bake, special delivery."] });
  }
  // 8. Pillar box
  {
    const p = cyl(-5.5, PAVE + 0.75, 12, 0.3, 0.3, 1.5, M(0xc8102e), { seg: 14 });
    cyl(-5.5, PAVE + 1.55, 12, 0.34, 0.34, 0.12, M(0xc8102e), { phys: false, seg: 14 });
    tag(p.body, 'post');
    addTarget({ id: 'post', name: 'Pillar Box', hint: 'hit the postbox', points: 75, kind: 'hit', pos: V(-5.5, PAVE, 12), ringR: 0.8,
      lines: ["First class!", "Signed for. Delivered.", "Royal Mail: 'Is this a parcel?'"] });
  }
  // 9. Busker's open guitar case (roll it in)
  {
    const x = -1.8, z = 22, cm = M(0x222222), lining = M(0x7a1030);
    box(x, 0.03, z, 1.3, 0.04, 0.6, lining, { phys: false });
    box(x, 0.06, z - 0.32, 1.3, 0.12, 0.04, cm); box(x, 0.06, z + 0.32, 1.3, 0.12, 0.04, cm); box(x - 0.65, 0.06, z, 0.04, 0.12, 0.6, cm);
    const lidC = box(x + 0.0, 0.25, z + 0.55, 1.3, 0.5, 0.04, cm, { phys: false }); lidC.mesh.rotation.x = 0.4;
    sign('TIPS WELCOME', x, 0.08, z, 0.8, 0.14, 0, '#7a1030', '#f1d98a').rotation.x = -Math.PI / 2;
    addTarget({ id: 'case', name: "Busker's Case", hint: 'roll it into the case (open end faces east)', points: 100, kind: 'zone', pos: V(x, 0, z), ringR: 1.0,
      zone: new THREE.Box3(V(x - 0.62, 0, z - 0.3), V(x + 0.65, 0.4, z + 0.3)), maxSpeed: 4,
      lines: ["Busker: 'Cheers pal, but I wanted a fiver.'", "Into the case! Encore!", "That's mair than he made all day."] });
  }
  // 10. Police box on the terrace
  {
    const x = 5.2, z = 56, y = RAMP.rise, pb = M(0x123a7a);
    const b = box(x, y + 1.3, z, 1.3, 2.6, 1.3, pb); tag(b.body, 'tardis');
    box(x, y + 2.75, z, 1.1, 0.3, 1.1, pb, { phys: false });
    sign('POLICE BOX', x - 0.66, y + 2.35, z, 1.1, 0.2, -Math.PI / 2, '#111', '#fff', 'bold 60px Arial');
    addTarget({ id: 'tardis', name: 'Police Box', hint: 'hit the police box', points: 75, kind: 'hit', pos: V(x - 0.9, y, z), ringR: 1.0,
      lines: ["It's bigger on the inside, but you hit the outside.", "Polis! ...no, it's empty. Phew.", "Exterminate! Wait, wrong show."] });
  }
  // 11. Builders' skip on the terrace (get it in)
  {
    const x = -4.2, z = 61, y = RAMP.rise, w = 2.6, d = 1.6, h = 0.9, th = 0.08, sm = M(0xe0a400);
    box(x, y + 0.05, z, w, 0.1, d, sm);
    box(x - w / 2, y + h / 2, z, th, h, d, sm); box(x + w / 2, y + h / 2, z, th, h, d, sm);
    box(x, y + h / 2, z - d / 2, w, h, th, sm); box(x, y + h / 2, z + d / 2, w, h, th, sm);
    box(x + 0.4, y + 0.25, z + 0.2, 0.8, 0.3, 0.5, M(0x6b5a45), { phys: false });
    addTarget({ id: 'skip', name: "Builders' Skip", hint: 'chip it into the skip', points: 150, kind: 'zone', pos: V(x, y, z), ringR: 1.8,
      zone: new THREE.Box3(V(x - w / 2, y + 0.05, z - d / 2), V(x + w / 2, y + h, z + d / 2)),
      lines: ["In the skip! Tidy.", "Builder: 'Oi! That's ma lunch in there!'", "Chipped in like a pro."] });
  }
  // decorative bench on terrace (with castle view)
  { const x = 0, z = 64.6, y = RAMP.rise, bm = wood(0x8a6a48, 2, 1); box(x, y + 0.45, z, 1.9, 0.08, 0.5, bm); box(x, y + 0.22, z, 1.7, 0.44, 0.3, iron); }

  // pigeons
  const pigeons = [];
  const pg = new THREE.SphereGeometry(0.09, 6, 4), ph = new THREE.SphereGeometry(0.05, 6, 4), pmat = M(0x6f7480), phm = M(0x4b5f6a);
  for (const [cx, cy, cz] of [[-1, 0, -26], [3, 0, 8], [-3, 0, 16], [-18, 0, -5], [1, RAMP.rise, 60]]) {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); const b = new THREE.Mesh(pg, pmat); b.scale.set(1, 0.8, 1.4); g.add(b);
      const hd = new THREE.Mesh(ph, phm); hd.position.set(0, 0.08, -0.1); g.add(hd);
      const home = new THREE.Vector3(cx + (Math.random() - 0.5) * 2, cy + 0.08, cz + (Math.random() - 0.5) * 2);
      g.position.copy(home); g.rotation.y = Math.random() * 6.28; scene.add(g);
      pigeons.push({ g, home, state: 'idle', t: Math.random() * 3, vel: new THREE.Vector3() });
    }
  }
  return { targets, dynamics, pigeons };
}

function saltireTex() {
  const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = '#005eb8'; g.fillRect(0, 0, 120, 80); g.strokeStyle = '#fff'; g.lineWidth = 14;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 80); g.moveTo(120, 0); g.lineTo(0, 80); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function groundHeightAt(z) {
  if (z <= RAMP.z0) return 0;
  if (z >= RAMP.z1) return RAMP.rise;
  return RAMP.rise * (z - RAMP.z0) / (RAMP.z1 - RAMP.z0);
}
