// As figuras em 2D (metros, no plano da figura, centradas na origem, y para cima) e a geometria
// de cada pedaço. Sem navegador nem Three.js.
//
// Pedaços:
//   bar  { a, b, w }            traço reto de a até b, espessura w (as pontas passam w/2)
//   rect { p, w, h, r }         placa w x h centrada em p, girada r graus
//   disc { p, r }               disco de raio r
//   arc  { p, r, w, a0, a1 }    arco de círculo (graus, anti-horário), espessura w
//   tri  { pts: [a, b, c] }     placa triangular
//   cube { p, size, r }         cubo de lado size
// Campos comuns: col (cor), d (profundidade, opcional), on (índice do pedaço que fica por baixo:
// do ponto de vista, este tem que ficar na frente dele).
import { DEG } from './math3.js';

export const COL = {
  red: '#e0412f', orange: '#f08a24', yellow: '#f2c230', green: '#3aa655', dkgreen: '#21794a',
  teal: '#1f9e9a', blue: '#2c6fd1', navy: '#23366e', purple: '#8a4fc9', pink: '#ef7fa8',
  ink: '#2a2a2e', brown: '#8a5a35', sand: '#e3b77a', white: '#fafafa', gray: '#8d939c', gold: '#e8b22c',
};

const P = (s, o) => ({ s, ...o });

