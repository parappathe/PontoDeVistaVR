// Liga o núcleo do jogo à tela, ao Quest (cabeça e controles) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { LEVELS, GROUPS, START } from './levels.js';
import { Game, GLOW_TIME } from './game.js';
import { makeDust, heightName, ROOM } from './anamorph.js';
import { yawPitchOf, smooth, clamp, lerpN } from './math3.js';
import { buildGallery, makePieceMesh, makePad, makeDoor, makeRobot, makeFootprints, makeDustPoints } from './scene.js';
import { Panel, Label } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const DUST_N = IS_QUEST ? 260 : 360;

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const gallery = buildGallery();
const { scene } = gallery;
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 30);
rig.add(camera);
// Tudo da fase fica aqui dentro. No VR o grupo é escalado pela altura de quem joga (a ilusão
// continua perfeita, porque escala uniforme mantém os alinhamentos).
const levelRoot = new THREE.Group();
scene.add(levelRoot);

const panel = new Panel(0.9);
scene.add(panel.mesh);
panel.hide();
const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
const hud = new Label(0.62, 1024, 170, { bg: 'rgba(250,247,242,0.92)', color: '#2a2a2e', font: 'sans-serif' });
hud.mesh.position.set(0, -0.2, -0.9);
hud.mesh.visible = false;
camera.add(hud.mesh);

for (let i = 0; i < LEVELS.length; i++) refreshFrame(i);
function refreshFrame(i) {
  const d = LEVELS[i];
  gallery.setFrame(i, { num: i + 1, name: d.name, figures: d.stages.map(s => s.figure), solved: !!save.done[i] });
}

// ---------- Estado ----------
let app = 'menu';            // 'menu' | 'playing' | 'paused' | 'won'
let game = null;
let levelIndex = 0;
let time = 0;
let wonTimer = 0;
let hintShown = false;
let msg = { text: '', until: 0 };
let lastRobotStep = 0;
const L = { stages: [], pads: [], door: null, robot: null, foot: null, hintFoot: null, dust: null, dustData: null, dustStage: -1 };

// PC: posição e olhar da pessoa
const pc = { x: START[0], z: START[2], h: START[1], yaw: 0, pitch: -0.05, keys: new Set(), locked: false, lastUnlock: 0 };
const mouseNdc = new THREE.Vector2();

function clearLevel() {
  for (const st of L.stages) for (const m of st) m.material.dispose();
  levelRoot.clear();
  L.stages = []; L.pads = []; L.door = null; L.robot = null; L.dust = null; L.dustData = null; L.dustStage = -1;
  for (const k of Object.keys(holds)) holds[k] = null;
}

function loadLevel(i) {
  clearLevel();
  levelIndex = clamp(i, 0, LEVELS.length - 1);
  const def = LEVELS[levelIndex];
  game = new Game(def);
  for (const st of game.stages) {
    const meshes = st.pieces.map(p => {
      const m = makePieceMesh(p.pc);
      m.userData.piece = p.i;
      levelRoot.add(m);
      return m;
    });
    L.stages.push(meshes);
  }
  for (const p of def.pads) { const m = makePad(p); levelRoot.add(m); L.pads.push(m); }
  if (def.door) { L.door = makeDoor(def.door); levelRoot.add(L.door); }
  if (def.robot) { L.robot = makeRobot(); levelRoot.add(L.robot); }
  L.foot = makeFootprints(0x2a2a2e, 0.55);
  L.hintFoot = makeFootprints(0x2c6fd1, 0.22);
  levelRoot.add(L.foot, L.hintFoot);
  L.dust = makeDustPoints(DUST_N);
  levelRoot.add(L.dust);
  hintShown = false;
  wonTimer = 0;
  lastRobotStep = 0;
  setupStageExtras();
}

// Pegadas, dica e poeira da etapa atual.
function setupStageExtras() {
  const st = game.stage;
  L.dustData = makeDust(st, DUST_N, 31 + st.index * 7 + levelIndex * 101);
  L.dustStage = st.index;
  const face = (g, from) => {
    const { yaw } = yawPitchOf([st.plane.c[0] - from[0], 0, st.plane.c[2] - from[2]]);
    g.rotation.y = yaw;
  };
  L.foot.position.set(st.eye[0], 0, st.eye[2]);
  face(L.foot, st.eye);
  L.foot.userData.setText(heightName(st.eye[1]));
  const h = game.hintSpot();
  L.hintFoot.position.set(h.pos[0], 0, h.pos[2]);
  face(L.hintFoot, h.pos);
  L.hintFoot.userData.setText(`dica: ${heightName(h.height)}`);
}

// ---------- Segurar fragmentos (mão no VR ou mouse no PC) ----------
const holds = { left: null, right: null, mouse: null };
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const _hp = new THREE.Vector3(), _hq = new THREE.Quaternion();

