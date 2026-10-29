// Painel de menu flutuante (o mesmo no PC e no VR): desenhado num canvas e mostrado num
// plano 3D. No VR se aponta com o controle; no PC se clica com o mouse.
import * as THREE from '../vendor/three/three.module.js';

const W = 1024, H = 720;
const C = {
  bg: '#faf7f2', edge: '#2a2a2e', text: '#2a2a2e', dim: '#857a70', accent: '#e0412f',
  btn: '#e9e2d7', btnHover: '#dccfbd', btnOn: '#2a2a2e', btnOnText: '#faf7f2', lock: '#f1ece5',
};

export class Panel {
  constructor(width = 1.1) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const height = width * H / W;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 10;
    this.buttons = [];
    this.hover = -1;
    this.drawFn = null;
  }

  show(drawFn) { this.drawFn = drawFn; this.hover = -1; this.mesh.visible = true; this.redraw(); }
  hide() { this.mesh.visible = false; this.drawFn = null; }
  get visible() { return this.mesh.visible; }

  redraw() {
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = C.bg; roundRect(g, 4, 4, W - 8, H - 8, 28); g.fill();
    g.strokeStyle = C.edge; g.lineWidth = 4; g.stroke();
    this.buttons = [];
    this.drawFn?.(this);
    this.tex.needsUpdate = true;
  }

  // Ferramentas de desenho para as telas.
  title(text, y = 70) {
    const g = this.ctx;
    g.fillStyle = C.edge; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, y);
  }
  text(text, x, y, { size = 32, color = C.text, align = 'center', bold = false } = {}) {
    const g = this.ctx;
    g.fillStyle = color; g.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(text, x, y);
  }
  button(label, action, x, y, w, h, { on = false, locked = false, size = 34, sub = null } = {}) {
    const g = this.ctx;
    const i = this.buttons.length;
    this.buttons.push({ x, y, w, h, action: locked ? null : action });
    g.fillStyle = locked ? C.lock : on ? C.btnOn : (i === this.hover ? C.btnHover : C.btn);
    roundRect(g, x, y, w, h, 16); g.fill();
    if (i === this.hover && !locked) { g.strokeStyle = C.edge; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = on ? C.btnOnText : locked ? C.dim : C.text;
    g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x + w / 2, y + h / 2 - (sub ? 14 : 0));
    if (sub) { g.font = `24px sans-serif`; g.fillStyle = on ? C.btnOnText : C.dim; g.fillText(sub, x + w / 2, y + h / 2 + 20); }
  }
  // Quadradinho de fase no menu: número, nome, se já foi resolvida, se é mestre e se está liberada.
  tile(x, y, w, h, { num, name, done = false, master = false, locked = false, action }) {
    const g = this.ctx;
    const i = this.buttons.length;
    this.buttons.push({ x, y, w, h, action: locked ? null : action });
    g.fillStyle = locked ? C.lock : (i === this.hover ? C.btnHover : C.btn);
    roundRect(g, x, y, w, h, 16); g.fill();
    if (!locked && !done) { g.strokeStyle = C.accent; g.lineWidth = 3; g.stroke(); }
    if (i === this.hover && !locked) { g.strokeStyle = C.edge; g.lineWidth = 3; g.stroke(); }
    this.text(locked ? '·' : String(num), x + w / 2, y + 44, { size: 46, bold: true, color: locked ? C.dim : C.edge });
    this.text(locked ? 'bloqueada' : name, x + w / 2, y + 92, { size: 21, color: locked ? C.dim : C.text });
    if (master) this.text('mestre', x + w / 2, y + 118, { size: 18, color: C.accent, bold: true });
    if (done) this.text('✓', x + w - 24, y + 24, { size: 30, color: '#3aa655', bold: true });
  }
  label(text, x, y) { this.text(text, x, y, { size: 24, color: C.dim, align: 'left', bold: true }); }

  // uv do raycast → índice do botão
  pick(uv) {
    if (!uv) return -1;
    const x = uv.x * W, y = (1 - uv.y) * H;
    return this.buttons.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }
  setHover(i) { if (i !== this.hover) { this.hover = i; this.redraw(); } }
  actionAt(i) { return i >= 0 ? this.buttons[i]?.action : null; }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Painel pequeno de texto (FPS, avisos) preso à câmera. set() aceita várias linhas separadas por quebra de linha.
export class Label {
  constructor(width = 0.16, px = 256, py = 64, { bg = 'rgba(0,0,0,0.6)', color = '#ffdf6e', font = 'monospace' } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px; this.canvas.height = py;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * py / px),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false }));
    this.mesh.renderOrder = 11;
    this.style = { bg, color, font };
    this.last = null;
  }
  set(text) {
    if (text === this.last) return;
    this.last = text;
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height;
    g.clearRect(0, 0, w, h);
    if (!text) { this.tex.needsUpdate = true; return; }
    const lines = String(text).split('\n');
    const lh = Math.min(h * 0.55, (h * 0.86) / lines.length);
    g.fillStyle = this.style.bg; roundRect(g, 2, 2, w - 4, h - 4, Math.min(24, h / 4)); g.fill();
    g.fillStyle = this.style.color; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.font = `${i === 0 ? 'bold ' : ''}${Math.round(lh * (i === 0 ? 0.8 : 0.66))}px ${this.style.font}`;
      g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh);
    });
    this.tex.needsUpdate = true;
  }
}
