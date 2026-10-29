// Sons sintetizados na hora (sem arquivos). O principal é o "zumbido": uma nota contínua feita de
// duas vozes que batem (desafinadas) quando a figura está embaralhada e ficam em uníssono, com uma
// quinta por cima, quando ela se alinha. Mais: sino ao travar, encaixe, passos do robô, porta.
const F0 = 196; // sol grave

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.drone = null; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
      this.makeDrone();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setOn(on) {
    this.on = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  makeDrone() {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0;
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = 0.7;
    filter.connect(out); out.connect(this.master);
    const voice = (type, freq, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(filter); o.start();
      return { o, g };
    };
    this.drone = {
      out, filter,
      a: voice('sine', F0, 0.5),
      b: voice('sine', F0, 0.42),
      sub: voice('triangle', F0 / 2, 0.25),
      fifth: voice('sine', F0 * 1.5, 0),
      oct: voice('sine', F0 * 2, 0),
    };
  }

  // score 0..1 (alinhamento), level 0..1 (volume geral do zumbido)
  setDrone(score, level) {
    const d = this.drone;
    if (!d) return;
    const t = this.ctx.currentTime, k = 0.08;
    const s = Math.max(0, Math.min(1, score));
    // segunda voz: até ~1 semitom acima quando embaralhado; batimento some perto do alinhamento
    d.b.o.frequency.setTargetAtTime(F0 * (1 + 0.06 * (1 - s)), t, k);
    d.a.o.frequency.setTargetAtTime(F0 * (1 - 0.012 * (1 - s)), t, k);
    d.fifth.g.gain.setTargetAtTime(0.3 * s ** 3, t, k);
    d.oct.g.gain.setTargetAtTime(0.18 * s ** 5, t, k);
    d.filter.frequency.setTargetAtTime(380 + 2600 * s * s, t, k);
    d.out.gain.setTargetAtTime(level * (0.05 + 0.07 * s), t, 0.15);
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.01 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  // Sino: parciais inarmônicos com decaimento longo.
  bell(f = 784, vol = 0.16, at = 0) {
    [[1, 1, 3.2], [2.76, 0.5, 2.2], [5.4, 0.28, 1.4], [8.93, 0.15, 0.9], [0.5, 0.35, 3.5]]
      .forEach(([m, v, d]) => this.tone(f * m, d, { vol: vol * v, at, attack: 0.004 }));
  }
  lock() { this.bell(784); this.bell(1175, 0.1, 0.18); this.noise(0.6, { vol: 0.05, freq: 6000, q: 0.8 }); }
  fused() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 1.2, { vol: 0.06, at: i * 0.07, type: 'triangle' })); }
  snap() { this.tone(1320, 0.12, { vol: 0.1, type: 'triangle' }); this.tone(1760, 0.18, { vol: 0.07, at: 0.05, type: 'triangle' }); }
  grab() { this.tone(330, 0.12, { vol: 0.1, type: 'triangle', slide: 1.5 }); }
  drop() { this.tone(500, 0.12, { vol: 0.08, type: 'triangle', slide: 0.6 }); }
  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  step() { this.tone(1600 + Math.random() * 300, 0.03, { vol: 0.03, type: 'square' }); }
  hint() { this.tone(660, 0.3, { vol: 0.06 }); this.tone(990, 0.4, { vol: 0.05, at: 0.12 }); }
  stage() { this.bell(523, 0.1); }
  keyFly() { this.noise(1.0, { vol: 0.04, freq: 3000, q: 0.6 }); this.tone(400, 1.2, { vol: 0.04, slide: 2 }); }
  keyIn() { this.noise(0.08, { vol: 0.1, freq: 2500, q: 3 }); }
  keyTurn() { this.noise(0.05, { vol: 0.12, freq: 1800, q: 4 }); this.noise(0.05, { vol: 0.12, freq: 1400, q: 4, at: 0.09 }); }
  door() { this.tone(180, 0.9, { vol: 0.05, type: 'sawtooth', slide: 1.4 }); this.bell(988, 0.08, 0.3); }
  vanish() { this.tone(880, 0.5, { vol: 0.06, slide: 2.2 }); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.bell(f, 0.07, i * 0.14)); }
}
