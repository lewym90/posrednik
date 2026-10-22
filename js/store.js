const KEY = 'ap.v1';
const def = () => ({ v: 1, theme: 'auto', fontScale: 1, read: {}, checks: {}, quiz: { hist: [], wrong: {} }, flash: {}, plan: {}, start: Date.now() });
let S;
try { S = { ...def(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { S = def(); }
const subs = new Set();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
export const state = () => S;
export const onChange = f => subs.add(f);
export function set(fn) { fn(S); persist(); subs.forEach(f => f(S)); }
export function applyPrefs() {
  const r = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') r.dataset.theme = S.theme; else delete r.dataset.theme;
  r.style.setProperty('--fs', S.fontScale || 1);
}
export const exportJSON = () => JSON.stringify(S, null, 1);
export function importJSON(txt) {
  const o = JSON.parse(txt);
  if (!o || typeof o !== 'object' || o.v !== 1) throw new Error('To nie jest kopia zapasowa tej aplikacji.');
  S = { ...def(), ...o }; persist(); subs.forEach(f => f(S));
}
export function resetAll() { S = def(); persist(); subs.forEach(f => f(S)); }