export const FIGURES = {
  peixe: {
    name: 'Peixe',
    pieces: [
      P('arc', { p: [0.02, -0.2], r: 0.36, w: 0.05, a0: 35, a1: 145, col: COL.orange }),
      P('arc', { p: [0.02, 0.2], r: 0.36, w: 0.05, a0: 215, a1: 325, col: COL.orange }),
      P('tri', { pts: [[-0.27, 0], [-0.5, 0.17], [-0.5, -0.17]], col: COL.red }),
      P('disc', { p: [0.19, 0.04], r: 0.035, col: COL.ink }),
      P('tri', { pts: [[-0.08, 0.17], [0.1, 0.17], [-0.14, 0.3]], col: COL.red }),
      P('tri', { pts: [[-0.02, -0.17], [0.1, -0.17], [-0.06, -0.27]], col: COL.red }),
      P('arc', { p: [0.13, 0.0], r: 0.1, w: 0.03, a0: 140, a1: 220, col: COL.yellow }),
      P('cube', { p: [0.44, 0.16], size: 0.05, r: 20, col: COL.blue }),
      P('cube', { p: [0.5, 0.3], size: 0.035, r: 40, col: COL.blue }),
    ],
  },
  casa: {
    name: 'Casa',
    pieces: [
      P('bar', { a: [-0.3, -0.33], b: [-0.3, 0.05], w: 0.05, col: COL.blue }),
      P('bar', { a: [0.3, -0.33], b: [0.3, 0.05], w: 0.05, col: COL.blue }),
      P('bar', { a: [-0.3, -0.35], b: [0.3, -0.35], w: 0.05, col: COL.navy }),
      P('tri', { pts: [[-0.42, 0.08], [0.42, 0.08], [0, 0.4]], col: COL.red }),
      P('rect', { p: [0, -0.2], w: 0.14, h: 0.25, col: COL.brown }),
      P('rect', { p: [-0.16, -0.08], w: 0.12, h: 0.12, col: COL.yellow }),
      P('rect', { p: [0.16, -0.08], w: 0.12, h: 0.12, col: COL.yellow }),
      P('rect', { p: [0.24, 0.32], w: 0.07, h: 0.16, col: COL.ink }),
      P('disc', { p: [-0.42, 0.36], r: 0.07, col: COL.orange }),
    ],
  },
  passaro: {
    name: 'Pássaro',
    pieces: [
      P('disc', { p: [0, 0], r: 0.14, col: COL.teal }),
      P('disc', { p: [0.2, 0.13], r: 0.08, col: COL.teal }),
      P('tri', { pts: [[0.27, 0.15], [0.37, 0.12], [0.27, 0.09]], col: COL.orange }),
      P('disc', { p: [0.22, 0.15], r: 0.018, col: COL.ink, on: 1 }),
      P('tri', { pts: [[-0.06, 0.05], [0.11, 0.05], [-0.16, 0.32]], col: COL.navy, on: 0 }),
      P('tri', { pts: [[-0.12, -0.02], [-0.4, 0.09], [-0.36, -0.1]], col: COL.navy }),
      P('bar', { a: [-0.03, -0.15], b: [-0.05, -0.29], w: 0.02, col: COL.orange }),
      P('bar', { a: [0.04, -0.15], b: [0.06, -0.29], w: 0.02, col: COL.orange }),
      P('bar', { a: [-0.36, -0.32], b: [0.36, -0.32], w: 0.04, col: COL.brown }),
      P('tri', { pts: [[0.22, -0.31], [0.3, -0.31], [0.34, -0.22]], col: COL.green }),
    ],
  },
  barco: {
    name: 'Barco',
    pieces: [
      P('rect', { p: [0, -0.15], w: 0.5, h: 0.12, col: COL.red }),
      P('tri', { pts: [[-0.25, -0.09], [-0.25, -0.21], [-0.38, -0.09]], col: COL.red }),
      P('tri', { pts: [[0.25, -0.09], [0.25, -0.21], [0.38, -0.09]], col: COL.red }),
      P('bar', { a: [0, -0.07], b: [0, 0.4], w: 0.03, col: COL.brown }),
      P('tri', { pts: [[0.03, 0.37], [0.03, -0.04], [0.3, -0.04]], col: COL.yellow }),
      P('tri', { pts: [[-0.03, 0.3], [-0.03, -0.04], [-0.22, -0.04]], col: COL.orange }),
      P('tri', { pts: [[0.015, 0.42], [0.015, 0.48], [0.1, 0.45]], col: COL.blue }),
      P('arc', { p: [-0.3, -0.3], r: 0.07, w: 0.03, a0: 0, a1: 180, col: COL.blue }),
      P('arc', { p: [-0.1, -0.3], r: 0.07, w: 0.03, a0: 0, a1: 180, col: COL.blue }),
      P('arc', { p: [0.1, -0.3], r: 0.07, w: 0.03, a0: 0, a1: 180, col: COL.blue }),
      P('arc', { p: [0.3, -0.3], r: 0.07, w: 0.03, a0: 0, a1: 180, col: COL.blue }),
    ],
  },
  rosto: {
    name: 'Rosto',
    pieces: [
      P('arc', { p: [0, 0], r: 0.3, w: 0.04, a0: 0, a1: 360, col: COL.orange }),
      P('disc', { p: [-0.11, 0.08], r: 0.045, col: COL.ink }),
      P('disc', { p: [0.11, 0.08], r: 0.045, col: COL.ink }),
      P('bar', { a: [-0.17, 0.17], b: [-0.06, 0.19], w: 0.025, col: COL.brown }),
      P('bar', { a: [0.06, 0.19], b: [0.17, 0.17], w: 0.025, col: COL.brown }),
      P('tri', { pts: [[0, 0.04], [-0.04, -0.05], [0.04, -0.05]], col: COL.red }),
      P('arc', { p: [0, -0.02], r: 0.16, w: 0.035, a0: 205, a1: 335, col: COL.red }),
      P('disc', { p: [-0.19, -0.07], r: 0.04, col: COL.pink }),
      P('disc', { p: [0.19, -0.07], r: 0.04, col: COL.pink }),
      P('tri', { pts: [[-0.21, 0.24], [-0.09, 0.31], [-0.25, 0.43]], col: COL.brown }),
      P('tri', { pts: [[-0.06, 0.32], [0.06, 0.32], [0, 0.47]], col: COL.brown }),
      P('tri', { pts: [[0.09, 0.31], [0.21, 0.24], [0.25, 0.43]], col: COL.brown }),
      P('arc', { p: [-0.33, 0.02], r: 0.06, w: 0.03, a0: 90, a1: 270, col: COL.orange }),
      P('arc', { p: [0.33, 0.02], r: 0.06, w: 0.03, a0: -90, a1: 90, col: COL.orange }),
      P('cube', { p: [0, -0.4], size: 0.06, r: 45, col: COL.purple }),
    ],
  },
  chave: {
    name: 'Chave',
    tip: [0.375, 0], // ponta da chave (para entrar na fechadura)
    pieces: [
      P('arc', { p: [-0.25, 0], r: 0.12, w: 0.05, a0: 0, a1: 360, col: COL.gold }),
      P('bar', { a: [-0.105, 0], b: [0.35, 0], w: 0.05, col: COL.gold }),
      P('bar', { a: [0.33, -0.02], b: [0.33, -0.13], w: 0.045, col: COL.orange }),
      P('bar', { a: [0.25, -0.02], b: [0.25, -0.1], w: 0.045, col: COL.orange }),
      P('bar', { a: [0.17, -0.02], b: [0.17, -0.07], w: 0.04, col: COL.orange }),
      P('disc', { p: [-0.25, 0], r: 0.045, col: COL.red }),
      P('cube', { p: [-0.25, 0.17], size: 0.05, r: 45, col: COL.red }),
    ],
  },
  arvore: {
    name: 'Árvore',
    pieces: [
      P('rect', { p: [0, -0.21], w: 0.09, h: 0.2, col: COL.brown }),
      P('tri', { pts: [[-0.3, -0.1], [0.3, -0.1], [0, 0.16]], col: COL.dkgreen }),
      P('tri', { pts: [[-0.24, 0.07], [0.24, 0.07], [0, 0.31]], col: COL.green, on: 1 }),
      P('tri', { pts: [[-0.17, 0.23], [0.17, 0.23], [0, 0.44]], col: COL.dkgreen, on: 2 }),
      P('cube', { p: [0, 0.5], size: 0.07, r: 45, col: COL.yellow }),
      P('disc', { p: [-0.12, -0.04], r: 0.03, col: COL.red, on: 1 }),
      P('disc', { p: [0.1, 0.12], r: 0.03, col: COL.orange, on: 2 }),
      P('bar', { a: [-0.32, -0.33], b: [0.32, -0.33], w: 0.04, col: COL.green }),
    ],
  },
  gato: {
    name: 'Gato',
    pieces: [
      P('disc', { p: [0, 0.15], r: 0.14, col: COL.gray }),
      P('tri', { pts: [[-0.14, 0.2], [-0.04, 0.27], [-0.14, 0.37]], col: COL.gray }),
      P('tri', { pts: [[0.14, 0.2], [0.04, 0.27], [0.14, 0.37]], col: COL.gray }),
      P('disc', { p: [0, -0.16], r: 0.16, col: COL.ink }),
      P('disc', { p: [-0.05, 0.17], r: 0.025, col: COL.green, on: 0 }),
      P('disc', { p: [0.05, 0.17], r: 0.025, col: COL.green, on: 0 }),
      P('tri', { pts: [[-0.02, 0.12], [0.02, 0.12], [0, 0.095]], col: COL.pink, on: 0 }),
      P('bar', { a: [-0.05, 0.1], b: [-0.21, 0.12], w: 0.012, col: COL.ink, on: 0 }),
      P('bar', { a: [0.05, 0.1], b: [0.21, 0.12], w: 0.012, col: COL.ink, on: 0 }),
      P('arc', { p: [0.27, -0.18], r: 0.11, w: 0.04, a0: -90, a1: 90, col: COL.ink }),
    ],
  },
  foguete: {
    name: 'Foguete',
    pieces: [
      P('rect', { p: [0, 0], w: 0.16, h: 0.44, col: COL.gray }),
      P('tri', { pts: [[-0.08, 0.22], [0.08, 0.22], [0, 0.37]], col: COL.red }),
      P('disc', { p: [0, 0.08], r: 0.045, col: COL.blue, on: 0 }),
      P('tri', { pts: [[-0.08, -0.22], [-0.08, -0.07], [-0.19, -0.26]], col: COL.red }),
      P('tri', { pts: [[0.08, -0.22], [0.08, -0.07], [0.19, -0.26]], col: COL.red }),
      P('tri', { pts: [[-0.06, -0.225], [0.06, -0.225], [0, -0.4]], col: COL.orange }),
      P('cube', { p: [-0.3, 0.3], size: 0.04, r: 45, col: COL.yellow }),
      P('cube', { p: [0.28, 0.2], size: 0.035, r: 45, col: COL.yellow }),
      P('cube', { p: [-0.25, -0.1], size: 0.03, r: 45, col: COL.yellow }),
    ],
  },
  relogio: {
    name: 'Relógio',
    pieces: [
      P('arc', { p: [0, 0], r: 0.3, w: 0.045, a0: 0, a1: 360, col: COL.red }),
      P('bar', { a: [0, 0.26], b: [0, 0.2], w: 0.03, col: COL.ink }),
      P('bar', { a: [0.26, 0], b: [0.2, 0], w: 0.03, col: COL.ink }),
      P('bar', { a: [0, -0.26], b: [0, -0.2], w: 0.03, col: COL.ink }),
      P('bar', { a: [-0.26, 0], b: [-0.2, 0], w: 0.03, col: COL.ink }),
      P('bar', { a: [0, 0.02], b: [0, 0.19], w: 0.025, col: COL.blue }),
      P('bar', { a: [0.02, 0], b: [0.13, 0], w: 0.035, col: COL.navy }),
      P('cube', { p: [0, 0], size: 0.04, r: 45, col: COL.ink }),
      P('bar', { a: [-0.18, -0.26], b: [-0.25, -0.38], w: 0.035, col: COL.red }),
      P('bar', { a: [0.18, -0.26], b: [0.25, -0.38], w: 0.035, col: COL.red }),
      P('arc', { p: [-0.21, 0.29], r: 0.08, w: 0.035, a0: 20, a1: 200, col: COL.gold }),
      P('arc', { p: [0.21, 0.29], r: 0.08, w: 0.035, a0: -20, a1: 160, col: COL.gold }),
    ],
  },
};