function holderPose(key) {
  if (key === 'mouse') { camera.getWorldPosition(_hp); camera.getWorldQuaternion(_hq); return true; }
  const e = entryFor(key);
  if (!e) return false;
  e.ctrl.updateMatrixWorld();
  e.ctrl.matrixWorld.decompose(_hp, _hq, _s);
  return true;
}
const movableMeshes = () => {
  if (!game || !game.canMove) return [];
  const st = game.stage;
  return L.stages[st.index].filter(m => { const p = st.pieces[m.userData.piece]; return p.movable && !p.held && m.visible; });
};

function startHold(key, mesh) {
  const i = mesh.userData.piece;
  if (!game.grab(i)) return false;
  holderPose(key);
  mesh.getWorldPosition(_p); mesh.getWorldQuaternion(_q);
  const inv = _hq.clone().invert();
  holds[key] = { i, mesh, pos: _p.clone().sub(_hp).applyQuaternion(inv), quat: inv.multiply(_q) };
  sfx.grab();
  pulse(key, 0.4, 30);
  return true;
}
function endHold(key) {
  const h = holds[key];
  if (!h) return;
  holds[key] = null;
  if (!game) return;
  const snapped = game.release(h.i);
  if (snapped) { sfx.snap(); pulse(key, 0.7, 60); } else { sfx.drop(); pulse(key, 0.2, 20); }
}
function updateHolds() {
  const s = levelRoot.scale.x;
  for (const key of Object.keys(holds)) {
    const h = holds[key];
    if (!h) continue;
    if (!game?.canMove || !holderPose(key)) { holds[key] = null; continue; }
    _p.copy(h.pos).applyQuaternion(_hq).add(_hp).divideScalar(s);
    _q.copy(_hq).multiply(h.quat);
    game.setPose(h.i, [_p.x, _p.y, _p.z], [_q.x, _q.y, _q.z, _q.w]);
  }
}
// Gira o fragmento segurado em volta do eixo de quem segura (frente da câmera ou do controle).
function rollHeld(key, ang) {
  const h = holds[key];
  if (h) h.quat.premultiply(_q.setFromAxisAngle(_v.set(0, 0, 1), ang));
}
function pushHeld(key, dz) {
  const h = holds[key];
  if (!h) return;
  const d = h.pos.length();
  if (d < 1e-3) return;
  h.pos.multiplyScalar(clamp(d + dz, 0.15, 3) / d);
}

const raycaster = new THREE.Raycaster();
function pickMovable(origin, dir, maxDist = 4) {
  raycaster.set(origin, dir);
  raycaster.far = maxDist;
  const hit = raycaster.intersectObjects(movableMeshes(), false)[0];
  raycaster.far = Infinity;
  return hit?.object || null;
}

// ---------- VR: controles ----------
const ctrls = [];
const handMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  rig.add(ctrl);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xe0412f }));
  laser.visible = false;
  ctrl.add(laser);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), handMat);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.08, 10).rotateX(Math.PI / 2), handMat);
  stick.position.z = 0.045;
  tip.add(stick);
  tip.visible = false;
  ctrl.add(tip);
  const entry = { ctrl, laser, tip, source: null, side: null, prev: [], hoverIndex: -1, turnLatch: false };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness === 'left' ? 'left' : 'right'; tip.visible = true; });
  ctrl.addEventListener('disconnected', () => { if (entry.side) endHold(entry.side); entry.source = null; entry.side = null; tip.visible = false; });
  ctrl.addEventListener('selectstart', () => onSelect(entry));
  ctrl.addEventListener('selectend', () => { if (entry.side) endHold(entry.side); });
  ctrl.addEventListener('squeezestart', () => { if (entry.side && app === 'playing') tryGrab(entry.side); });
  ctrl.addEventListener('squeezeend', () => { if (entry.side) endHold(entry.side); });
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);
function pulse(side, v, ms) {
  if (side === 'mouse') return;
  try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}
const pulseBoth = (v, ms) => { pulse('left', v, ms); pulse('right', v, ms); };

// Pega o fragmento solto mais perto da mão (até 20 cm); se não tiver, o que o raio aponta.
function tryGrab(side) {
  if (!game?.canMove || holds[side]) return false;
  const e = entryFor(side);
  if (!e) return false;
  holderPose(side);
  let best = null, bd = 0.2;
  for (const m of movableMeshes()) {
    m.getWorldPosition(_p);
    const d = _p.distanceTo(_hp);
    if (d < bd) { bd = d; best = m; }
  }
  if (!best) best = pickMovable(_hp.clone(), _v.set(0, 0, -1).applyQuaternion(_hq).clone());
  return best ? startHold(side, best) : false;
}

