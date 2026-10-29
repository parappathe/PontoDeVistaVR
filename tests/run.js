// Testes automáticos: node tests/run.js (ou npm test). Não tocam som.
import { DEG, add, sub, mul, len, norm, cross, dist, angle, qRotate, qAxis, qMul, qInv, qFromBasis, qAngle, qLook, rng } from '../js/math3.js';
import { FIGURES, pieceGeom } from '../js/figures.js';
import { buildStage, measure, snapCheck, viewPlane, wallPlane, makeDust, heightName, TOL, ROOM, NEAR_MIN } from '../js/anamorph.js';
import { LEVELS, GROUPS, START } from '../js/levels.js';
import { Game, HINT_TIME, KEY_SCALE } from '../js/game.js';
import { solveLevel, nearlyRight } from './robot.js';
import { loadSave } from '../js/save.js';

let fails = 0, count = 0;
function ok(cond, msg) {
  count++;
  if (!cond) { fails++; console.log('  FALHOU:', msg); }
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const deg = (r) => (r / DEG).toFixed(1) + '°';

console.log('Matemática');
{
  const q = qAxis([0, 1, 0], Math.PI / 2);
  const r = qRotate(q, [0, 0, -1]);
  ok(near(r[0], -1) && near(r[2], 0), 'giro de 90° em Y leva -Z para -X');
  const b = qFromBasis([0, 0, -1], [0, 1, 0], [1, 0, 0]);
  const x = qRotate(b, [1, 0, 0]);
  ok(near(x[2], -1, 1e-9), 'quatérnio a partir da base');
  ok(near(qAngle(q, qMul(q, qAxis([1, 0, 0], 0.3))), 0.3, 1e-9), 'ângulo entre quatérnios');
  const f = qRotate(qLook([1, 0.5, -1]), [0, 0, -1]);
  ok(near(angle(f, [1, 0.5, -1]), 0, 1e-9), 'câmera olhando numa direção');
  const p = viewPlane([0, 1.6, 1], [0, 1.6, 0]);
  ok(near(p.r[0], 1) && near(p.u[1], 1) && near(p.n[2], 1), 'plano de frente para quem olha');
  const w = wallPlane([0, 1, 0], 90);
  ok(near(w.r[2], -1) && near(w.n[0], 1), 'plano vertical girado');
  const a = rng(5), b2 = rng(5);
  ok(a() === b2() && a() === b2(), 'sorteio com semente é repetível');
  ok(heightName(0.95) === 'agachado' && heightName(1.6) === 'de pé' && heightName(1.72) === 'na ponta dos pés', 'nomes das alturas');
}

console.log('Ilusão (construção pura)');
{
  const sd = { figure: FIGURES.peixe, eye: [0.5, 1.5, 1.0], center: [0, 1.4, -0.1], seed: 3 };
  const st = buildStage(sd);
  ok(st.pieces.length === FIGURES.peixe.pieces.length, 'um fragmento por pedaço');
  let worst = 0;
  for (const p of st.pieces) {
    // o fragmento está na reta olho → pedaço e escalado na mesma proporção
    const a = sub(p.frag.pos, st.eye), h = sub(p.home.pos, st.eye);
    worst = Math.max(worst, angle(a, h));
    ok(near(len(a) / len(h), p.k, 1e-9), `pedaço ${p.i}: distância proporcional ao k`);
    ok(Math.abs(p.k - 1) >= 0.2, `pedaço ${p.i}: k longe de 1 (${p.k.toFixed(2)})`);
  }
  ok(worst < 1e-9, 'todos os fragmentos na reta do olho');
  const m = measure(st, st.eye);
  ok(m.aligned && m.max < 1e-6 && near(m.score, 1, 1e-6) && near(m.fine, 1, 1e-6), 'do ponto certo alinha perfeito');
  // A mesma construção é repetível
  const st2 = buildStage(sd);
  ok(st2.pieces.every((p, i) => near(p.k, st.pieces[i].k, 0)), 'mesma semente, mesmos fragmentos');
  // "on": pedaço de cima fica na frente do de baixo
  for (const fig of Object.values(FIGURES)) {
    const s = buildStage({ figure: fig, eye: [0.6, 1.5, 0.9], center: [0, 1.35, -0.1], seed: 11 });
    for (const p of s.pieces) {
      const on = p.pc.on;
      if (on != null) ok(p.k < s.pieces[on].k, `${fig.name}: pedaço ${p.i} na frente do ${on}`);
    }
    ok(s.pieces.every(p => pieceGeom(p.pc).geom), `${fig.name}: geometria de todos os pedaços`);
  }
}

// Pontos a 30 cm do ponto de vista em 6 direções (frente/trás, lados, cima/baixo).
function offsets30(st) {
  const n = norm(sub(st.eye, st.plane.c));
  const r = norm(cross([0, 1, 0], n)), u = cross(n, r);
  return [r, mul(r, -1), u, mul(u, -1), n, mul(n, -1)].map((d, i) => ({ eye: add(st.eye, mul(d, 0.3)), lateral: i < 4, name: ['direita', 'esquerda', 'cima', 'baixo', 'trás', 'frente'][i] }));
}

console.log('Fases');
{
  ok(LEVELS.length === 15, '15 fases');
  ok(GROUPS.length === 3 && LEVELS.every(l => l.group === Math.floor(l.id / 5)), '3 grupos de 5');
  ok(LEVELS.filter(l => l.master).map(l => l.id).join() === '4,9,14', 'última de cada grupo é mestre');
  ok(LEVELS.slice(5, 10).every(l => l.stages.every(s => s.movable?.length)), 'grupo Mexer: toda fase tem pedaço solto');
  ok(LEVELS.slice(0, 5).every(l => l.stages.every(s => !s.movable?.length)), 'grupo Olhar: nada para mexer');
  ok(LEVELS.slice(10).every(l => l.robot && l.pads.length), 'grupo Tornar real: robô e plataformas');
  ok(LEVELS.slice(10).some(l => l.stages.length > 1), 'tem fase com dois pontos de vista em sequência');
  const rnd = rng(99);
  for (const def of LEVELS) {
    const tag = `fase ${def.id + 1} (${def.name})`;
    const game = new Game(def);
    for (const st of game.stages) {
      const e = st.eye, sTag = `${tag}, etapa ${st.index + 1}`;
      // Limites da sala e altura
      ok(Math.hypot(e[0], e[2]) <= ROOM.playR + 1e-9, `${sTag}: ponto a até 1,3 m do centro (${Math.hypot(e[0], e[2]).toFixed(2)})`);
      ok(e[1] >= ROOM.eyeMin && e[1] <= ROOM.eyeMax, `${sTag}: altura entre 0,9 e 1,8 (${e[1]})`);
      ok(dist(e, START) >= 0.6, `${sTag}: longe de onde o jogador começa (${dist(e, START).toFixed(2)} m)`);
      for (const p of st.pieces) {
        const f = p.frag.pos, sPos = p.start?.pos;
        ok(Math.abs(f[0]) <= ROOM.half + 0.05 && Math.abs(f[2]) <= ROOM.half + 0.05 && f[1] >= ROOM.yMin && f[1] <= ROOM.yMax, `${sTag}: fragmento ${p.i} dentro da sala`);
        ok(dist(f, e) >= NEAR_MIN - 1e-9, `${sTag}: fragmento ${p.i} não fica colado no olho`);
        if (p.movable) {
          ok(dist(f, e) <= 0.7 && dist(sPos, e) <= 0.7, `${sTag}: fragmento solto ${p.i} ao alcance da mão`);
          ok(!snapCheck(st, p, sPos, p.start.quat), `${sTag}: fragmento solto ${p.i} começa fora do lugar`);
        }
      }
      // Do ponto certo (com os soltos no lugar) alinha
      const saved = st.pieces.map(p => ({ cur: p.cur, snapped: p.snapped }));
      for (const p of st.pieces) { p.cur = { pos: p.frag.pos, quat: p.frag.quat }; p.snapped = true; }
      const m0 = measure(st, e);
      ok(m0.aligned && m0.max < 1e-6, `${sTag}: do ponto certo alinha`);
      ok(measure(st, add(e, [0.04, -0.035, 0.03])).aligned, `${sTag}: alinha com a cabeça a 6 cm do ponto`);
      // A 30 cm não alinha, e de lado ou em cima/baixo a figura fica bem embaralhada
      for (const o of offsets30(st)) {
        const m = measure(st, o.eye);
        ok(!m.aligned, `${sTag}: a 30 cm (${o.name}) não alinha`);
        if (o.lateral) ok(m.mean > 7 * DEG && m.fine < 0.12, `${sTag}: a 30 cm (${o.name}) a figura some (erro médio ${deg(m.mean)}, nota ${m.fine.toFixed(2)})`);
      }
      // Nenhum outro lugar da sala (a mais de 30 cm) alinha; fora da linha de visão a nota fica baixa
      const axis = norm(sub(st.plane.c, e));
      let bad = 0, worstScore = 0;
      for (let k = 0; k < 400; k++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * ROOM.playR;
        const q = [Math.cos(a) * rr, ROOM.eyeMin + rnd() * (ROOM.eyeMax - ROOM.eyeMin), Math.sin(a) * rr];
        if (dist(q, e) < 0.3) continue;
        const m = measure(st, q);
        if (m.aligned) bad++;
        const v = sub(q, e), offAxis = len(sub(v, mul(axis, v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2])));
        if (offAxis > 0.25) worstScore = Math.max(worstScore, m.fine);
      }
      ok(bad === 0, `${sTag}: de nenhum outro lugar da sala a figura trava (${bad})`);
      ok(worstScore < 0.4, `${sTag}: longe da linha de visão a nota fica baixa (melhor: ${worstScore.toFixed(2)})`);
      // O som guia: a nota (score) cresce ao chegar de lado no ponto
      { const n0 = norm(sub(e, st.plane.c)), r0 = norm(cross([0, 1, 0], n0));
        const sc = [0.6, 0.3, 0.1, 0].map(o => measure(st, add(e, mul(r0, o))).score);
        ok(sc[0] < sc[1] && sc[1] < sc[2] && sc[2] < sc[3] && sc[1] > 0.2, `${sTag}: a nota sobe ao se aproximar (${sc.map(v => v.toFixed(2)).join(' < ')})`); }
      st.pieces.forEach((p, i) => { p.cur = saved[i].cur; p.snapped = saved[i].snapped; });
      // Fases de mexer: do ponto certo, sem mexer, não alinha
      if (st.pieces.some(p => p.movable)) ok(!measure(st, e).aligned, `${sTag}: sem mexer nos soltos não alinha`);
    }
  }
}

