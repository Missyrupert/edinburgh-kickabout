import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static-geometry batcher: everything that never moves is transformed into world space,
// tagged with a per-vertex colour (tint + baked grime) and merged into ONE mesh per material.
// This is the main draw-call fix (v1.1 drew ~420 meshes per frame on the phone profile).
export class Batcher {
  constructor() { this.buckets = new Map(); }
  // local: placement matrix (in the street-section frame); frame: section -> world (bend);
  // tile: box-mapped UVs in metres per texture repeat (computed before the bend so textures follow the street).
  add(key, geo, local, color = 0xffffff, { grime = 0, uvScale = null, uvRect = null, shade = null, tile = 0, frame = null, vcol = null } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (local) g.applyMatrix4(local);
    if (tile) {
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ay >= ax && ay >= az) uv.setXY(i, x / tile, z / tile); else if (ax >= az) uv.setXY(i, z / tile, y / tile); else uv.setXY(i, x / tile, y / tile);
      }
    }
    if (uvScale) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]); }
    if (uvRect) { const uv = g.attributes.uv; const [u0, v0, u1, v1] = uvRect; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
    if (frame) g.applyMatrix4(frame);
    const c = new THREE.Color(color), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // baked weathering: darken towards street level (soot / rain splash), optional per-vertex shade fn
      let f = 1;
      if (grime) f *= 1 - grime * Math.max(0, 1 - pos.getY(i) / 5);
      if (shade) f *= shade(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (vcol) { const nor = g.attributes.normal; const k = vcol(i, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)); col[i * 3] = k.r * f; col[i * 3 + 1] = k.g * f; col[i * 3 + 2] = k.b * f; continue; }
      col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
  }
  build(scene, materials, { shadows = false } = {}) {
    const meshes = {};
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, materials[key]);
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.castShadow = shadows && !['sky', 'lamp', 'atlas', 'glass', 'castleRock', 'castleStone'].includes(key); m.receiveShadow = shadows;
      m.name = 'batch:' + key; scene.add(m); meshes[key] = m;
    }
    this.buckets.clear();
    return meshes;
  }
}

// Unit quad facing +Z, centred at origin (used for facade bays and signs)
export const QUAD = new THREE.PlaneGeometry(1, 1);
// Triangular prism for pitched roofs: length along Z, width along X, ridge height h (all 1 = unit).
export function roofPrism() {
  const g = new THREE.BufferGeometry();
  const p = [], n = [], uv = [];
  const quad = (a, b, c, d, nn, u = 1, v = 1) => { for (const q of [a, b, c, a, c, d]) p.push(...q); for (let i = 0; i < 6; i++) n.push(...nn); uv.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v); };
  const tri = (a, b, c, nn) => { p.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) n.push(...nn); uv.push(0, 0, 1, 0, 0.5, 1); };
  const s = Math.SQRT1_2;
  quad([-0.5, 0, 0.5], [-0.5, 0, -0.5], [0, 1, -0.5], [0, 1, 0.5], [-s, s, 0]);
  quad([0.5, 0, -0.5], [0.5, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5], [s, s, 0]);
  tri([-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5], [0, 0, 1]);
  tri([0.5, 0, -0.5], [-0.5, 0, -0.5], [0, 1, -0.5], [0, 0, -1]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
