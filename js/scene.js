// A galeria (sala, luz, molduras) e as malhas de cada coisa: fragmentos, plataformas, porta, robô,
// pegadas e poeira. Também desenha as figuras em 2D para as molduras.
import * as THREE from '../vendor/three/three.module.js';
import { pieceGeom } from './figures.js';
import { ROOM } from './anamorph.js';

const W = ROOM.wall;           // paredes em ±1,75 m
const WALL_H = 3.0;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c };
}

// ---------- Galeria ----------
export function buildGallery() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xece7df);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe4dacb, 2.6));
  const sun = new THREE.DirectionalLight(0xfff3e2, 1.5);
  sun.position.set(1.2, 3, 1.6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe6eeff, 0.5);
  fill.position.set(-1.5, 2, -1.2);
  scene.add(fill);

  // Chão de tábuas claras e o tapete que marca a área de jogo (3 x 3 m)
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#cdbca3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? 'rgba(120,90,60,0.06)' : 'rgba(255,255,255,0.05)';
      g.fillRect(0, i * 32, w, 32);
      g.fillStyle = 'rgba(90,70,50,0.22)'; g.fillRect(0, i * 32, w, 1.5);
      const off = (i * 197) % 512;
      g.fillRect(off, i * 32, 1.5, 32);
    }
  }).tex;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * W), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROOM.half, 2 * ROOM.half), new THREE.MeshLambertMaterial({ color: 0xe6dfd3 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.002;
  scene.add(rug);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xb9ae9e });
  for (const [x, z, w, d] of [[0, ROOM.half, 2 * ROOM.half, 0.02], [0, -ROOM.half, 2 * ROOM.half, 0.02], [ROOM.half, 0, 0.02, 2 * ROOM.half], [-ROOM.half, 0, 0.02, 2 * ROOM.half]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), edgeMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.003, z);
    scene.add(m);
  }

  // Paredes, rodapé e teto com faixas de luz
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf6f2ec, emissive: 0x161410 });
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8d8478 });
  const walls = [
    { pos: [0, 0, -W], rot: 0 }, { pos: [W, 0, 0], rot: -Math.PI / 2 },
    { pos: [0, 0, W], rot: Math.PI }, { pos: [-W, 0, 0], rot: Math.PI / 2 },
  ];
  for (const w of walls) {
    const g = new THREE.Group();
    g.position.set(...w.pos); g.rotation.y = w.rot;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, WALL_H), wallMat);
    m.position.y = WALL_H / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 * W, 0.09, 0.02), baseMat);
    b.position.set(0, 0.045, 0.01);
    g.add(m, b);
    scene.add(g);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * W), new THREE.MeshLambertMaterial({ color: 0xfbfaf7, emissive: 0xa8a298 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
  scene.add(ceil);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.8, 0.8]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 2.6), lightMat);
    l.position.set(x, WALL_H - 0.01, 0);
    scene.add(l);
  }

  // Molduras: 4 por parede, na ordem N, L, S, O. A 16ª é a placa da galeria.
  const frames = [];
  const slots = [-1.05, -0.35, 0.35, 1.05];
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const matMat = new THREE.MeshLambertMaterial({ color: 0xfdfcfa });
  walls.forEach((w, wi) => {
    slots.forEach((sx, si) => {
      const g = new THREE.Group();
      g.position.set(...w.pos); g.rotation.y = w.rot;
      const inner = new THREE.Group();
      inner.position.set(sx, 1.55, 0.02);
      g.add(inner);
      scene.add(g);
      const idx = wi * 4 + si;
      if (idx === 15) {
        const sign = canvasTex(512, 512, (c, cw, ch) => {
          c.fillStyle = '#2a2a2e'; c.fillRect(0, 0, cw, ch);
          c.fillStyle = '#faf7f2'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = 'bold 64px Georgia, serif'; c.fillText('Ponto', cw / 2, 170); c.fillText('de Vista', cw / 2, 250);
          c.font = '28px sans-serif'; c.fillStyle = '#c9bfb2';
          c.fillText('galeria de figuras', cw / 2, 340); c.fillText('que só existem de um lugar', cw / 2, 380);
        }).tex;
        inner.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: sign })));
        return;
      }
      for (const [x, y, bw, bh] of [[0, 0.255, 0.54, 0.03], [0, -0.255, 0.54, 0.03], [0.255, 0, 0.03, 0.54], [-0.255, 0, 0.03, 0.54]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.03), frameMat);
        b.position.set(x, y, 0.015);
        inner.add(b);
      }
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48), matMat);
      mat.position.z = 0.005;
      inner.add(mat);
      const pic = canvasTex(256, 256, () => {});
      const picMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), new THREE.MeshBasicMaterial({ map: pic.tex, transparent: true }));
      picMesh.position.z = 0.008;
      inner.add(picMesh);
      const plaque = canvasTex(256, 64, () => {});
      const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.06), new THREE.MeshBasicMaterial({ map: plaque.tex }));
      plaqueMesh.position.set(0, -0.34, 0.005);
      inner.add(plaqueMesh);
      frames.push({ pic, plaque, inner, flash: 0 });
    });
  });

  function setFrame(i, { num, name, figures, solved }) {
    const f = frames[i];
    if (!f) return;
    const g = f.pic.canvas.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    if (solved) drawFigures(g, figures, 256, 256);
    else {
      g.strokeStyle = 'rgba(42,42,46,0.12)'; g.lineWidth = 3; g.setLineDash([10, 10]);
      g.strokeRect(30, 30, 196, 196);
      g.setLineDash([]);
    }
    f.pic.tex.needsUpdate = true;
    const p = f.plaque.canvas.getContext('2d');
    p.fillStyle = '#f2ede5'; p.fillRect(0, 0, 256, 64);
    p.fillStyle = '#2a2a2e'; p.textAlign = 'center'; p.textBaseline = 'middle';
    p.font = 'bold 26px Georgia, serif';
    p.fillText(solved ? `${num}. ${name}` : `${num}. ?`, 128, 33);
    f.plaque.tex.needsUpdate = true;
  }

  return { scene, frames, setFrame };
}

