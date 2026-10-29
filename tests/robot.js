// "Jogador robô": anda até o ponto de vista de cada etapa, encaixa os fragmentos soltos (com um
// errinho de propósito, para provar que a tolerância funciona) e espera a figura travar.
// Usado nos testes para provar que toda fase tem solução.
import { Game } from '../js/game.js';
import { START } from '../js/levels.js';
import { add, sub, mul, len, norm, cross, dist, qMul, qAxis, DEG } from '../js/math3.js';

// Pose "quase certa" do fragmento p: 2° de direção, 6% de distância e 8° de giro fora.
export function nearlyRight(stage, p) {
  const v = sub(p.frag.pos, stage.eye);
  const side = norm(cross(v, [0, 1, 0.3]));
  const tilted = add(mul(v, Math.cos(2 * DEG)), mul(side, len(v) * Math.sin(2 * DEG)));
  return { pos: add(stage.eye, mul(tilted, 1.06)), quat: qMul(qAxis([0.3, 1, 0.2], 8 * DEG), p.frag.quat) };
}

export function makeRobot() {
  const eye = START.slice();
  return (game, dt) => {
    const st = game.stage;
    if (game.state === 'search') {
      // anda até o ponto (1 m/s), com 2 cm de erro de propósito
      const goal = add(st.eye, [0.02, -0.015, 0.012]);
      const d = sub(goal, eye), L = len(d), step = 1.0 * dt;
      const next = L <= step ? goal : add(eye, mul(d, step / L));
      eye.splice(0, 3, ...next);
      // já perto do ponto: pega e encaixa cada fragmento solto (tem que estar ao alcance da mão)
      if (dist(eye, st.eye) < 0.3) {
        for (const p of st.pieces) {
          if (!p.movable || p.snapped) continue;
          if (dist(p.cur.pos, eye) > 0.8) throw new Error(`fragmento ${p.i} longe da mão (${dist(p.cur.pos, eye).toFixed(2)} m)`);
          const target = nearlyRight(st, p);
          if (!game.grab(p.i)) throw new Error(`não conseguiu pegar o fragmento ${p.i}`);
          game.setPose(p.i, target.pos, target.quat);
          if (!game.release(p.i)) throw new Error(`fragmento ${p.i} não encaixou`);
        }
      }
    }
    return eye;
  };
}

// Joga a fase inteira; devolve o jogo, o tempo e os eventos.
export function solveLevel(def, { dt = 1 / 60, maxT = 180 } = {}) {
  const game = new Game(def);
  const robot = makeRobot();
  const events = [];
  let t = 0;
  while (game.state !== 'won' && t < maxT) {
    const eye = robot(game, dt);
    game.update(dt, eye);
    for (const e of game.events) events.push({ ...e, t });
    t += dt;
  }
  return { game, t, events };
}
