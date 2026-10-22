import { $, $$, esc, strip, fold, icon, getJSON, debounce, safe } from './util.js';
import { applyPrefs, onChange } from './store.js';
import * as V from './views.js';
import * as U from './ustawy.js';
import * as PR from './procesy.js';
import * as ZM from './zmiany.js';
import * as WZ from './wzory.js';
import * as ST from './start.js';

applyPrefs();
const NAV = [['', 'Start', 'home'], ['kurs', 'Kurs', 'book'], ['baza', 'Baza', 'db'], ['procesy', 'Procesy', 'sheet'], ['cwicz', 'Ćwicz', 'quiz'], ['narzedzia', 'Narzędzia', 'tool'], ['droga', 'Droga', 'road', 1], ['ustawienia', 'Ustawienia', 'gear', 1]];
const nav = $('#nav');
nav.innerHTML = `<a class="brand" href="#/" aria-label="Start"><img src="icons/icon.svg" alt="" width="44" height="44"><span class="bname" hidden>Akademia<br>Pośrednika</span></a>` +
  NAV.map(([k, n, i, dsk]) => `<a href="#/${k}" data-k="${k}" ${dsk ? 'class="dsk"' : ''}>${icon(i)}<span>${n}</span></a>`).join('');
const mq = matchMedia('(min-width:1240px)'); const bn = () => $('.bname', nav).hidden = !mq.matches; bn(); mq.addEventListener('change', bn);

