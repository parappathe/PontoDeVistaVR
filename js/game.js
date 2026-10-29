// Uma fase em andamento: etapas, trava, fusão, robô, chave e porta. Sem navegador nem Three.js.
// Quem usa chama update(dt, olho) a cada quadro (olho em coordenadas da galeria) e lê `events`.
import { buildStage, measure, snapCheck, TOL } from './anamorph.js';
import { add, sub, mul, dist, lerp, lerpN, smooth, cross, qMul, qInv, qAxis, qRotate, qFromBasis, qSlerp } from './math3.js';

export const FUSE_TIME = 1.6;   // fragmentos deslizando até virar uma peça só
export const GLOW_TIME = 0.9;   // brilho depois de fundir
export const KEY_TIME = 3.4;    // chave voando, entrando, girando, porta abrindo
export const HINT_TIME = 60;    // dica liberada depois de 60 s na etapa
export const ROBOT_SPEED = 0.22;
export const KEY_SCALE = 0.32;

export class Game {
  constructor(def) {
    this.def = def;
    this.stages = def.stages.map((s, i) => {
      const st = buildStage(s);
      st.index = i;
      st.status = i === 0 ? 'active' : 'hidden';   // 'hidden' | 'active' | 'done'
      st.fuse = 0;
      st.keyT = null;
      return st;
    });
    this.si = 0;
    this.state = 'search';      // 'search' | 'fuse' | 'glow' | 'payoff' | 'won'
    this.t = 0;                 // tempo total da fase
    this.stageT = 0;            // tempo na etapa atual (para a dica)
    this.hold = 0;
    this.glowT = 0;
    this.hintReady = false;
    this.m = { mean: 1, max: 1, posErr: 9, aligned: false, score: 0, fine: 0, allSnapped: false };
    this.events = [];
    this.robot = def.robot ? { pos: def.robot.pos.slice(), yaw: def.robot.yaw, visible: true, walking: false, dist: 0 } : null;
    this.door = def.door ? { ...def.door, open: 0 } : null;
    this.payoff = null;
  }

  get stage() { return this.stages[this.si]; }
  get canMove() { return this.state === 'search'; }

  update(dt, eye) {
    this.events = [];
    this.t += dt;
    const st = this.stage;
    if (this.state === 'search') {
      this.stageT += dt;
      if (!this.hintReady && this.stageT >= HINT_TIME) { this.hintReady = true; this.events.push({ type: 'hint' }); }
      this.m = measure(st, eye);
      if (this.m.aligned) {
        this.hold += dt;
        if (this.hold >= TOL.hold) {
          this.state = 'fuse';
          this.m.score = 1; this.m.fine = 1;
          this.events.push({ type: 'lock', stage: this.si });
        }
      } else this.hold = 0;
    } else if (this.state === 'fuse') {
      st.fuse = Math.min(1, st.fuse + dt / FUSE_TIME);
      if (st.fuse >= 1) { this.state = 'glow'; this.glowT = 0; this.events.push({ type: 'fused', stage: this.si }); }
    } else if (this.state === 'glow') {
      this.glowT += dt;
      if (this.glowT >= GLOW_TIME) {
        const steps = st.def.payoff || [];
        if (steps.length) { this.state = 'payoff'; this.payoff = { steps, i: 0, t: 0 }; this.startStep(); }
        else this.nextStage();
      }
    } else if (this.state === 'payoff') {
      this.runPayoff(dt);
    }
  }

  startStep() {
    const s = this.payoff.steps[this.payoff.i];
    this.payoff.t = 0;
    if (s.type === 'walk') { this.payoff.seg = 0; this.payoff.segT = 0; if (this.robot) { this.robot.walking = true; this.robot.pos = s.path[0].slice(); } }
    if (s.type === 'key') { this.stage.keyT = 0; this.events.push({ type: 'keyFly' }); }
  }

  runPayoff(dt) {
    const p = this.payoff, s = p.steps[p.i];
    p.t += dt;
    let done = false;
    if (s.type === 'walk') {
      const r = this.robot;
      let move = ROBOT_SPEED * dt;
      while (move > 0 && p.seg < s.path.length - 1) {
        const a = s.path[p.seg], b = s.path[p.seg + 1];
        const L = dist(a, b);
        const left = L - p.segT;
        const h = [b[0] - a[0], b[2] - a[2]];
        if (Math.hypot(h[0], h[1]) > 1e-4) r.yaw = Math.atan2(h[0], h[1]);
        if (move < left) { p.segT += move; r.dist += move; move = 0; }
        else { move -= left; r.dist += left; p.seg++; p.segT = 0; }
        const a2 = s.path[p.seg], b2 = s.path[Math.min(p.seg + 1, s.path.length - 1)];
        const L2 = dist(a2, b2);
        r.pos = L2 > 0 ? lerp(a2, b2, p.segT / L2) : a2.slice();
      }
      if (p.seg >= s.path.length - 1) {
        r.walking = false;
        r.pos = s.path[s.path.length - 1].slice();
        if (s.vanish) { r.visible = false; this.events.push({ type: 'vanish' }); }
        done = true;
      }
    } else if (s.type === 'key') {
      const st = this.stage;
      const before = st.keyT;
      st.keyT = Math.min(1, st.keyT + dt / KEY_TIME);
      if (before < 0.55 && st.keyT >= 0.55) this.events.push({ type: 'keyIn' });
      if (before < 0.72 && st.keyT >= 0.72) this.events.push({ type: 'keyTurn' });
      if (before < 0.86 && st.keyT >= 0.86) this.events.push({ type: 'doorOpen' });
      if (this.door) this.door.open = smooth((st.keyT - 0.86) / 0.14);
      done = st.keyT >= 1;
    }
    if (done) {
      p.i++;
      if (p.i < p.steps.length) this.startStep();
      else { this.payoff = null; this.nextStage(); }
    }
  }