// Ponte: tabuleiro com o topo em v = 0, de u = -L/2 a L/2, com arco por baixo.
export function bridgeFigure(L) {
  const pieces = [];
  const n = 3, seg = L / n, w = 0.06;
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + i * seg, x1 = x0 + seg;
    pieces.push(P('bar', { a: [x0 + w / 2 + 0.003, -w / 2], b: [x1 - w / 2 - 0.003, -w / 2], w, d: 0.18, col: i === 1 ? COL.orange : COL.sand }));
  }
  const h = 0.2, R = ((L / 2) ** 2 + h * h) / (2 * h), yc = -0.08 - R;
  const th = Math.asin((L / 2) / R) / DEG;
  pieces.push(P('arc', { p: [0, yc], r: R, w: 0.04, d: 0.08, a0: 90 - th, a1: 90 + th, col: COL.blue }));
  for (const u of [-L / 3.2, L / 3.2]) {
    const y = yc + Math.sqrt(R * R - u * u);
    if (-w - y > 0.03) pieces.push(P('bar', { a: [u, y + 0.01], b: [u, -w - 0.01], w: 0.02, d: 0.04, col: COL.yellow }));
  }
  return { name: 'Ponte', pieces, pad: 0.09 };
}

// Escada: degraus soltos subindo de (-L/2, -H/2) até (L/2, H/2). Devolve também o caminho do robô.
export function stairsFigure(L, H, n = 4) {
  const pieces = [], rise = H / (n + 1), run = L / n;
  const tops = [];
  for (let i = 0; i < n; i++) {
    const u0 = -L / 2 + i * run, top = -H / 2 + (i + 1) * rise;
    tops.push([u0, top]);
    pieces.push(P('rect', { p: [u0 + run / 2, top - 0.03], w: run - 0.012, h: 0.06, d: 0.2, col: i % 2 ? COL.teal : COL.purple }));
  }
  pieces.push(P('bar', { a: [-L / 2 + 0.04, -H / 2 - 0.05], b: [L / 2 - 0.06, -H / 2 + n * rise - 0.1], w: 0.03, d: 0.05, col: COL.pink }));
  const path = [[-L / 2 - 0.09, -H / 2]];
  let prev = -H / 2;
  for (const [u0, top] of tops) { path.push([u0 + 0.015, prev], [u0 + 0.015, top]); prev = top; }
  path.push([L / 2 + 0.015, prev], [L / 2 + 0.015, H / 2], [L / 2 + 0.09, H / 2]);
  return { name: 'Escada', pieces, pad: 0.09, path };
}