// ---------- Figuras em 2D (para as molduras) ----------
function bounds(fig) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (x, y, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  for (const pc of fig.pieces) {
    if (pc.s === 'bar') { add(...pc.a, pc.w / 2); add(...pc.b, pc.w / 2); }
    else if (pc.s === 'tri') pc.pts.forEach(p => add(...p));
    else if (pc.s === 'disc') add(...pc.p, pc.r);
    else if (pc.s === 'arc') add(...pc.p, pc.r + pc.w / 2);
    else if (pc.s === 'rect') add(...pc.p, Math.hypot(pc.w, pc.h) / 2);
    else if (pc.s === 'cube') add(...pc.p, pc.size * 0.71);
  }
  return { x0, x1, y0, y1 };
}

export function drawFigures(g, figs, w, h) {
  const n = figs.length;
  figs.forEach((fig, k) => {
    const b = bounds(fig);
    const cw = w / n, pad = 18;
    const sc = Math.min((cw - 2 * pad) / (b.x1 - b.x0), (h - 2 * pad) / (b.y1 - b.y0));
    const ox = k * cw + cw / 2 - (b.x0 + b.x1) / 2 * sc, oy = h / 2 + (b.y0 + b.y1) / 2 * sc;
    const X = (x) => ox + x * sc, Y = (y) => oy - y * sc;
    for (const pc of fig.pieces) {
      g.fillStyle = g.strokeStyle = pc.col;
      if (pc.s === 'bar') {
        g.lineWidth = pc.w * sc; g.lineCap = 'square';
        g.beginPath(); g.moveTo(X(pc.a[0]), Y(pc.a[1])); g.lineTo(X(pc.b[0]), Y(pc.b[1])); g.stroke();
      } else if (pc.s === 'rect' || pc.s === 'cube') {
        const ww = (pc.s === 'cube' ? pc.size : pc.w) * sc, hh = (pc.s === 'cube' ? pc.size : pc.h) * sc;
        g.save(); g.translate(X(pc.p[0]), Y(pc.p[1])); g.rotate(-(pc.r || 0) * Math.PI / 180);
        g.fillRect(-ww / 2, -hh / 2, ww, hh); g.restore();
      } else if (pc.s === 'disc') {
        g.beginPath(); g.arc(X(pc.p[0]), Y(pc.p[1]), pc.r * sc, 0, Math.PI * 2); g.fill();
      } else if (pc.s === 'arc') {
        g.lineWidth = pc.w * sc; g.lineCap = 'butt';
        g.beginPath(); g.arc(X(pc.p[0]), Y(pc.p[1]), pc.r * sc, -pc.a0 * Math.PI / 180, -pc.a1 * Math.PI / 180, true); g.stroke();
      } else if (pc.s === 'tri') {
        g.beginPath(); pc.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill();
      }
    }
  });
}

// ---------- Fragmentos ----------
const geoCache = new Map();
export function pieceGeometry(pc) {
  const key = JSON.stringify(pc);
  if (geoCache.has(key)) return geoCache.get(key);
  const { geom } = pieceGeom(pc);
  let g;
  if (geom.kind === 'box') g = new THREE.BoxGeometry(geom.sx, geom.sy, geom.sz);
  else if (geom.kind === 'cyl') g = new THREE.CylinderGeometry(geom.r, geom.r, geom.d, 32).rotateX(Math.PI / 2);
  else if (geom.kind === 'torus') {
    const segs = Math.max(10, Math.round(geom.arc * 12));
    g = new THREE.TorusGeometry(geom.r, geom.tube, 10, segs, geom.arc);
    if (geom.d) g.scale(1, 1, geom.d / (2 * geom.tube));
  } else {
    const s = new THREE.Shape(geom.pts.map(p => new THREE.Vector2(p[0], p[1])));
    g = new THREE.ExtrudeGeometry(s, { depth: geom.d, bevelEnabled: false }).translate(0, 0, -geom.d / 2);
  }
  geoCache.set(key, g);
  return g;
}