  nextStage() {
    this.stage.status = 'done';
    if (this.si < this.stages.length - 1) {
      this.si++;
      this.stage.status = 'active';
      this.state = 'search';
      this.stageT = 0; this.hold = 0; this.hintReady = false;
      this.events.push({ type: 'stage', stage: this.si });
    } else {
      this.state = 'won';
      this.events.push({ type: 'win' });
    }
  }

  // ---------- Mexer nos fragmentos ----------
  grab(i) {
    const p = this.stage.pieces[i];
    if (!this.canMove || !p?.movable) return false;
    p.held = true; p.snapped = false;
    return true;
  }
  setPose(i, pos, quat) {
    const p = this.stage.pieces[i];
    if (!p?.held) return;
    p.cur.pos = pos.slice(); p.cur.quat = quat.slice();
  }
  // Solta; se estiver perto do lugar certo, encaixa. Devolve true se encaixou.
  release(i) {
    const st = this.stage, p = st.pieces[i];
    if (!p?.held) return false;
    p.held = false;
    if (snapCheck(st, p, p.cur.pos, p.cur.quat)) {
      p.snapped = true;
      p.cur = { pos: p.frag.pos.slice(), quat: p.frag.quat.slice() };
      this.events.push({ type: 'snap', piece: i });
      return true;
    }
    return false;
  }
  // Chamado quando a fase sai do modo de mexer (trava): ninguém segura mais nada.
  dropAll() { for (const p of this.stage.pieces) if (p.held) this.release(p.i); }

  // Lugar aproximado do ponto de vista para a dica (pegada transparente): 15 a 25 cm ao lado.
  hintSpot() {
    const st = this.stage, s = (st.def.seed ?? 1) * 1.7;
    const r = 0.15 + ((s * 13.1) % 1) * 0.1;
    return { pos: [st.eye[0] + Math.cos(s) * r, 0, st.eye[2] + Math.sin(s) * r], height: st.eye[1] };
  }

  // ---------- Pose de cada pedaço para desenhar ----------
  piecePose(si, i) {
    const st = this.stages[si], p = st.pieces[i];
    if (st.status === 'hidden') return { visible: false, pos: p.cur.pos, quat: p.cur.quat, scale: p.k };
    let pos, quat, scale;
    if (st.fuse > 0) {
      const kk = lerpN(p.k, 1, smooth(st.fuse));
      pos = add(st.eye, mul(sub(p.home.pos, st.eye), kk));
      quat = p.home.quat; scale = kk;
    } else { pos = p.cur.pos; quat = p.cur.quat; scale = p.k; }
    if (st.keyT != null && this.door) {
      const T = this.keyTransform(st);
      if (!T.visible) return { visible: false, pos, quat, scale };
      // pose do pedaço relativa ao plano da figura, levada para a pose T
      const local = qRotate(qInv(st.plane.q), sub(p.home.pos, st.plane.c));
      pos = add(T.pos, qRotate(T.quat, mul(local, T.scale)));
      quat = qMul(T.quat, qMul(qInv(st.plane.q), p.home.quat));
      scale = T.scale;
    }
    return { visible: true, pos, quat, scale };
  }

  // Pose da chave inteira (centro da figura) durante o voo até a fechadura.
  keyTransform(st) {
    const d = this.door, t = st.keyT;
    const right = mul(d.n, -1), up = [0, 1, 0];
    const qEnd = qFromBasis(right, up, cross(right, up));
    const tip = st.figure.tip || [0.375, 0];
    const endPos = add(d.keyhole, mul(d.n, tip[0] * KEY_SCALE + 0.05));
    const a = smooth(t / 0.55), b = smooth((t - 0.55) / 0.15), c = smooth((t - 0.72) / 0.12);
    let pos = lerp(st.plane.c, endPos, a);
    pos = add(pos, mul(d.n, -0.05 * b));
    let quat = qSlerp(st.plane.q, qEnd, a);
    if (c > 0) quat = qMul(qAxis(right, c * Math.PI / 2), quat);
    const scale = lerpN(1, KEY_SCALE, a);
    return { pos, quat, scale, visible: t < 0.9 };
  }
}

