import { esc, getJSON } from './util.js';
import { state, set } from './store.js';

/* ───────── Start biura: lista kontrolna z odnośnikami do przepisów ───────── */
const sup = s => String(s).replace(/\[(\d+)\]/g, (_, n) => [...n].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));
function chip(r, sh) {
  if (r[0] === 'x') return `<a class="rchip ext" href="${esc(r[2])}" target="_blank" rel="noopener">${esc(r[1])}</a>`;
  if (r[0] === 'l') return `<a class="rchip" href="${esc(r[2])}">${esc(r[1])}</a>`;
  return `<a class="rchip" href="#/baza/ustawy/${esc(r[0])}/a/${encodeURIComponent(r[1])}">art. ${esc(sup(r[1]))} ${esc(sh[r[0]] || r[0])}</a>`;
}
export async function startBiura() {
  const d = await getJSON('start'); const all = d.sections.flatMap((s, si) => s.items.map((_, i) => `s${si}.${i}`));
  const done = () => all.filter(k => state().checks[k]).length;
  const html = `<h1 class="pagetitle">Start biura</h1>
<p class="lead">Lista kontrolna otwarcia biura pośrednictwa – od warunków formalnych po pierwsze tygodnie. Odhaczenia zapamiętuje to urządzenie.</p>
<p class="note legend"><b>Jak czytać:</b> pozycje z odnośnikami do artykułów streszczają przepisy sprawdzone w tekstach jednolitych z rejestru ELI (stan na ${esc(d.asOf)}). „Wskazówka praktyczna” to dobra praktyka, nie przepis. Sprawdź aktualność przed zakupem polisy i rejestracją – to pomoc w nauce, nie akt prawny.</p>
<p class="tag num" id="scnt" style="margin:8px 0">${done()}/${all.length}</p>
${d.sections.map((s, si) => `<section class="psec"><h2>${esc(s.h)}</h2><ul class="plist">${s.items.map((it, i) => `<li class="pi ${it.k === 't' ? 'tip' : 'law'}"><label class="check"><input type="checkbox" data-k="s${si}.${i}" ${state().checks[`s${si}.${i}`] ? 'checked' : ''}><span>${it.k === 't' ? '<span class="pk">Wskazówka praktyczna</span>' : ''}<p>${esc(it.t)}</p></span></label>${it.r.length ? `<div class="rchips">${it.r.map(r => chip(r, d.shorts)).join('')}</div>` : ''}</li>`).join('')}</ul></section>`).join('')}`;
  return { title: 'Start biura', crumb: 'Narzędzia', html, after: el => el.addEventListener('change', e => { const k = e.target.dataset?.k; if (!k) return; set(S => { if (e.target.checked) S.checks[k] = 1; else delete S.checks[k]; }); el.querySelector('#scnt').textContent = `${done()}/${all.length}`; }) };
}