function onSelect(entry) {
  sfx.unlock();
  if (panel.visible) {
    const a = panel.actionAt(entry.hoverIndex);
    if (a) { sfx.click(); a(); }
    return;
  }
  if (app === 'playing' && entry.side) tryGrab(entry.side);
}

let snapTurnLatch = false;
function pollGamepads(dt) {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    if (b[4] && !e.prev[4]) toggleHint();           // A ou X
    if (b[5] && !e.prev[5]) togglePause();          // B ou Y
    e.prev = b;
    const ax = gp.axes.length >= 4 ? gp.axes[2] : (gp.axes[0] || 0);
    const ay = gp.axes.length >= 4 ? gp.axes[3] : (gp.axes[1] || 0);
    if (holds[e.side]) {
      // segurando: analógico para frente/trás afasta/aproxima, para os lados gira
      if (Math.abs(ay) > 0.2) pushHeld(e.side, -ay * dt * 0.6);
      if (Math.abs(ax) > 0.2) rollHeld(e.side, -ax * dt * 2.2);
    } else if (e.side === 'left') {
      // analógico esquerdo: andar devagar (opcional, para salas pequenas)
      if (Math.hypot(ax, ay) > 0.2) moveRig(ax, ay, dt);
    } else if (e.side === 'right') {
      if (Math.abs(ax) > 0.7 && !snapTurnLatch) { snapTurn(-Math.sign(ax) * Math.PI / 6); snapTurnLatch = true; }
      if (Math.abs(ax) < 0.3) snapTurnLatch = false;
    }
  }
}
function moveRig(ax, ay, dt) {
  camera.getWorldQuaternion(_q);
  const f = _v.set(0, 0, -1).applyQuaternion(_q); f.y = 0; f.normalize();
  const r = new THREE.Vector3(-f.z, 0, f.x);
  rig.position.addScaledVector(f, -ay * dt * 0.9).addScaledVector(r, ax * dt * 0.9);
}
function snapTurn(a) {
  camera.getWorldPosition(_p);
  const rel = rig.position.clone().sub(_p).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  rig.rotation.y += a;
  rig.position.copy(_p).add(rel);
  rig.position.y = 0;
}

// Recentralizar: o centro da galeria vai para onde a pessoa está, olhando para -z. Com
// "ajustar à altura", a fase é escalada pela altura dos olhos de pé (1,6 m = tamanho original).
let recenterIn = 0;
function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  fitHeight();
  rig.updateMatrixWorld(true);
  if (panel.visible) placePanel();
}
function fitHeight() {
  const y = camera.position.y;
  if (!renderer.xr.isPresenting || !save.fitHeight) { levelRoot.scale.setScalar(1); return; }
  if (y > 1.2) levelRoot.scale.setScalar(clamp(y / 1.6, 0.85, 1.12));
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 5;
  for (const k of Object.keys(holds)) endHold(k);
  if (document.pointerLockElement) document.exitPointerLock();
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.set(0, 0, 0); camera.quaternion.identity();
  if (panel.visible) placePanel();
  updateHtml();
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  levelRoot.scale.setScalar(1);
  for (const k of Object.keys(holds)) endHold(k);
  applyPcCamera();
  if (app === 'playing') togglePause();
  else if (panel.visible) placePanel();
  updateHtml();
});

// ---------- PC: mouse e teclado ----------
function applyPcCamera() {
  if (renderer.xr.isPresenting) return;
  camera.position.set(pc.x, pc.h, pc.z);
  camera.quaternion.setFromEuler(new THREE.Euler(pc.pitch, pc.yaw, 0, 'YXZ'));
}
function resetPcPlayer() {
  pc.x = START[0]; pc.z = START[2]; pc.h = START[1]; pc.yaw = 0; pc.pitch = -0.05;
  applyPcCamera();
}
function requestLock() {
  if (renderer.xr.isPresenting || pc.locked) return;
  try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* sem trava do mouse */ }
}
function pcMove(dt) {
  if (renderer.xr.isPresenting || app !== 'playing') return;
  const k = pc.keys;
  let fx = 0, fz = 0;
  if (k.has('w') || k.has('arrowup')) fz -= 1;
  if (k.has('s') || k.has('arrowdown')) fz += 1;
  if (k.has('a') || k.has('arrowleft')) fx -= 1;
  if (k.has('d') || k.has('arrowright')) fx += 1;
  const n = Math.hypot(fx, fz);
  if (n > 0) {
    const sp = 1.1 * dt / n, c = Math.cos(pc.yaw), s = Math.sin(pc.yaw);
    // frente = (-sen yaw, 0, -cos yaw), direita = (cos yaw, 0, -sen yaw)
    pc.x += (fx * c + fz * s) * sp;
    pc.z += (-fx * s + fz * c) * sp;
    pc.x = clamp(pc.x, -ROOM.half + 0.05, ROOM.half - 0.05);
    pc.z = clamp(pc.z, -ROOM.half + 0.05, ROOM.half - 0.05);
  }
  if (k.has('shift') || k.has('c')) pc.h -= 0.6 * dt;
  if (k.has(' ')) pc.h += 0.6 * dt;
  pc.h = clamp(pc.h, 0.85, 1.85);
  if (k.has('q')) rollHeld('mouse', 2.0 * dt);
  if (k.has('e')) rollHeld('mouse', -2.0 * dt);
  if (k.has('r')) pushHeld('mouse', 0.5 * dt);
  if (k.has('f')) pushHeld('mouse', -0.5 * dt);
  applyPcCamera();
}