console.log('Mexer');
{
  for (const def of LEVELS.filter(l => l.stages.some(s => s.movable?.length))) {
    const tag = `fase ${def.id + 1} (${def.name})`;
    const g = new Game(def);
    if (g.stages.length > 1) { g.stage.status = 'done'; g.si = g.stages.findIndex(s => s.def.movable?.length); g.stage.status = 'active'; }
    const st = g.stage;
    const fixed = st.pieces.find(p => !p.movable);
    ok(!g.grab(fixed.i), `${tag}: pedaço fixo não se pega`);
    const mov = st.pieces.filter(p => p.movable);
    // longe demais: não encaixa
    const p0 = mov[0];
    g.grab(p0.i);
    const v = sub(p0.frag.pos, st.eye);
    const off = add(st.eye, qRotate(qAxis([0, 1, 0], 12 * DEG), v));
    g.setPose(p0.i, off, p0.frag.quat);
    ok(!g.release(p0.i), `${tag}: 12° fora não encaixa`);
    g.grab(p0.i);
    g.setPose(p0.i, p0.frag.pos, qMul(qAxis(qRotate(p0.frag.quat, [0, 0, 1]), 40 * DEG), p0.frag.quat));
    const rotOk = p0.sym === 'round';
    ok(g.release(p0.i) === rotOk, `${tag}: girado 40° ${rotOk ? 'encaixa (pedaço redondo)' : 'não encaixa'}`);
    if (!rotOk) {
      // giro de meia volta serve para pedaço simétrico
      g.grab(p0.i);
      g.setPose(p0.i, p0.frag.pos, qMul(p0.frag.quat, qAxis([0, 0, 1], Math.PI)));
      ok(g.release(p0.i) === (p0.sym === 180 || p0.sym === 90), `${tag}: meia volta só serve se o pedaço for simétrico`);
    }
    for (const p of mov) {
      const t = nearlyRight(st, p);
      g.grab(p.i); g.setPose(p.i, t.pos, t.quat);
      ok(g.release(p.i) && p.snapped, `${tag}: fragmento ${p.i} encaixa quase certo`);
    }
    g.update(1 / 60, st.eye);
    ok(g.m.aligned, `${tag}: com tudo encaixado, do ponto alinha`);
    // segurando um pedaço não trava
    g.grab(mov[0].i);
    g.update(1 / 60, st.eye);
    ok(!g.m.aligned, `${tag}: segurando um pedaço não trava`);
  }
}