// Centro, giro (radianos) e forma 3D local de um pedaço. Eixos locais: x = direita da figura,
// y = cima da figura, z = normal (para o lado de quem olha).
export function pieceGeom(pc) {
  switch (pc.s) {
    case 'bar': {
      const dx = pc.b[0] - pc.a[0], dy = pc.b[1] - pc.a[1];
      return {
        center: [(pc.a[0] + pc.b[0]) / 2, (pc.a[1] + pc.b[1]) / 2], rot: Math.atan2(dy, dx),
        geom: { kind: 'box', sx: Math.hypot(dx, dy) + pc.w, sy: pc.w, sz: pc.d ?? pc.w },
      };
    }
    case 'rect': return { center: pc.p, rot: (pc.r || 0) * DEG, geom: { kind: 'box', sx: pc.w, sy: pc.h, sz: pc.d ?? 0.05 } };
    case 'cube': return { center: pc.p, rot: (pc.r || 0) * DEG, geom: { kind: 'box', sx: pc.size, sy: pc.size, sz: pc.d ?? pc.size } };
    case 'disc': return { center: pc.p, rot: 0, geom: { kind: 'cyl', r: pc.r, d: pc.d ?? 0.05 } };
    case 'arc': return { center: pc.p, rot: pc.a0 * DEG, geom: { kind: 'torus', r: pc.r, tube: pc.w / 2, arc: (pc.a1 - pc.a0) * DEG, d: pc.d } };
    case 'tri': {
      const c = [(pc.pts[0][0] + pc.pts[1][0] + pc.pts[2][0]) / 3, (pc.pts[0][1] + pc.pts[1][1] + pc.pts[2][1]) / 3];
      return { center: c, rot: 0, geom: { kind: 'prism', pts: pc.pts.map(p => [p[0] - c[0], p[1] - c[1]]), d: pc.d ?? 0.05 } };
    }
    default: throw new Error(`pedaço desconhecido: ${pc.s}`);
  }
}

