// A ilusão: monta os fragmentos de uma figura a partir do ponto de vista e mede o alinhamento.
// Sem navegador nem Three.js.
//
// Ideia: cada pedaço da figura tem uma pose "em casa" (no plano da figura). O fragmento é o
// mesmo pedaço ampliado ou reduzido por um fator k a partir do olho (homotetia de centro no olho):
// fica k vezes mais longe e k vezes maior. Visto do olho, é idêntico; de qualquer outro lugar,
// cada pedaço escorrega para um lado diferente (paralaxe) e a figura some.
import {
  DEG, add, sub, mul, cross, len, norm, dist, angle, clamp,
  qMul, qAxis, qRotate, qFromBasis, qAngle, qInv, yawPitchOf, qYawPitch, rng,
} from './math3.js';
import { pieceGeom, pieceSymmetry, samplePiece, pieceArea } from './figures.js';

// Tolerâncias do "trava": cabeça a até 15 cm do ponto e todos os pedaços a menos de 5°.
export const TOL = { pos: 0.15, ang: 5 * DEG, hold: 0.3 };
// Encaixe de um fragmento mexido: direção (vista do ponto) a menos de 5°, distância ±20%, giro 25°.
export const SNAP = { ang: 5 * DEG, depth: 0.2, rot: 25 * DEG };
// Sala: chão em y = 0, centro em x = z = 0. Pontos de vista dentro de 1,3 m do centro.
export const ROOM = { half: 1.5, wall: 1.75, yMin: 0.1, yMax: 2.5, playR: 1.3, eyeMin: 0.9, eyeMax: 1.8 };
export const NEAR_MIN = 0.45;
const SIZE_W = 0.15;            // peso do erro de tamanho (10% de diferença ≈ 0,9°)  // nenhum fragmento a menos disso do olho
export const REACH = 0.52;     // distância do olho dos fragmentos que se pegam com a mão
// Faixas do fator k: bem longe de 1, para cada pedaço escorregar bastante quando a cabeça sai do ponto.
const K_NEAR = [0.38, 0.62], K_FAR = [1.55, 2.2];

// Plano de frente para quem olha (do olho até o centro).
export function viewPlane(eye, center) {
  const n = norm(sub(eye, center));            // normal aponta para o olho
  let r = cross([0, 1, 0], n);
  if (len(r) < 1e-6) r = [1, 0, 0];
  r = norm(r);
  const u = cross(n, r);
  return { c: center.slice(), r, u, n, q: qFromBasis(r, u, n) };
}
// Plano vertical que passa por c, com a direita girada yaw graus em volta de Y (yaw 0 = +x).
export function wallPlane(c, yawDeg) {
  const a = yawDeg * DEG;
  const r = [Math.cos(a), 0, -Math.sin(a)], u = [0, 1, 0], n = cross(r, u);
  return { c: c.slice(), r, u, n, q: qFromBasis(r, u, n) };
}
export const planePoint = (pl, uv) => add(pl.c, add(mul(pl.r, uv[0]), mul(pl.u, uv[1])));

// Monta uma etapa: { figure, eye, center | plane, seed, movable: [índices] }.
export function buildStage(sd) {
  const eye = sd.eye;
  const plane = sd.plane || viewPlane(eye, sd.center);
  const rnd = rng(sd.seed ?? 1);
  const movable = new Set(sd.movable || []);
  const figPieces = sd.figure.pieces;
  const hasChild = new Set(figPieces.filter(p => p.on != null).map(p => p.on));
  const pieces = figPieces.map((pc, i) => {
    const g = pieceGeom(pc);
    const pos = planePoint(plane, g.center);
    const quat = qMul(plane.q, qAxis([0, 0, 1], g.rot));
    return { i, pc, geom: g.geom, sym: pieceSymmetry(pc), home: { pos, quat }, movable: movable.has(i), k: 1 };
  });
  // Fator k de cada pedaço: longe de 1 (senão o pedaço não esconde nada), dentro da sala,
  // longe do olho, e na frente do pedaço que fica por baixo dele.
  const inRoom = (p) => Math.abs(p[0]) <= ROOM.half + 0.05 && Math.abs(p[2]) <= ROOM.half + 0.05 && p[1] >= ROOM.yMin && p[1] <= ROOM.yMax;
  const order = pieces.map(p => p.i).sort((a, b) => (figPieces[a].on != null) - (figPieces[b].on != null));
  let flip = rnd() < 0.5;
  for (const i of order) {
    const p = pieces[i];
    const D = dist(p.home.pos, eye);
    if (p.movable) { p.k = (REACH / D) * (0.96 + rnd() * 0.08); continue; }
    const under = figPieces[i].on != null ? pieces[figPieces[i].on] : null;
    const bands = hasChild.has(i) ? [K_FAR, K_NEAR] : flip ? [K_NEAR, K_FAR] : [K_FAR, K_NEAR];
    let ok = false;
    for (let t = 0; t < 80 && !ok; t++) {
      const band = bands[t < 40 ? 0 : 1];
      const lo = Math.max(band[0], NEAR_MIN / D + 0.005);
      const hi = under ? Math.min(band[1], under.k - 0.12) : band[1];
      if (hi <= lo) continue;
      // pedaço que tem outro por cima fica no fundo da faixa, para sobrar espaço na frente dele
      const k = hasChild.has(i) ? hi - rnd() * 0.3 * (hi - lo) : lo + rnd() * (hi - lo);
      const pos = add(eye, mul(sub(p.home.pos, eye), k));
      if (inRoom(pos)) { p.k = k; ok = true; }
    }
    if (!ok) throw new Error(`${sd.figure.name}: não coube o pedaço ${i} na sala`);
    flip = !flip;
  }
  for (const p of pieces) {
    p.frag = { pos: add(eye, mul(sub(p.home.pos, eye), p.k)), quat: p.home.quat.slice() };
    p.cur = { pos: p.frag.pos.slice(), quat: p.frag.quat.slice() };
    p.snapped = !p.movable;
    p.held = false;
  }
  // Fragmentos de mexer começam fora do lugar: girados em volta do olho (como se a câmera tivesse
  // virado), na mesma distância, e rodados no próprio plano.
  for (const p of pieces) {
    if (!p.movable) continue;
    const d0 = sub(p.frag.pos, eye), D = len(d0);
    const { yaw, pitch } = yawPitchOf(d0);
    const Q0 = qYawPitch(yaw, pitch);
    let best = null;
    for (let t = 0; t < 20 && !best; t++) {
      const sign = (rnd() < 0.5 ? -1 : 1);
      const dy = sign * (30 + rnd() * 14) * DEG, dp = (rnd() - 0.5) * 16 * DEG;
      const Qd = qYawPitch(yaw + dy, clamp(pitch + dp, -1.2, 1.2));
      const pos = add(eye, mul(qRotate(Qd, [0, 0, -1]), D));
      if (inRoom(pos) && pos[1] > 0.5) {
        const roll = (rnd() < 0.5 ? -1 : 1) * (60 + rnd() * 80) * DEG;
        const quat = qMul(qMul(qMul(Qd, qAxis([0, 0, 1], roll)), qInv(Q0)), p.frag.quat);
        best = { pos, quat };
      }
    }
    if (!best) throw new Error(`${sd.figure.name}: não coube o pedaço móvel ${p.i}`);
    p.start = best;
    p.cur = { pos: best.pos.slice(), quat: best.quat.slice() };
  }
  return { def: sd, eye: eye.slice(), plane, pieces, figure: sd.figure };
}

