// v3.9: first-person kicking leg as a small rig (thigh -> knee -> shin -> ankle -> boot), smooth silhouettes (extruded rounded
// sole + bevelled, shaped upper, lathed shin/calf and thigh), vertex-coloured with baked light (no textures). Cosmetic only:
// the kick's physics and timing are untouched - pose(k) just bends the knee and ankle through the same 0..1 kick clock.
import * as THREE from 'three';

const LIGHT = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
function bake(parts) { // parts: [geometry, colour | (pos) => colour]
  const out = [];
  for (const [g0, c] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const P = g.attributes.position, N = g.attributes.normal, n = P.count, arr = new Float32Array(n * 3), col = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); col.set(typeof c === 'function' ? c(v) : c); const l = Math.min(1.12, 0.6 + 0.55 * Math.max(0, N.getX(i) * LIGHT.x + N.getY(i) * LIGHT.y + N.getZ(i) * LIGHT.z)); arr.set([Math.min(1, col.r * l), Math.min(1, col.g * l), Math.min(1, col.b * l)], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); out.push(g); }
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) { const tot = out.reduce((a, p) => a + p.attributes[k].array.length, 0), arr = new Float32Array(tot); let o = 0; for (const p of out) { arr.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(arr, out[0].attributes[k].itemSize)); }
  return g;
}
const footShape = () => { const s = new THREE.Shape(); // top view outline; shape-y = forward (toe)
  s.moveTo(0, -0.075); s.bezierCurveTo(0.044, -0.075, 0.045, -0.02, 0.046, 0.03); s.bezierCurveTo(0.05, 0.09, 0.058, 0.15, 0.05, 0.19);
  s.bezierCurveTo(0.04, 0.226, 0.012, 0.232, -0.004, 0.232); s.bezierCurveTo(-0.03, 0.23, -0.05, 0.2, -0.052, 0.16); s.bezierCurveTo(-0.056, 0.1, -0.042, 0.05, -0.042, 0.02); s.bezierCurveTo(-0.044, -0.03, -0.045, -0.075, 0, -0.075); return s; };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lathe = (prof, n = 18) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n);