const cvs = renderer.domElement;
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
cvs.addEventListener('pointermove', (e) => {
  mouseNdc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (pc.locked && app === 'playing') {
    pc.yaw -= e.movementX * 0.0022;
    pc.pitch = clamp(pc.pitch - e.movementY * 0.0022, -1.45, 1.45);
  }
});
cvs.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (renderer.xr.isPresenting) return;
  if (panel.visible) {
    mouseNdc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouseNdc, camera);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (app !== 'playing') return;
  if (!pc.locked) { requestLock(); return; }
  if (e.button === 0 && !holds.mouse) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const m = pickMovable(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    if (m) startHold('mouse', m);
  }
});
window.addEventListener('pointerup', (e) => { if (e.button === 0) endHold('mouse'); });
cvs.addEventListener('wheel', (e) => {
  if (holds.mouse) rollHeld('mouse', -Math.sign(e.deltaY) * 12 * Math.PI / 180);
  e.preventDefault();
}, { passive: false });
document.addEventListener('pointerlockchange', () => {
  pc.locked = document.pointerLockElement === cvs;
  if (!pc.locked) {
    pc.lastUnlock = performance.now();
    endHold('mouse');
    if (app === 'playing' && !renderer.xr.isPresenting) togglePause();
  }
  updateHtml();
});
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  pc.keys.add(k);
  if (e.repeat) return;
  if (k === 'escape') {
    if (performance.now() - pc.lastUnlock < 400) return;   // o Esc que soltou o mouse já pausou
    if (app === 'playing' || app === 'paused') togglePause();
  } else if (k === 'p') togglePause();
  else if (k === 'h') toggleHint();
  else if (k === 'x' && app === 'playing') pc.h = 1.6;
});
window.addEventListener('keyup', (e) => pc.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => pc.keys.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Fases, menus e pausa ----------
function startLevel(i) {
  loadLevel(i);
  app = 'playing';
  panel.hide();
  if (!renderer.xr.isPresenting) { resetPcPlayer(); requestLock(); }
  say(`${LEVELS[levelIndex].intro}`, 8);
  updateHtml();
}

function togglePause() {
  if (app === 'playing') {
    app = 'paused';
    for (const k of Object.keys(holds)) endHold(k);
    if (document.pointerLockElement) document.exitPointerLock();
    showScreen('pause');
  } else if (app === 'paused') {
    app = 'playing';
    panel.hide();
    requestLock();
  }
  updateHtml();
}

function toggleHint() {
  if (app !== 'playing' || !game) return;
  if (!game.hintReady) { say(`A dica aparece depois de 1 minuto (faltam ${Math.ceil(60 - game.stageT)} s).`, 3); return; }
  hintShown = !hintShown;
  if (hintShown) say(LEVELS[levelIndex].group === 1 ? 'Dica: os pedaços que piscam são os que estão fora do lugar.' : 'Dica: a pegada azul mostra mais ou menos onde ficar.', 4);
}

function goMenu() {
  app = 'menu';
  clearLevel();
  game = null;
  if (!renderer.xr.isPresenting) resetPcPlayer();
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('main');
  updateHtml();
}

const unlockedUpTo = () => {
  let n = 0;
  while (n < LEVELS.length && save.done[n]) n++;
  return Math.min(n, LEVELS.length - 1);
};

// O painel aparece na frente da pessoa, onde ela estiver olhando.
function placePanel() {
  camera.getWorldPosition(_p);
  camera.getWorldQuaternion(_q);
  const f = _v.set(0, 0, -1).applyQuaternion(_q);
  f.y = 0;
  if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
  f.normalize();
  const vr = renderer.xr.isPresenting;
  const d = vr ? 0.9 : 0.78;
  panel.mesh.position.set(_p.x + f.x * d, _p.y - (vr ? 0.12 : 0.02), _p.z + f.z * d);
  panel.mesh.lookAt(_p.x, panel.mesh.position.y, _p.z);
}

function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  if (!panel.visible) placePanel();
  panel.show((p) => {
    if (name === 'main') {
      p.title('Ponto de Vista', 74);
      p.text('As figuras só existem de um lugar. Ande, abaixe e incline a cabeça.', 512, 134, { size: 26, color: '#857a70' });
      const next = unlockedUpTo();
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next), 262, 180, 500, 92, { size: 38 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 288, 500, 78);
      p.button('Como jogar', () => showScreen('help'), 262, 382, 500, 78);
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; sfx.setOn(save.sound); storeSave(save); showScreen('main'); }, 100, 482, 260, 70, { size: 26 });
      p.button(`Ajustar à altura: ${save.fitHeight ? 'sim' : 'não'}`, () => { save.fitHeight = !save.fitHeight; storeSave(save); fitHeight(); showScreen('main'); }, 370, 482, 300, 70, { size: 24 });
      p.button(`FPS: ${save.fps ? 'sim' : 'não'}`, () => { save.fps = !save.fps; storeSave(save); showScreen('main'); }, 680, 482, 244, 70, { size: 26 });
      const solved = Object.keys(save.done).length;
      p.text(`${solved} de ${LEVELS.length} figuras na galeria`, 512, 590, { size: 26, color: '#2a2a2e', bold: true });
      p.text(vr ? 'A galeria cabe numa sala de 3 x 3 m. Recentralize na pausa (B ou Y).' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR".', 512, 640, { size: 21, color: '#857a70' });
    } else if (name === 'levels') {
      p.title('Fases', 52);
      const up = unlockedUpTo();
      GROUPS.forEach((g, row) => p.label(`${row + 1}. ${g.name}: ${g.text}`, 51, 100 + row * 178));
      LEVELS.forEach((l, i) => {
        const col = i % 5, row = Math.floor(i / 5);
        p.tile(51 + col * 188, 118 + row * 178, 170, 140, {
          num: i + 1, name: l.name, done: !!save.done[i], master: l.master, locked: i > up, action: () => startLevel(i),
        });
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 646, 300, 60, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 60);
      const rows = vr ? [
        'No meio da sala flutuam pedaços soltos. De um ponto exato,',
        'eles formam uma figura: ande, abaixe, fique na ponta dos pés.',
        'A nota fica afinada e a poeira se organiza quando você chega perto.',
        'Fique parado no ponto e a figura trava sozinha.',
        'Pedaço solto: gatilho ou botão lateral pega (perto ou com o raio).',
        'Segurando: gire o pulso; analógico afasta/aproxima e gira.',
        'A ou X: dica (depois de 1 minuto).   B ou Y: pausa.',
        'Analógico esquerdo anda; direito vira (se a sala for pequena).',
      ] : [
        'No meio da sala flutuam pedaços soltos. De um ponto exato,',
        'eles formam uma figura: ande, abaixe, fique na ponta dos pés.',
        'A nota fica afinada e a poeira se organiza quando você chega perto.',
        'Clique para olhar com o mouse.  WASD: andar.',
        'Shift ou C: abaixar.  Espaço: subir (ponta dos pés).  X: de pé.',
        'Pedaço solto: segure o botão do mouse com a mira em cima.',
        'Roda ou Q/E: gira o pedaço.  R/F: afasta/aproxima.',
        'H: dica (depois de 1 minuto).   Esc ou P: pausa.',
      ];
      rows.forEach((t, i) => p.text(t, 60, 130 + i * 56, { size: 27, align: 'left' }));
      p.button('Voltar', () => showScreen('main'), 362, 600, 300, 80);
    } else if (name === 'pause') {
      p.title('Pausa', 64);
      p.text(`Fase ${levelIndex + 1}: ${LEVELS[levelIndex].name}`, 512, 128, { size: 30, color: '#857a70' });
      p.button('Continuar', () => togglePause(), 262, 170, 500, 80);
      const ready = game?.hintReady;
      p.button(ready ? (hintShown ? 'Esconder dica' : 'Mostrar dica') : `Dica em ${Math.max(0, Math.ceil(60 - (game?.stageT || 0)))} s`,
        () => { toggleHint(); togglePause(); }, 262, 262, 500, 72, { size: 30, locked: !ready });
      p.button('Recomeçar a fase', () => startLevel(levelIndex), 262, 346, 500, 72, { size: 30 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 430, 500, 72, { size: 30 });
      p.button('Menu principal', () => goMenu(), 262, 514, 245, 80, { size: 28 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 517, 514, 245, 80, { size: 28, locked: !vr });
      p.text(vr ? 'Recentralizar: o centro da galeria vai para onde você está.' : 'Clique em Continuar para voltar a olhar com o mouse.', 512, 640, { size: 22, color: '#857a70' });
    } else if (name === 'won') {
      const d = save.done[levelIndex];
      p.title('Figura completa!', 74);
      p.text(`${levelIndex + 1}. ${LEVELS[levelIndex].name}   ·   ${game ? game.t.toFixed(1) : '-'} s`, 512, 150, { size: 32 });
      if (d) p.text(`Melhor tempo: ${d.time.toFixed(1)} s. A figura foi para a moldura na parede.`, 512, 198, { size: 24, color: '#857a70' });
      if (levelIndex < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(levelIndex + 1), 262, 250, 500, 96, { size: 38 });
      else p.text('Você completou a galeria inteira!', 512, 298, { size: 36, bold: true, color: '#e0412f' });
      p.button('Repetir', () => startLevel(levelIndex), 262, 366, 245, 80);
      p.button('Fases', () => showScreen('levels'), 517, 366, 245, 80);
      p.button('Menu principal', () => goMenu(), 262, 466, 500, 80);
    }
  });
}

function finishLevel() {
  const prev = save.done[levelIndex];
  save.done[levelIndex] = { time: Math.min(game.t, prev?.time ?? Infinity) };
  storeSave(save);
  refreshFrame(levelIndex);
  gallery.frames[levelIndex].flash = 1;
  app = 'won';
  for (const k of Object.keys(holds)) endHold(k);
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('won');
  updateHtml();
}

// ---------- Eventos do jogo → som, vibração, mensagens ----------
function say(text, sec = 3) { msg = { text, until: time + sec }; }
function handleEvents() {
  for (const ev of game.events) {
    if (ev.type === 'lock') {
      sfx.lock(); pulseBoth(0.9, 140);
      for (const k of Object.keys(holds)) holds[k] = null;
      say('Achou!', 2);
    } else if (ev.type === 'fused') sfx.fused();
    else if (ev.type === 'snap') { /* som tocado em endHold */ }
    else if (ev.type === 'hint') { sfx.hint(); say(`Dica disponível: aperte ${renderer.xr.isPresenting ? 'A' : 'H'}.`, 4); }
    else if (ev.type === 'stage') {
      sfx.stage(); hintShown = false; setupStageExtras();
      say('Agora outra figura, de outro ponto de vista.', 4);
    } else if (ev.type === 'keyFly') sfx.keyFly();
    else if (ev.type === 'keyIn') sfx.keyIn();
    else if (ev.type === 'keyTurn') { sfx.keyTurn(); pulseBoth(0.4, 40); }
    else if (ev.type === 'doorOpen') sfx.door();
    else if (ev.type === 'vanish') sfx.vanish();
    else if (ev.type === 'win') { sfx.win(); wonTimer = 1.6; }
  }
  const r = game.robot;
  if (r?.walking && r.dist - lastRobotStep > 0.03) { sfx.step(); lastRobotStep = r.dist; }
}

// ---------- Visual da fase ----------
const _c = new THREE.Color();
function updateLevelVisuals() {
  if (!game) return;
  const st = game.stage, def = game.def;
  const hovered = new Set(ctrls.map(e => e.hoverMesh).filter(Boolean));
  if (aimMesh) hovered.add(aimMesh);
  game.stages.forEach((s, si) => {
    const meshes = L.stages[si];
    const current = si === game.si;
    let glow = 0;
    if (current && game.state === 'fuse') glow = 0.15 + 0.45 * s.fuse;
    else if (current && game.state === 'glow') glow = 0.6 * (1 - game.glowT / GLOW_TIME) + 0.08;
    s.pieces.forEach((p, i) => {
      const m = meshes[i];
      const pose = game.piecePose(si, i);
      m.visible = pose.visible;
      if (!pose.visible) return;
      m.position.set(...pose.pos);
      m.quaternion.set(...pose.quat);
      m.scale.setScalar(pose.scale);
      let e = glow;
      if (current && game.state === 'search' && p.movable && !p.snapped) {
        if (hovered.has(m) || p.held) e = 0.35;
        else if (hintShown) e = 0.25 + 0.25 * Math.sin(time * 6);
      }
      m.material.emissiveIntensity = e;
    });
  });
  if (L.door) L.door.userData.pivot.rotation.y = -game.door.open * 1.9;
  if (L.robot) {
    const r = game.robot;
    L.robot.visible = r.visible;
    L.robot.position.set(...r.pos);
    L.robot.rotation.y = r.yaw;
    const u = L.robot.userData, ph = r.dist * 70;
    const bob = r.walking ? Math.abs(Math.sin(ph)) * 0.006 : 0;
    u.body.position.y = 0.05 + bob; u.head.position.y = 0.1 + bob;
    u.legs[0].position.z = r.walking ? Math.sin(ph) * 0.008 : 0;
    u.legs[1].position.z = r.walking ? -Math.sin(ph) * 0.008 : 0;
  }
  const searching = game.state === 'search';
  L.foot.visible = searching && def.group === 1;
  L.hintFoot.visible = searching && hintShown && def.group !== 1;
  updateDust();
}

function updateDust() {
  const st = game.stage, d = L.dustData;
  if (!d || L.dustStage !== st.index) return;
  const arr = L.dust.geometry.attributes.position.array;
  const searching = game.state === 'search';
  const w = searching ? 0.92 * Math.pow(clamp(game.m.fine * 1.1, 0, 1), 1.2) : 1;
  const f = smooth(st.fuse);
  const E = st.eye;
  for (let j = 0; j < d.length; j++) {
    const g = d[j];
    const kk = lerpN(g.k, 1, f);
    const drift = (1 - w) * 0.04;
    for (let a = 0; a < 3; a++) {
      const t = E[a] + (g.home[a] - E[a]) * kk;
      const loose = g.loose[a] + Math.sin(time * 0.3 + g.phase + a * 2.1) * drift;
      arr[j * 3 + a] = loose + (t - loose) * w;
    }
  }
  L.dust.geometry.attributes.position.needsUpdate = true;
  const op = game.state === 'search' || game.state === 'fuse' ? 0.75 : game.state === 'glow' ? 0.75 * (1 - game.glowT / GLOW_TIME) : 0;
  L.dust.material.opacity = op;
  L.dust.visible = op > 0.01;
}

// ---------- Raios do menu e mira ----------
let aimMesh = null;
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  const canGrab = app === 'playing' && game?.canMove && game.stage.pieces.some(p => p.movable && !p.snapped);
  aimMesh = null;
  for (const e of ctrls) {
    e.hoverIndex = -1; e.hoverMesh = null;
    e.laser.visible = false;
    if (!vr || !e.source) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(_q);
    rayDir.set(0, 0, -1).applyQuaternion(_q);
    if (panel.visible) {
      raycaster.set(rayOrigin, rayDir);
      const hit = raycaster.intersectObject(panel.mesh)[0];
      e.laser.visible = true;
      e.laser.scale.z = hit ? hit.distance : 1.5;
      e.hoverIndex = panel.pick(hit?.uv);
      if (e.hoverIndex >= 0) hover = e.hoverIndex;
    } else if (canGrab && !holds[e.side]) {
      const m = pickMovable(rayOrigin, rayDir);
      e.laser.visible = true;
      if (m) { raycaster.set(rayOrigin, rayDir); e.laser.scale.z = raycaster.intersectObject(m)[0]?.distance ?? 1; e.hoverMesh = m; }
      else e.laser.scale.z = 0.6;
    }
  }
  if (!vr) {
    if (panel.visible) {
      raycaster.setFromCamera(mouseNdc, camera);
      hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
      cvs.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
    } else {
      cvs.style.cursor = pc.locked ? 'none' : 'pointer';
      if (canGrab && pc.locked && !holds.mouse) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        aimMesh = pickMovable(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
      }
    }
  }
  if (panel.visible) panel.setHover(hover);
}

