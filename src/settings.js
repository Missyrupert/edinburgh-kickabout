// Graphics presets. Pick order: ?preset= URL param > saved choice > auto.
const q = new URLSearchParams(location.search);
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
export const IS_MOBILE = IS_TOUCH || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

export const PRESETS = {
  // Lambert lighting, 512 px colour maps, no normal maps, no shadows, no AA, lower resolution cap.
  low: { name: 'low', pbr: false, normalMaps: false, texSize: 512, shadows: false, antialias: false, maxPixelRatio: 1.0, minScale: 0.5, env: false, ballSeg: [20, 14], fogFar: 260 },
  // Lambert + normal maps, 1K colour maps, no shadows.
  medium: { name: 'medium', pbr: false, normalMaps: true, texSize: 1024, shadows: false, antialias: false, maxPixelRatio: 1.5, minScale: 0.6, env: false, ballSeg: [28, 20], fogFar: 320 },
  // PBR (MeshStandard + HDRI reflections), normal + roughness maps, one 2048 shadow map, AA.
  high: { name: 'high', pbr: true, normalMaps: true, texSize: 1024, shadows: true, antialias: true, maxPixelRatio: 2.0, minScale: 0.7, env: true, ballSeg: [40, 28], fogFar: 340 },
};

function autoPreset() {
  if (!IS_MOBILE) return 'high';
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  return mem >= 6 && cores >= 8 ? 'medium' : 'low';
}
const fromUrl = q.get('preset');
let saved = null; try { saved = localStorage.getItem('ek-preset'); } catch {}
const choice = PRESETS[fromUrl] ? fromUrl : PRESETS[saved] ? saved : null;
export const PRESET = PRESETS[choice || autoPreset()];
export const PRESET_SOURCE = PRESETS[fromUrl] ? 'url' : PRESETS[saved] ? 'saved' : 'auto';
export const SHOW_PERF = q.get('perf') === '1';
export const DYNRES = q.get('dynres') !== '0';

export function choosePreset(name) {
  try { if (name === 'auto') localStorage.removeItem('ek-preset'); else localStorage.setItem('ek-preset', name); } catch {}
  const u = new URL(location.href); u.searchParams.delete('preset'); location.href = u.toString();
}
