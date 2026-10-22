import { esc, icon, getJSON } from './util.js';

/* ───────── Procesy: transakcje według typu nieruchomości ───────── */
const sup = s => String(s).replace(/\[(\d+)\]/g, (_, n) => [...n].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));
const data = () => getJSON('procesy');

function chip(r, shorts) {
  if (r[0] === 'x') return `<a class="rchip ext" href="${esc(r[2])}" target="_blank" rel="noopener">${esc(r[1])}</a>`;
  return `<a class="rchip" href="#/baza/ustawy/${esc(r[0])}/a/${encodeURIComponent(r[1])}">art. ${esc(sup(r[1]))} ${esc(shorts[r[0]] || r[0])}</a>`;
}
function item(it, shorts) {
  if (it.k === 't') return `<li class="pi tip"><span class="pk">Wskazówka praktyczna</span><p>${esc(it.t)}</p></li>`;
  return `<li class="pi law"><p>${esc(it.t)}</p><div class="rchips">${it.r.map(r => chip(r, shorts)).join('')}</div></li>`;
}
const legend = d => `<p class="note legend"><b>Jak czytać:</b> pozycje z odnośnikami do artykułów streszczają przepisy sprawdzone w tekstach jednolitych z rejestru ELI (stan na ${esc(d.asOf)}) – kliknij odnośnik, by zobaczyć pełny przepis. Pozycje „Wskazówka praktyczna” to dobra praktyka biura, nie przepis. To pomoc w nauce, nie akt prawny.</p>`;

export async function lista() {
  const d = await data();
  const html = `<h1 class="pagetitle">Procesy</h1>
<p class="lead">Jak przebiega transakcja i co się zmienia w zależności od rodzaju nieruchomości – z odnośnikami do przepisów.</p>${legend(d)}
<div class="sectionhead"><h2>Rodzaj nieruchomości</h2></div>
<div class="grid c2">${d.kinds.map(k => `<a class="card act" href="#/procesy/${k.id}"><span class="t">${esc(k.title)}</span><span class="pub">${esc(k.lead)}</span></a>`).join('')}</div>
<div class="sectionhead"><h2>Ścieżka transakcji sprzedaży</h2></div>
<ol class="stages">${d.stages.map(s => `<li><h3>${esc(s.h.replace(/^\d+\.\s*/, ''))}</h3><ul class="plist">${s.items.map(i => item(i, d.shorts)).join('')}</ul></li>`).join('')}</ol>`;
  return { title: 'Procesy', html };
}

export async function rodzaj(id) {
  const d = await data(); const k = d.kinds.find(x => x.id === id);
  if (!k) return { title: 'Nie znaleziono', html: '<div class="empty"><strong>Nie ma takiej karty.</strong><a href="#/procesy">Wróć do procesów</a></div>' };
  const i = d.kinds.indexOf(k); const prev = d.kinds[i - 1], next = d.kinds[i + 1];
  const html = `<h1 class="pagetitle" style="font-size:1.5rem">${esc(k.title)}</h1><p class="lead">${esc(k.lead)}</p>${legend(d)}
${k.secs.map(s => `<section class="psec"><h2>${esc(s.h)}</h2><ul class="plist">${s.items.map(it => item(it, d.shorts)).join('')}</ul></section>`).join('')}
<nav class="pager">${prev ? `<a href="#/procesy/${prev.id}">‹ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="#/procesy/${next.id}">${esc(next.title)} ›</a>` : '<span></span>'}</nav>`;
  return { title: k.title.length > 26 ? 'Procesy' : k.title, crumb: 'Procesy', html };
}
