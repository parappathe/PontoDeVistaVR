// As 15 fases, em 3 grupos de 5 (a última de cada grupo é "mestre"). Sem navegador nem Three.js.
// Coordenadas da galeria em metros: chão y = 0, centro da sala em x = z = 0, -z é "a frente" de
// quem começa no PC. Cada etapa: figura + ponto de vista (eye) + centro da figura (ou plano).
import { FIGURES, bridgeFigure, stairsFigure } from './figures.js';
import { wallPlane, planePoint } from './anamorph.js';
import { add, mul, DEG } from './math3.js';

export const GROUPS = [
  { name: 'Olhar', text: 'Ache o ponto de onde os pedaços viram figura.' },
  { name: 'Mexer', text: 'Fique nas pegadas e ponha no lugar os pedaços soltos.' },
  { name: 'Tornar real', text: 'A figura alinhada vira objeto de verdade.' },
];
export const START = [0, 1.6, 1.35];   // onde o jogador começa no PC (de frente para -z)

// ---------- Ajudantes das fases "Tornar real" ----------
function pad(top, yaw, size = [0.18, 0.22], floating = false) { return { top, yaw, size, floating }; }
function door(pos, yaw) {
  const a = yaw * DEG;
  const r = [Math.cos(a), 0, -Math.sin(a)], n = [Math.sin(a), 0, Math.cos(a)];
  const keyhole = add(add(pos, mul(r, 0.09)), add([0, 0.22, 0], mul(n, 0.025)));
  return { pos, yaw, r, n, keyhole };
}
function bridge({ c, yaw, L, eye, seed }) {
  const figure = bridgeFigure(L), plane = wallPlane(c, yaw);
  const a = planePoint(plane, [-L / 2 - figure.pad, 0]), b = planePoint(plane, [L / 2 + figure.pad, 0]);
  return { a, b, stage: { figure, eye, plane, seed, payoff: [{ type: 'walk', path: [a, b] }] } };
}
function stairs({ c, yaw, L, H, eye, seed }) {
  const figure = stairsFigure(L, H), plane = wallPlane(c, yaw);
  const path = figure.path.map(p => planePoint(plane, p));
  return { a: path[0], b: path[path.length - 1], stage: { figure, eye, plane, seed, payoff: [{ type: 'walk', path }] } };
}
const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

function level11() {
  const s = bridge({ c: [0, 1.0, -0.2], yaw: 0, L: 0.7, eye: [0.6, 1.3, 0.95], seed: 1101 });
  return {
    name: 'A ponte', intro: 'Alinhe a ponte e ela vira de verdade. O robozinho quer atravessar.',
    stages: [s.stage], pads: [pad(s.a, 0), pad(s.b, 0)], robot: { pos: s.a, yaw: yawTo(s.a, s.b) },
  };
}
function level12() {
  const s = stairs({ c: [0.15, 1.05, -0.1], yaw: 90, L: 0.7, H: 0.5, eye: [1.15, 1.35, 0.3], seed: 1202 });
  return {
    name: 'Escada impossível', intro: 'Uma escada até uma plataforma que flutua no ar.',
    stages: [s.stage], pads: [pad(s.a, 90), pad(s.b, 90, [0.18, 0.22], true)], robot: { pos: s.a, yaw: yawTo(s.a, s.b) },
  };
}
function level13() {
  const top = [0.75, 0.8, -0.75], yaw = -45;
  const d = door(add(top, mul([Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], -0.08)), yaw);
  const rpos = add(top, mul(d.n, 0.08));
  return {
    name: 'A chave da porta', intro: 'Forme a chave para abrir a portinha do robô.',
    stages: [{
      figure: FIGURES.chave, eye: [-0.85, 1.5, 0.7], center: [0.1, 1.35, -0.15], seed: 1303,
      payoff: [{ type: 'key' }, { type: 'walk', path: [rpos, add(d.pos, mul(d.n, -0.1))], vanish: true }],
    }],
    pads: [pad(top, yaw, [0.4, 0.4])], door: d, robot: { pos: rpos, yaw: yawTo(rpos, d.pos) },
  };
}
function level14() {
  const s1 = bridge({ c: [-0.35, 0.95, 0.0], yaw: 0, L: 0.6, eye: [-0.55, 1.3, 1.1], seed: 1404 });
  const L2 = 0.6, H2 = 0.4, r2 = [0, 0, -1];
  const c2 = add(add(s1.b, mul(r2, L2 / 2 + 0.09)), [0, H2 / 2, 0]);
  const s2 = stairs({ c: c2, yaw: 90, L: L2, H: H2, eye: [1.05, 1.5, -0.25], seed: 1414 });
  return {
    name: 'Dois olhares', intro: 'Duas figuras, dois pontos de vista: uma depois da outra.',
    stages: [s1.stage, s2.stage],
    pads: [pad(s1.a, 0), pad(s1.b, 0, [0.22, 0.22]), pad(s2.b, 90, [0.18, 0.22], true)],
    robot: { pos: s1.a, yaw: yawTo(s1.a, s1.b) },
  };
}
function level15() {
  const s1 = stairs({ c: [-0.2, 1.0, -0.5], yaw: 0, L: 0.6, H: 0.4, eye: [0.3, 1.45, 0.65], seed: 1505 });
  const padTop = [s1.b[0] + 0.06, s1.b[1], s1.b[2]];
  const d = door([s1.b[0] + 0.14, s1.b[1], s1.b[2]], -90);
  return {
    name: 'O caminho', intro: 'Escada, chave e porta: leve o robô até o fim.',
    stages: [
      s1.stage,
      {
        figure: FIGURES.chave, eye: [-1.0, 1.15, 0.45], center: [0.05, 1.3, 0.2], seed: 1515, movable: [2, 5],
        payoff: [{ type: 'key' }, { type: 'walk', path: [s1.b, add(d.pos, mul(d.n, -0.06))], vanish: true }],
      },
    ],
    pads: [pad(s1.a, 0), pad(padTop, 0, [0.3, 0.4], true)], door: d, robot: { pos: s1.a, yaw: yawTo(s1.a, s1.b) },
  };
}