export function makeLeg(style, material) {
  const ankleY = 0.1, A0 = new THREE.Vector3(0, ankleY, 0.03), dS = new THREE.Vector3(0.32, -0.78, 0.54).normalize(), Ls = 0.4, dT = new THREE.Vector3(0.3, -0.92, 0.25).normalize();
  const K0 = A0.clone().addScaledVector(dS, Ls); // the knee (rest pose)
  function geos(style) {
    const classic = style === 'boots', UPPER = classic ? 0x1c1c1c : 0x30478a, TOE = classic ? 0x262626 : 0x3a55a0, FLASH = classic ? 0xf2f2ee : 0xc8ec3c, SOLE = classic ? 0x3a3a3a : 0xf0ede4,
      STUD = classic ? 0xa0a0a0 : 0x3a3a3a, SOCK = classic ? 0x1c1c1c : 0xf3f1ea, HOOP = classic ? 0xf2f2ee : 0x6B3F73, SKIN = 0xe0a882, SHORTS = 0x23304f, LACE = 0xfafaf6;
    // ---- boot, in the ankle frame (ankle at the origin, sole underside at y = -ankleY, toe towards -z) ----
    const T = (g, x, y, z) => { g.translate(x, y, z); return g; }, sh = footShape(), base = -ankleY;
    const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 }); sole.rotateX(-Math.PI / 2); T(sole, 0, base + 0.004, -0.03);
    const up = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.011, bevelSegments: 5, curveSegments: 28 }); up.scale(0.93, 0.93, 1); up.rotateX(-Math.PI / 2); up.translate(0, 0.03, 0);
    const prof = (z) => 0.036 + (0.112 - 0.036) * ss(-0.16, -0.02, z); // upper height along the foot: low toe, high at the ankle
    { const p = up.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); p.setY(i, Math.max(0, y) * prof(z) / 0.09); } }
    T(up, 0, base + 0.014, -0.03);
    const upCol = (v) => { const z = v.z, side = Math.abs(v.x) > 0.036, h = v.y - base; if (side && h > 0.022 && h < 0.036 && z > -0.2 && z < 0.02) return FLASH; if (z < -0.17) return TOE; if (z > 0.035 && h > 0.07) return FLASH; return UPPER; };
    const parts = [[sole, SOLE], [up, upCol]];
    for (const [x, z] of [[-0.03, -0.2], [0.03, -0.2], [-0.036, -0.13], [0.036, -0.13], [0, -0.165], [-0.03, 0.02], [0.03, 0.02]]) parts.push([T(new THREE.CylinderGeometry(0.008, 0.011, 0.016, 8), x, base - 0.006, z - 0.03), STUD]);
    for (let k = 0; k < 5; k++) { const z = -0.035 - k * 0.022, g = new THREE.BoxGeometry(0.044 - k * 0.003, 0.005, 0.007); g.rotateX(-0.3); parts.push([T(g, 0, base + 0.014 + prof(z - 0.03) * 1.0 + 0.002, z), LACE]); }
    parts.push([T(new THREE.CylinderGeometry(0.048, 0.052, 0.04, 18), 0, 0.0, 0.0), UPPER]); // collar
    parts.push([new THREE.SphereGeometry(0.045, 16, 12), SOCK]); // ankle
    const foot = bake(parts);
    // ---- shin (knee frame: knee at the origin, the ankle at A0 - K0), lathed with a calf ----
    const sL = Ls, sg = lathe([[0, 0], [0.043, 0], [0.047, 0.08], [0.06, 0.16], [0.062, 0.2], [0.058, 0.27], [0.052, 0.36], [0.05, sL], [0, sL]]);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dS.clone()); const m = new THREE.Matrix4().compose(A0.clone().sub(K0), q, new THREE.Vector3(1, 1, 1));
    const sCol = (v) => { const t = v.y / sL; if (t > 0.5 && t < 0.53 || t > 0.56 && t < 0.59) return HOOP; return t < 0.62 ? SOCK : SKIN; };
    const shinCol = sg.clone(); const sb = bake([[sg, sCol]]); sb.applyMatrix4(m); shinCol.dispose();
    const knee = new THREE.SphereGeometry(0.058, 16, 12); const kb = bake([[knee, SKIN]]);
    const shin = mergeTwo(sb, kb);
    // ---- thigh (legRoot frame), fixed ----
    const tg = lathe([[0, 0], [0.058, 0], [0.068, 0.08], [0.08, 0.2], [0.086, 0.45], [0, 0.45]]);
    const tb = bake([[tg, (v) => (v.y < 0.1 ? SKIN : SHORTS)]]); tb.applyMatrix4(new THREE.Matrix4().compose(K0, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dT), new THREE.Vector3(1, 1, 1)));
    return { foot, shin, thigh: tb };
  }
  function mergeTwo(a, b) { const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) { const x = a.attributes[k].array, y = b.attributes[k].array, arr = new Float32Array(x.length + y.length); arr.set(x); arr.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(arr, a.attributes[k].itemSize)); } return g; }
  const root = new THREE.Group(), kneeP = new THREE.Group(), ankleP = new THREE.Group();
  const mk = (g) => { const m = new THREE.Mesh(g, material); m.renderOrder = 10; m.frustumCulled = false; return m; };
  let G = geos(style); const footM = mk(G.foot), shinM = mk(G.shin), thighM = mk(G.thigh);
  kneeP.position.copy(K0); ankleP.position.copy(A0.clone().sub(K0)); root.add(thighM, kneeP); kneeP.add(shinM, ankleP); ankleP.add(footM);
  // the knee/ankle axis: across the leg (perpendicular to the shin and roughly horizontal)
  const axis = new THREE.Vector3().crossVectors(dS, new THREE.Vector3(0, 0, -1)).normalize();
  const KEYS = [[0, 0, 0], [0.3, 0.6, 0.3], [0.52, -0.12, -0.2], [1, 0, 0]]; // [t, knee bend, ankle] - wind-up, snap through (toe pointed), settle
  function pose(k) { let kb = 0, ab = 0; for (let i = 0; i < KEYS.length - 1; i++) { const [t0, k0, a0] = KEYS[i], [t1, k1, a1] = KEYS[i + 1]; if (k >= t0 && k <= t1) { const s = ss(t0, t1, k); kb = k0 + (k1 - k0) * s; ab = a0 + (a1 - a0) * s; break; } }
    kneeP.quaternion.setFromAxisAngle(axis, kb); ankleP.quaternion.setFromAxisAngle(axis, ab); }
  function setStyle(s) { for (const g of [G.foot, G.shin, G.thigh]) g.dispose(); G = geos(s); footM.geometry = G.foot; shinM.geometry = G.shin; thighM.geometry = G.thigh; }
  const tris = () => (G.foot.attributes.position.count + G.shin.attributes.position.count + G.thigh.attributes.position.count) / 3;
  return { root, pose, setStyle, tris };
}