const top = $('#topbar'), main = $('#main');
function setTop(title, crumb) {
  top.innerHTML = `<button class="iconbtn" id="back" aria-label="Wstecz" ${location.hash.split('/').length > 2 ? '' : 'hidden'}>${icon('back')}</button><h1>${crumb ? `<span class="crumb">${esc(crumb)}</span>` : ''}${esc(title)}</h1><button class="iconbtn" id="sbtn" aria-label="Szukaj w całej aplikacji">${icon('search')}</button><a class="iconbtn" href="#/ustawienia" aria-label="Ustawienia">${icon('gear')}</a>`;
  $('#back', top).onclick = () => { const p = location.hash.replace(/^#\//, '').split('/'); if (p.length > 1) location.hash = '#/' + p.slice(0, p[0] === 'kurs' || (p[0] === 'baza' && p[1] !== 'ustawy') ? 1 : p.length - 1).join('/'); else history.back(); };
  $('#sbtn', top).onclick = openSearch;
}

async function route() {
  main._cleanup?.(); main._cleanup = null;
  const raw = location.hash.replace(/^#\/?/, ''); const [path, query = ''] = raw.split('?'); const p = path.split('/').filter(Boolean).map(decodeURIComponent);
  const area = p[0] || '';
  $$('a', nav).forEach(a => { const on = a.dataset.k === area; on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  let r;
  try {
    if (area === '') r = await V.start();
    else if (area === 'kurs') r = p[1] ? await V.kursChapter(p[1], p[2]) : await V.kursList();
    else if (area === 'baza') r = p[1] === 'zmiany' ? await ZM.zmiany() : (!p[1] || p[1] === 'ustawy') ? (p[2] ? await U.ustawa(p[2], p[3], p[4]) : await U.ustawyList()) : await V.baza(p[1], new URLSearchParams(query).get('q') || '');
    else if (area === 'procesy') r = p[1] ? await PR.rodzaj(p[1]) : await PR.lista();
    else if (area === 'cwicz') r = p[1] === 'test' ? await V.test(p[2]) : p[1] === 'fiszki' ? await V.fiszki(p[2]) : await V.cwiczHub();
    else if (area === 'narzedzia') r = p[1] === 'wzory' ? await WZ.wzory(p[2]) : p[1] === 'start' ? await ST.startBiura() : p[1] ? await V.narzedzie(p[1]) : V.narzedzia();
    else if (area === 'droga') r = await V.droga();
    else if (area === 'ustawienia') r = V.ustawienia();
    else r = { title: 'Nie znaleziono', html: '<div class="empty"><strong>Tej strony nie ma.</strong><a href="#/">Wróć na start</a></div>' };
  } catch (e) {
    console.error(e);
    r = { title: 'Błąd', html: `<div class="empty"><strong>Nie udało się wczytać danych.</strong>Sprawdź połączenie i odśwież stronę.</div>` };
  }
  setTop(r.title, r.crumb);
  main.innerHTML = r.html;
  main._rerender = null;
  if (r.after) await r.after(main);
  if (!(area === 'kurs' && p[2])) scrollTo(0, 0);
  if (!(area === 'kurs' && p[2])) main.focus({ preventScroll: true });
}
addEventListener('hashchange', route);
route();

/* ───────── wyszukiwarka globalna ───────── */
let index;
async function buildIndex() {
  if (index) return index;
  const [book, pr, sl] = await Promise.all([getJSON('book'), getJSON('przepisy'), getJSON('slownik')]);
  index = [];
  for (const part of book.parts) for (const c of part.chapters) for (const s of c.sections) {
    const flat = [];
    (function w(bl) { for (const b of bl) { if (b.t === 'p' || b.t === 'h3') flat.push(strip(b.h)); else if (b.items) flat.push(...b.items.map(strip)); else if (b.t === 'table') b.rows.forEach(r => flat.push(r.map(strip).join(' – '))); else if (b.t === 'callout') w(b.blocks); } })(s.blocks);
    flat.forEach(t => index.push({ k: 'Kurs', h: s.id === `${c.n}.0` ? `${c.n}. ${c.title}` : `${s.id} ${s.title}`, t, f: fold(t), u: `#/kurs/${c.n}/${s.id}`, w: 1 }));
  }
  pr.forEach(x => { const t = strip(x.h); index.push({ k: 'Przepis', h: strip(x.ref || x.secTitle), t, f: fold(t + ' ' + (x.ref || '')), u: `#/kurs/${x.ch}/${x.sec}`, w: 3 }); });
  sl.forEach(x => index.push({ k: 'Słownik', h: x.term, t: strip(x.def), f: fold(x.term + ' ' + x.def), u: '#/baza/slownik', w: 4 }));
  return index;
}
function openSearch() {
  const ov = $('#overlay'); ov.hidden = false;
  ov.innerHTML = `<div class="sheetbox" role="dialog" aria-modal="true" aria-label="Szukaj"><div class="searchbar">${icon('search')}<input class="inp" id="gq" type="search" placeholder="Szukaj w kursie, przepisach i słowniku" autocomplete="off"></div><div id="gres" style="margin-top:10px"><p class="note" style="padding:10px">Wpisz co najmniej 2 znaki. Szukanie ignoruje polskie znaki.</p></div></div>`;
  const inp = $('#gq', ov); inp.focus();
  const close = () => { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc_);
  ov.onclick = e => { if (e.target === ov || e.target.closest('a')) close(); };
  inp.addEventListener('input', debounce(async () => {
    const terms = fold(inp.value).split(/\s+/).filter(t => t.length > 1); const out = $('#gres', ov);
    if (!terms.length) { out.innerHTML = ''; return; }
    const ix = await buildIndex();
    const hits = []; for (const x of ix) { if (terms.every(t => x.f.includes(t) || fold(x.h).includes(t))) { const hs = fold(x.h); hits.push({ x, s: x.w + (terms.some(t => hs.includes(t)) ? -2 : 0) }); } }
    hits.sort((a, b) => a.s - b.s); const top = hits.slice(0, 30);
    const snip = x => { const i = Math.max(0, x.f.indexOf(terms[0]) - 50); let s = x.t.slice(i, i + 170); return (i ? '…' : '') + esc(s).replace(new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>'); };
    out.innerHTML = top.length ? top.map(({ x }) => `<a class="hit" href="${x.u}"><div class="k">${x.k}</div><div class="h">${esc(x.h)}</div><div class="s">${snip(x)}</div></a>`).join('') + (hits.length > 30 ? `<p class="note" style="padding:8px 10px">Pokazano 30 z ${hits.length}. Zawęź frazę.</p>` : '') : `<div class="empty"><strong>Brak wyników.</strong>Spróbuj innego słowa.</div>`;
  }));
}
addEventListener('keydown', e => { if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); } });

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
