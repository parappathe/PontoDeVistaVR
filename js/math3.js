// Vetores [x, y, z] e quatérnios [x, y, z, w] em arrays simples. Sem navegador nem Three.js.
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerpN = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Ângulo entre dois vetores (estável para ângulos pequenos).
export const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));

export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qAxis(axis, ang) {
  const n = norm(axis), s = Math.sin(ang / 2);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)];
}
export function qRotate(q, v) {
  const [qx, qy, qz, qw] = q, [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
}
// Quatérnio da base ortonormal (colunas r, u, n = eixos x, y, z locais).
export function qFromBasis(r, u, n) {
  const m00 = r[0], m01 = u[0], m02 = n[0], m10 = r[1], m11 = u[1], m12 = n[1], m20 = r[2], m21 = u[2], m22 = n[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return qNorm(q);
}
export const qNorm = (q) => { const l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
// Ângulo da rotação que leva a até b (0 a π).
export function qAngle(a, b) {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}
export function qSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) return qNorm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + bb[i] * wb);
}
// Câmera sem rolagem olhando na direção dir (como a câmera do PC): giro em Y e depois em X.
export function yawPitchOf(dir) {
  const d = norm(dir);
  return { yaw: Math.atan2(-d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) };
}
export const qYawPitch = (yaw, pitch) => qMul(qAxis([0, 1, 0], yaw), qAxis([1, 0, 0], pitch));
export const qLook = (dir) => { const { yaw, pitch } = yawPitchOf(dir); return qYawPitch(yaw, pitch); };

// Sorteio determinístico (mulberry32): a mesma semente dá sempre a mesma fase.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