// ---------- HTML (PC) ----------
const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
const crossEl = document.getElementById('cross');
const heightEl = document.getElementById('height');
function updateHtml() {
  const vr = renderer.xr.isPresenting;
  const playing = app === 'playing' && !vr;
  crossEl.style.display = playing && pc.locked ? 'block' : 'none';
  heightEl.style.display = playing ? 'block' : 'none';
  if (vr) { hintEl.textContent = ''; statusEl.textContent = ''; return; }
  if (app === 'playing') {
    hintEl.innerHTML = pc.locked
      ? '<span>WASD: andar · Mouse: olhar · Shift/C: abaixar · Espaço: subir · X: de pé · Segure o clique num pedaço solto · Roda ou Q/E: girar · R/F: afastar/aproximar · H: dica · Esc: pausa</span>'
      : '<span>Clique na tela para olhar com o mouse</span>';
  } else hintEl.innerHTML = '<span>Clique nas opções do painel</span>';
}
let lastStatus = '';
function updateHud() {
  const vr = renderer.xr.isPresenting;
  let text = '';
  if (app === 'playing' && game) {
    const def = game.def;
    const head = `${def.id + 1}. ${def.name}${def.master ? ' (mestre)' : ''}${game.stages.length > 1 ? ` · figura ${game.si + 1} de ${game.stages.length}` : ''}`;
    text = time < msg.until ? `${head}\n${msg.text}` : '';
    if (!vr) {
      const s = `${head}${time < msg.until ? `<br><small>${msg.text}</small>` : ''}`;
      if (s !== lastStatus) { statusEl.innerHTML = s; lastStatus = s; }
      heightEl.textContent = `Altura dos olhos: ${pc.h.toFixed(2).replace('.', ',')} m`;
    }
  } else if (!vr && lastStatus) { statusEl.innerHTML = ''; lastStatus = ''; }
  hud.mesh.visible = vr && !!text;
  if (vr) hud.set(text);
}