export function makePieceMesh(pc) {
  const color = new THREE.Color(pc.col);
  const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0 });
  const m = new THREE.Mesh(pieceGeometry(pc), mat);
  return m;
}

// ---------- Plataformas, porta e robô (fases "Tornar real") ----------
const stoneMat = new THREE.MeshLambertMaterial({ color: 0xbdb3a5 });
const stoneTopMat = new THREE.MeshLambertMaterial({ color: 0x8f8577 });
export function makePad(p) {
  const g = new THREE.Group();
  g.position.set(...p.top);
  g.rotation.y = p.yaw * Math.PI / 180;
  const top = new THREE.Mesh(new THREE.BoxGeometry(p.size[0], 0.05, p.size[1]), stoneTopMat);
  top.position.y = -0.025;
  g.add(top);
  if (!p.floating) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.12, p.size[0] * 0.7), p.top[1] - 0.05, Math.min(0.12, p.size[1] * 0.7)), stoneMat);
    col.position.y = -0.05 - (p.top[1] - 0.05) / 2;
    g.add(col);
  } else {
    // plataforma que flutua: um brilho fraco embaixo
    const glow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(...p.size) * 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.25, depthWrite: false }));
    glow.rotation.x = Math.PI / 2; glow.position.y = -0.06;
    g.add(glow);
  }
  return g;
}

export function makeDoor(d) {
  const g = new THREE.Group();
  g.position.set(...d.pos);
  g.rotation.y = d.yaw * Math.PI / 180;
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  for (const x of [-0.165, 0.165]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.05), frameMat);
    post.position.set(x, 0.25, 0);
    g.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.05), frameMat);
  lintel.position.set(0, 0.5, 0);
  g.add(lintel);
  const light = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.48), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  light.position.set(0, 0.24, -0.015);
  g.add(light);
  const pivot = new THREE.Group();
  pivot.position.set(-0.15, 0, 0);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.47, 0.025), new THREE.MeshLambertMaterial({ color: 0x2c6fd1 }));
  leaf.position.set(0.15, 0.235, 0);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  hole.position.set(0.24, 0.22, 0.006);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshLambertMaterial({ color: 0xe8b22c }));
  knob.position.set(0.24, 0.17, 0.02);
  pivot.add(leaf, hole, knob);
  g.add(pivot);
  g.userData.pivot = pivot;
  return g;
}

export function makeRobot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.045), new THREE.MeshLambertMaterial({ color: 0x1f9e9a }));
  body.position.y = 0.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.04, 0.042), new THREE.MeshLambertMaterial({ color: 0xfafafa }));
  head.position.y = 0.1;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e });
  for (const x of [-0.012, 0.012]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.004), eyeMat);
    e.position.set(x, 0.103, 0.022);
    g.add(e);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.03, 6), eyeMat);
  ant.position.y = 0.135;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe0412f }));
  ball.position.y = 0.152;
  const legs = [];
  for (const x of [-0.015, 0.015]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.02), eyeMat);
    l.position.set(x, 0.012, 0);
    g.add(l); legs.push(l);
  }
  g.add(body, head, ant, ball);
  g.userData = { body, head, legs };
  return g;
}

// ---------- Pegadas (marca do ponto de vista) ----------
export function makeFootprints(color, opacity) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const sole = new THREE.CircleGeometry(1, 24);
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(sole, mat);
    f.scale.set(0.042, 0.1, 1);
    f.rotation.x = -Math.PI / 2;
    f.position.set(side * 0.08, 0.006, 0);
    const toe = new THREE.Mesh(sole, mat);
    toe.scale.set(0.034, 0.03, 1);
    toe.rotation.x = -Math.PI / 2;
    toe.position.set(side * 0.08 + side * 0.006, 0.006, -0.125);
    g.add(f, toe);
  }
  const label = canvasTex(256, 64, () => {});
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshBasicMaterial({ map: label.tex, transparent: true, depthWrite: false }));
  lm.rotation.x = -Math.PI / 2;
  lm.position.set(0, 0.007, 0.2);
  g.add(lm);
  g.userData.setText = (text) => {
    const c = label.canvas.getContext('2d');
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = `rgba(42,42,46,${Math.min(1, opacity + 0.2)})`;
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 128, 32);
    label.tex.needsUpdate = true;
  };
  return g;
}

// ---------- Poeira ----------
export function makeDustPoints(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const dot = canvasTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }).tex;
  const mat = new THREE.PointsMaterial({ color: 0x6f6252, map: dot, size: 0.009, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