// Simetria do pedaço em volta da normal (para conferir o giro de um pedaço mexido):
// 'round' = qualquer giro serve, número = passo em graus, 0 = sem simetria.
export function pieceSymmetry(pc) {
  if (pc.s === 'disc' || (pc.s === 'arc' && pc.a1 - pc.a0 >= 359)) return 'round';
  if (pc.s === 'cube') return 90;
  if (pc.s === 'bar' || pc.s === 'rect') return 180;
  return 0;
}

// Ponto sorteado em cima do pedaço, em coordenadas 2D da figura (para a poeira).
export function samplePiece(pc, rnd) {
  switch (pc.s) {
    case 'bar': { const t = rnd(); return [pc.a[0] + (pc.b[0] - pc.a[0]) * t, pc.a[1] + (pc.b[1] - pc.a[1]) * t]; }
    case 'rect': case 'cube': {
      const w = pc.s === 'cube' ? pc.size : pc.w, h = pc.s === 'cube' ? pc.size : pc.h;
      const x = (rnd() - 0.5) * w, y = (rnd() - 0.5) * h, r = (pc.r || 0) * DEG;
      return [pc.p[0] + x * Math.cos(r) - y * Math.sin(r), pc.p[1] + x * Math.sin(r) + y * Math.cos(r)];
    }
    case 'disc': { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * pc.r; return [pc.p[0] + Math.cos(a) * r, pc.p[1] + Math.sin(a) * r]; }
    case 'arc': { const a = (pc.a0 + rnd() * (pc.a1 - pc.a0)) * DEG; return [pc.p[0] + Math.cos(a) * pc.r, pc.p[1] + Math.sin(a) * pc.r]; }
    case 'tri': {
      let a = rnd(), b = rnd();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const [p0, p1, p2] = pc.pts;
      return [p0[0] + (p1[0] - p0[0]) * a + (p2[0] - p0[0]) * b, p0[1] + (p1[1] - p0[1]) * a + (p2[1] - p0[1]) * b];
    }
    default: return [0, 0];
  }
}

// Área aproximada (para distribuir a poeira de forma justa entre pedaços).
export function pieceArea(pc) {
  switch (pc.s) {
    case 'bar': return Math.hypot(pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]) * pc.w + 0.002;
    case 'rect': return pc.w * pc.h;
    case 'cube': return pc.size * pc.size;
    case 'disc': return Math.PI * pc.r * pc.r;
    case 'arc': return Math.abs(pc.a1 - pc.a0) * DEG * pc.r * pc.w;
    case 'tri': { const [a, b, c] = pc.pts; return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
    default: return 0.01;
  }
}