const vrBtn = document.getElementById('vr');
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let lastT = performance.now();
let fpsFrames = 0, fpsTime = 0;
const _eye = new THREE.Vector3();

function tick(dt) {
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  if (vr) pollGamepads(dt);
  else pcMove(dt);
  rig.updateMatrixWorld(true);
  updateHolds();

  if (app === 'playing' && game) {
    camera.getWorldPosition(_eye);
    const s = levelRoot.scale.x;
    game.update(dt, [_eye.x / s, _eye.y / s, _eye.z / s]);
    handleEvents();
    if (wonTimer > 0) { wonTimer -= dt; if (wonTimer <= 0) finishLevel(); }
  }
  // Zumbido: afina com o alinhamento; baixinho fora do jogo
  if (game && (app === 'playing' || app === 'paused')) {
    const searching = game.state === 'search';
    sfx.setDrone(searching ? game.m.score : 1, app === 'paused' ? 0.25 : searching ? 1 : game.state === 'won' ? 0 : 0.6);
  } else sfx.setDrone(0, 0);

  updateLevelVisuals();
  for (const f of gallery.frames) {
    if (f.flash > 0) { f.flash = Math.max(0, f.flash - dt * 0.5); f.inner.scale.setScalar(1 + 0.12 * Math.sin(f.flash * Math.PI)); }
  }
  updateRays();
  updateHud();

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
  renderer.render(scene, camera);
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
}