// Mede o alinhamento visto de `eye`: erro angular de cada fragmento (raio olho → fragmento contra
// raio olho → lugar dele na figura), mais a diferença de tamanho aparente.
export function measure(stage, eye) {
  let sum = 0, max = 0;
  for (const p of stage.pieces) {
    const a = sub(p.cur.pos, eye), h = sub(p.home.pos, eye);
    // erro de direção + erro de tamanho aparente (o fragmento tem k vezes o tamanho do pedaço)
    const sizeErr = Math.abs(Math.log(Math.max(1e-3, p.k * len(h) / Math.max(1e-3, len(a)))));
    const e = angle(a, h) + SIZE_W * sizeErr;
    sum += e; if (e > max) max = e;
  }
  const mean = sum / stage.pieces.length;
  const posErr = dist(eye, stage.eye);
  const allSnapped = stage.pieces.every(p => p.snapped && !p.held);
  const aligned = posErr < TOL.pos && max < TOL.ang && allSnapped;
  // Notas de 0 (embaralhado) a 1 (perfeito), só pelo que se vê (não usa a distância até o ponto):
  // `score` muda devagar (som, guia de longe), `fine` só sobe bem perto (poeira se organizando).
  const score = 1 / (1 + (mean / (9 * DEG)) ** 2);
  const fine = 1 / (1 + (mean / (2.5 * DEG)) ** 2);
  return { mean, max, posErr, aligned, score, fine, allSnapped };
}

// Erro de giro levando em conta a simetria do pedaço.
export function rotError(p, quat) {
  const q0 = p.frag.quat;
  if (p.sym === 'round') {
    const a = qRotate(q0, [0, 0, 1]), b = qRotate(quat, [0, 0, 1]);
    return Math.min(angle(a, b), angle(a, mul(b, -1)));
  }
  const step = p.sym ? p.sym * DEG : 2 * Math.PI;
  let best = Infinity;
  for (let a = 0; a < 2 * Math.PI - 1e-6; a += step) best = Math.min(best, qAngle(quat, qMul(q0, qAxis([0, 0, 1], a))));
  return best;
}

// O fragmento mexido está perto o bastante do lugar certo para encaixar?
export function snapCheck(stage, p, pos, quat) {
  const v1 = sub(pos, stage.eye), v0 = sub(p.frag.pos, stage.eye);
  const ratio = len(v1) / len(v0);
  return angle(v1, v0) < SNAP.ang && Math.abs(ratio - 1) < SNAP.depth && rotError(p, quat) < SNAP.rot;
}

// Poeira: pontos sorteados em cima da figura, cada um também empurrado por um k próprio a partir do
// olho (do ponto certo, a poeira desenha a figura) e uma posição solta qualquer na sala.
export function makeDust(stage, n, seed = 7) {
  const rnd = rng(seed);
  const areas = stage.pieces.map(p => Math.sqrt(pieceArea(p.pc)));
  const total = areas.reduce((a, b) => a + b, 0);
  const dust = [];
  for (let j = 0; j < n; j++) {
    let x = rnd() * total, i = 0;
    while (i < areas.length - 1 && x > areas[i]) { x -= areas[i]; i++; }
    const uv = samplePiece(stage.pieces[i].pc, rnd);
    const home = planePoint(stage.plane, uv);
    const k = rnd() < 0.5 ? 0.55 + rnd() * 0.3 : 1.15 + rnd() * 0.5;
    const loose = [(rnd() - 0.5) * 2.4, 0.4 + rnd() * 1.9, (rnd() - 0.5) * 2.4];
    dust.push({ home, k, loose, phase: rnd() * Math.PI * 2 });
  }
  return dust;
}

// Nome da altura do olho (para a marca no chão e a dica).
export function heightName(y) {
  if (y < 1.12) return 'agachado';
  if (y < 1.45) return 'meio agachado';
  if (y < 1.66) return 'de pé';
  return 'na ponta dos pés';
}


