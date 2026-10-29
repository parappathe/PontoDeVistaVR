// Progresso e opções, salvos no navegador.
const KEY = 'pontodevistavr.v1';
const DEFAULTS = {
  done: {},          // fases concluídas: { 0: { time: 42.1 }, ... }
  sound: true,
  fitHeight: true,   // no VR, ajusta a galeria à altura de quem joga
  fps: false,
};

export function loadSave() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS, done: {} }; }
}

export function storeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento: segue sem salvar */ }
}