console.log('Robô resolve todas as fases');
{
  for (const def of LEVELS) {
    const tag = `fase ${def.id + 1} (${def.name})`;
    let res;
    try { res = solveLevel(def); } catch (e) { ok(false, `${tag}: robô travou: ${e.message}`); continue; }
    const { game, t, events } = res;
    ok(game.state === 'won', `${tag}: o robô termina a fase (estado ${game.state})`);
    const locks = events.filter(e => e.type === 'lock').length;
    ok(locks === def.stages.length, `${tag}: travou ${locks} de ${def.stages.length} figura(s)`);
    if (def.robot) {
      const lastWalk = def.stages.flatMap(s => s.payoff || []).filter(s => s.type === 'walk').pop();
      const end = lastWalk.path[lastWalk.path.length - 1];
      ok(dist(game.robot.pos, end) < 1e-6, `${tag}: o robozinho chega no fim do caminho`);
      if (lastWalk.vanish) ok(!game.robot.visible, `${tag}: o robozinho entra pela porta`);
    }
    if (def.door) ok(near(game.door.open, 1, 1e-9), `${tag}: a porta abriu`);
    if (game.state === 'won') console.log(`  ${tag}: resolvida em ${t.toFixed(1)} s`);
  }
}

console.log('Sequência, dica, chave, poeira e salvamento');
{
  // Etapa 2 não trava antes da 1
  const def = LEVELS.find(l => l.stages.length > 1);
  const g = new Game(def);
  for (const p of g.stages[1].pieces) if (p.movable) { p.cur = { pos: p.frag.pos, quat: p.frag.quat }; p.snapped = true; }
  for (let i = 0; i < 120; i++) g.update(1 / 60, g.stages[1].eye);
  ok(g.si === 0 && g.state === 'search', `fase ${def.id + 1}: o segundo ponto não vale antes do primeiro`);
  ok(!g.piecePose(1, 0).visible, 'segunda figura escondida até a primeira terminar');
  // Dica depois de 60 s
  const h = new Game(LEVELS[0]);
  for (let i = 0; i < (HINT_TIME - 1) * 10; i++) h.update(0.1, START);
  ok(!h.hintReady, 'sem dica antes de 60 s');
  for (let i = 0; i < 20; i++) h.update(0.1, START);
  ok(h.hintReady, 'dica liberada depois de 60 s');
  const spot = h.hintSpot(), e = h.stage.eye;
  const off = Math.hypot(spot.pos[0] - e[0], spot.pos[2] - e[2]);
  ok(off >= 0.14 && off <= 0.26, `dica aproximada, não exata (${off.toFixed(2)} m do ponto)`);
  // A chave termina com a ponta na fechadura
  const kd = LEVELS.find(l => l.door);
  const kg = new Game(kd);
  const kst = kg.stages.find(s => s.def.payoff?.some(p => p.type === 'key'));
  kst.keyT = 0.8;
  const T = kg.keyTransform(kst);
  const tip = add(T.pos, qRotate(T.quat, [kst.figure.tip[0] * T.scale, 0, 0]));
  ok(dist(tip, kd.door.keyhole) < 0.01, `ponta da chave na fechadura (${dist(tip, kd.door.keyhole).toFixed(3)} m)`);
  ok(near(T.scale, KEY_SCALE, 1e-9), 'chave encolhe para caber na porta');
  // Poeira: do ponto certo, cada grão está na reta de um ponto da figura
  const st = buildStage(LEVELS[0].stages[0]);
  const dust = makeDust(st, 200);
  ok(dust.length === 200, '200 grãos de poeira');
  // Salvamento sem navegador cai no padrão
  const s = loadSave();
  ok(s.done && typeof s.sound === 'boolean', 'salvamento sem localStorage usa o padrão');
}

console.log(fails ? `\n${fails} de ${count} verificações falharam` : `\nTudo certo (${count} verificações)`);
process.exit(fails ? 1 : 0);