const one = (name, intro, stage) => ({ name, intro, stages: [stage] });

export const LEVELS = [
  // Grupo 1: Olhar
  one('Peixe', 'Ande pela galeria. De um ponto exato, os pedaços formam uma figura.',
    { figure: FIGURES.peixe, eye: [0.7, 1.6, 0.9], center: [-0.1, 1.4, -0.2], seed: 101 }),
  one('Casa', 'Às vezes o ponto fica baixo. Experimente se abaixar.',
    { figure: FIGURES.casa, eye: [-0.95, 1.0, 0.6], center: [0.1, 1.15, -0.15], seed: 202 }),
  one('Pássaro', 'E às vezes fica alto: fique na ponta dos pés.',
    { figure: FIGURES.passaro, eye: [0.85, 1.7, -0.6], center: [-0.15, 1.35, 0.15], seed: 303 }),
  one('Barco', 'Ouça a nota: quanto mais afinada, mais perto você está.',
    { figure: FIGURES.barco, eye: [-0.3, 1.3, -1.15], center: [0.05, 1.2, 0.1], seed: 404 }),
  one('Rosto', 'Mestre: muitos pedaços e um ponto bem escondido.',
    { figure: FIGURES.rosto, eye: [-1.1, 0.92, -0.45], center: [0.1, 1.15, 0.05], seed: 505 }),
  // Grupo 2: Mexer
  one('Chave', 'Fique nas pegadas. Um pedaço está fora do lugar: pegue e encaixe.',
    { figure: FIGURES.chave, eye: [-0.6, 1.55, 0.95], center: [0.05, 1.4, -0.2], seed: 606, movable: [2] }),
  one('Árvore', 'Dois pedaços fora do lugar.',
    { figure: FIGURES.arvore, eye: [1.0, 1.25, 0.2], center: [-0.2, 1.3, -0.1], seed: 707, movable: [4, 6] }),
  one('Gato', 'Agache nas pegadas e arrume o gato.',
    { figure: FIGURES.gato, eye: [0.3, 0.98, -1.05], center: [0, 1.0, 0.2], seed: 808, movable: [2, 9] }),
  one('Foguete', 'Três pedaços. Gire com o pulso (no PC, com a roda do mouse).',
    { figure: FIGURES.foguete, eye: [-1.0, 1.6, -0.6], center: [0.2, 1.45, 0.1], seed: 909, movable: [1, 3, 5] }),
  one('Relógio', 'Mestre: acerte as horas com quatro pedaços.',
    { figure: FIGURES.relogio, eye: [0.9, 1.7, 0.8], center: [-0.2, 1.4, -0.3], seed: 1010, movable: [2, 5, 6, 10] }),
  // Grupo 3: Tornar real
  level11(), level12(), level13(), level14(), level15(),
].map((l, i) => ({ ...l, id: i, group: Math.floor(i / 5), master: i % 5 === 4, pads: l.pads || [], door: l.door || null, robot: l.robot || null }));