// ---------- Depuração (console do navegador) ----------
// pv.dev.loadLevel(1)  carrega a fase 1 (número da fase, de 1 a 15)
// pv.dev.solve()       põe a cabeça no ponto de vista da etapa atual e encaixa os pedaços soltos
// pv.dev.stand()       só leva a cabeça ao ponto de vista (sem arrumar os pedaços soltos)
// pv.dev.advance(3)    roda 3 s de jogo na hora (sem esperar animação)
// pv.dev.solveAll()    resolve a fase inteira (todas as etapas e o final)
// pv.dev.state()       resumo do estado
function moveHeadTo(eye, look) {
  const s = levelRoot.scale.x;
  const target = new THREE.Vector3(eye[0] * s, eye[1] * s, eye[2] * s);
  if (renderer.xr.isPresenting) {
    camera.getWorldPosition(_p);
    rig.position.add(target.sub(_p));
  } else {
    pc.x = target.x; pc.z = target.z; pc.h = target.y;
    const { yaw, pitch } = yawPitchOf([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
    pc.yaw = yaw; pc.pitch = pitch;
    applyPcCamera();
  }
  rig.updateMatrixWorld(true);
}
const dev = {
  loadLevel(n) { startLevel(clamp(Math.round(n) - 1, 0, LEVELS.length - 1)); return dev.state(); },
  solve() {
    if (!game) return 'nenhuma fase carregada';
    if (game.state !== 'search') return `espere: estado ${game.state}`;
    for (const k of Object.keys(holds)) endHold(k);
    const st = game.stage;
    for (const p of st.pieces) {
      if (!p.movable || p.snapped) continue;
      game.grab(p.i); game.setPose(p.i, p.frag.pos, p.frag.quat); game.release(p.i);
    }
    moveHeadTo(st.eye, st.plane.c);
    return `cabeça no ponto da etapa ${st.index + 1} de ${game.stages.length}`;
  },
  // Só leva a cabeça ao ponto de vista (sem arrumar nada): para ver os pedaços soltos fora do lugar.
  stand() {
    if (!game) return 'nenhuma fase carregada';
    moveHeadTo(game.stage.eye, game.stage.plane.c);
    return `cabeça no ponto da etapa ${game.si + 1}`;
  },
  advance(sec = 1) {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) tick(1 / 60);
    lastT = performance.now();
    return dev.state();
  },
  solveAll() {
    for (let guard = 0; guard < 400 && game && app === 'playing' && game.state !== 'won'; guard++) {
      if (game.state === 'search') dev.solve();
      dev.advance(0.5);
    }
    dev.advance(2);
    return dev.state();
  },
  state() {
    return {
      app, fase: levelIndex + 1, nome: LEVELS[levelIndex].name, etapa: game ? game.si + 1 : null,
      estado: game?.state ?? null, nota: game ? +game.m.score.toFixed(3) : null, precisao: game ? +game.m.fine.toFixed(3) : null,
      distanciaDoPonto: game ? +game.m.posErr.toFixed(3) : null, dica: game?.hintReady ?? false,
    };
  },
};
window.pv = { dev, get game() { return game; }, startLevel, goMenu, save, camera, levelRoot, scene,
  _hold: { startHold, endHold, rollHeld, pushHeld, holds, movableMeshes, pc, applyPcCamera, tick } };

resetPcPlayer();
goMenu();
updateHtml();
renderer.setAnimationLoop(loop);
