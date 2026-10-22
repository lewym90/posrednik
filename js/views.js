import { esc, safe, strip, fold, icon, getJSON, fmtPLN, num, plural, toast } from './util.js';
import { state, set, exportJSON, importJSON, resetAll, applyPrefs } from './store.js';
import * as C from './calc.js';

/* ───────── pomocnicze ───────── */
const LAB = { przepis: ['law', 'Przepis'], przyklad: ['bulb', 'Przykład'], pulapka: ['warn', 'Pułapka'], zapamietaj: ['pin', 'Zapamiętaj'], definicja: ['info', 'Definicja'], projekt: ['info', 'Projekt'] };
export const chapters = book => book.parts.filter(p => p.chapters.length).flatMap(p => p.chapters.map(c => ({ ...c, part: p.title })));
const secKey = (ch, s) => `${ch}|${s}`;
export function chProgress(ch) {
  const r = state().read; const tot = ch.sections.length;
  const done = ch.sections.filter(s => r[secKey(ch.n, s.id)]).length;
  return { done, tot, pct: tot ? done / tot : 0 };
}
const blocksHTML = bl => bl.map(blockHTML).join('');
function blockHTML(b) {
  switch (b.t) {
    case 'p': return `<p>${safe(b.h)}</p>`;
    case 'h3': return `<h3>${safe(b.h)}</h3>`;
    case 'label': return `<h3>${safe(b.h)}</h3>`;
    case 'ul': return `<ul>${b.items.map(i => `<li>${safe(i)}</li>`).join('')}</ul>`;
    case 'ol': return `<ol>${b.items.map(i => `<li>${safe(i)}</li>`).join('')}</ol>`;
    case 'table': {
      const head = b.head || [];
      return `<div class="tablewrap ${head.length <= 4 ? 'stackable' : ''}" tabindex="0" role="region" aria-label="Tabela"><table><thead><tr>${head.map(h => `<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${esc(strip(head[i] || ''))}">${safe(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    case 'figure': return b.cap ? `<p class="figcap">${icon('sheet')} Schemat w publikacji: ${safe(b.cap)}</p>` : '';
    case 'callout': {
      const [ic, name] = LAB[b.kind] || ['info', b.kind];
      return `<aside class="call ${esc(b.kind)}"><div class="lab">${icon(ic)}${name}</div><div class="in">${blocksHTML(b.blocks)}</div></aside>`;
    }
    case 'src': return `<p class="src">${safe(b.h)}</p>`;
    default: return '';
  }
}
const KN = { zaktualizowano: ['red', 'Zaktualizowano w treści'], potwierdzone: ['green', 'Potwierdzone w tekście przepisu'], zmiana: ['red', 'Zmiana względem książki'], uzupelnienie: ['blue', 'Uzupełnienie'], 'do-weryfikacji': ['amber', 'Do weryfikacji'] };
function noticeHTML(x, kn = KN, link = false) {
  const [c, t] = kn[x.kind] || ['', x.kind];
  return `<aside class="plot notice"><div class="row"><span class="tag ${c}">${t}</span><b>${esc(x.title)}</b></div><p style="margin-top:8px">${esc(x.text)}</p><div class="srcs row" style="margin-top:8px;gap:6px">${(x.srcs || []).map(s => `<a class="tag blue" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)}</a>`).join('')}</div><span class="note">Sprawdzono ${esc(x.date)}${link ? ` · <a href="#/kurs/${x.ch}/${x.sec}">rozdz. ${x.ch}, sekcja ${x.sec}</a>` : ''}</span></aside>`;
}
const dz = (n, cls = '') => `<span class="dz ${cls}"><span><small>rozdz.</small>${n}</span></span>`;

/* ───────── START ───────── */
const FEB = new Date(2027, 1, 1);
function parcelPath(i, cols, rows, W, H) {
  // wspólne wierzchołki z deterministycznym „drgnięciem" – działki przylegają jak na mapie ewidencyjnej
  const cw = W / cols, ch = H / rows;
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const v = (x, y) => {
    const edge = x === 0 || y === 0 || x === cols || y === rows;
    const dx = edge ? 0 : (rnd(x, y) - .5) * cw * .34, dy = edge ? 0 : (rnd(y + 9, x + 3) - .5) * ch * .34;
    return [x * cw + dx, y * ch + dy];
  };
  const x = i % cols, y = Math.floor(i / cols);
  const pts = [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)];
  const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cy = pts.reduce((a, p) => a + p[1], 0) / 4;
  return { d: 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join('L') + 'Z', cx, cy };
}
export async function start() {
  const book = await getJSON('book'); const chs = chapters(book);
  const cols = 6, rows = Math.ceil(chs.length / cols), W = 600, H = rows * 100;
  const prog = chs.map(chProgress);
  const done = prog.filter(p => p.pct === 1).length;
  const sections = prog.reduce((a, p) => a + p.done, 0), allSec = prog.reduce((a, p) => a + p.tot, 0);
  const days = Math.max(0, Math.ceil((FEB - new Date()) / 864e5));
  const q = state().quiz.hist; const last = q[q.length - 1];
  const next = chs.find((c, i) => prog[i].pct < 1);
  const nextP = next && prog[chs.indexOf(next)];
  const map = chs.map((c, i) => {
    const p = parcelPath(i, cols, rows, W, H), pr = prog[i];
    const cls = pr.pct === 1 ? 'done' : pr.done ? 'started' : '';
    return `<a href="#/kurs/${c.n}" aria-label="Rozdział ${c.n}: ${esc(c.title)}, przeczytano ${pr.done} z ${pr.tot}"><path class="parcel ${cls}" d="${p.d}"/><text x="${p.cx.toFixed(1)}" y="${(p.cy + 5).toFixed(1)}">${c.n}</text></a>`;
  }).join('');
  return {
    title: 'Start', html: `
<div class="hero">
  <section class="card mapcard" aria-label="Mapa postępu nauki">
    <div class="maphead"><div><strong>Twoja mapa wiedzy</strong><span>Każda działka to rozdział kursu. Dotknij, aby wejść.</span></div><span class="tag green num">${done}/${chs.length}</span></div>
    <svg class="map" viewBox="0 0 ${W} ${H}" role="group"><defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--red-soft)"/><line x1="0" y1="0" x2="0" y2="7" stroke="var(--red)" stroke-width="2.2"/></pattern></defs>${map}</svg>
    <div class="maplegend"><span><i></i>nieprzeczytany</span><span><i class="s"></i>w trakcie</span><span><i class="d"></i>zabudowany (cały przeczytany)</span></div>
  </section>
  <div class="stack"><section class="card countdown">
    <div><div class="muted" style="font-weight:650;font-size:.9rem">Do lutego 2027</div>
      <div class="big">${days}<small>${plural(days, 'dzień', 'dni', 'dni')}</small></div></div>
    <div class="stats">
      <div class="stat"><b>${sections}</b><span>z ${allSec} sekcji</span></div>
      <div class="stat"><b>${last ? last.pct + '%' : '–'}</b><span>ostatni test</span></div>
      <div class="stat"><b>${Object.keys(state().checks).filter(k => state().checks[k]).length}</b><span>punktów z list</span></div>
    </div>
    <a class="btn quiet" href="#/droga">${icon('road')} Droga do otwarcia biura</a>
  </section>
  ${next ? `<a class="card next" href="#/kurs/${next.n}"><span class="muted" style="font-weight:650;font-size:.85rem">${nextP.done ? 'Wróć do rozdziału' : 'Następny rozdział'}</span><span class="t">${next.n}. ${esc(next.title)}</span><div class="bar"><i style="width:${Math.round(nextP.pct * 100)}%"></i></div><span class="muted" style="font-size:.85rem">${nextP.done} z ${nextP.tot} sekcji</span></a>` : `<div class="card"><b>Cały kurs przeczytany.</b><p class="muted">Rozwiąż test egzaminacyjny i wracaj do ramek „Zapamiętaj".</p></div>`}
  <section class="card qod"><span class="muted" style="font-weight:650;font-size:.85rem">Pytanie na dziś</span><div id="qod"><p class="q">…</p></div><div class="row"><a class="btn small primary" href="#/cwicz/fiszki">${icon('flash')} Fiszki</a><a class="btn small quiet" href="#/cwicz/test">Test 100 pytań</a></div></section></div>
</div>
<div class="sectionhead"><h2>Na skróty</h2></div>
<div class="grid c3">
  <a class="card toolcard" href="#/baza/ustawy"><span class="ic">${icon('law')}</span><b>Ustawy – pełne teksty</b><span>Kodeks cywilny, u.g.n., księgi wieczyste i inne – z wyszukiwarką artykułów.</span></a>
  <a class="card toolcard" href="#/narzedzia/koszty"><span class="ic">${icon('tool')}</span><b>Kalkulatory</b><span>Koszty zakupu, prowizja, rata, rentowność najmu, PIT od sprzedaży.</span></a>
  <a class="card toolcard" href="#/baza/akty"><span class="ic">${icon('db')}</span><b>Akty prawne</b><span>Wykaz ustaw i rozporządzeń z adresami publikacji.</span></a>
</div>`,
    after: async el => {
      const f = await getJSON('test'); const qq = f.questions[(new Date().getDate() + new Date().getMonth() * 3) % f.questions.length];
      const n = el.querySelector('#qod'); if (!n) return;
      n.innerHTML = `<p class="q">${esc(qq.q)}</p><div class="opts" style="margin-top:10px">${Object.entries(qq.o).map(([k, v]) => `<button class="opt" data-k="${k}"><b>${k.toUpperCase()}</b><span>${esc(v)}</span></button>`).join('')}</div><p class="note" id="qfb" aria-live="polite"></p>`;
      n.parentElement.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b || b.disabled) return; n.parentElement.querySelectorAll('.opt').forEach(o => { o.disabled = true; o.classList.toggle('right', o.dataset.k === qq.a); }); if (b.dataset.k !== qq.a) b.classList.add('wrong'); n.querySelector('#qfb').textContent = b.dataset.k === qq.a ? 'Dobrze.' : 'Poprawna odpowiedź: ' + qq.a.toUpperCase() + '.'; });
    }
  };
}

/* ───────── KURS ───────── */
export async function kursList() {
  const book = await getJSON('book');
  const html = book.parts.filter(p => p.chapters.length).map(p => `
<section class="part"><header><h2>${esc(p.title)}</h2></header><p class="intro">${esc(p.intro)}</p>
<div class="chapgrid">${p.chapters.map(c => {
    const pr = chProgress(c); const cls = pr.pct === 1 ? 'done' : pr.done ? 'started' : '';
    return `<a class="chap ${cls}" href="#/kurs/${c.n}"><span class="dz">${c.n}</span><span><span class="name">${esc(c.title)}</span><span class="meta"><span>${c.sections.length} ${plural(c.sections.length, 'sekcja', 'sekcje', 'sekcji')}</span><span>${pr.done ? pr.done + ' przeczytano' : 'nowy'}</span></span></span><span class="go">${icon('next')}</span></a>`;
  }).join('')}</div></section>`).join('');
  return { title: 'Kurs', html: `<h1 class="pagetitle">Kurs pośrednika</h1><p class="lead">Pełna treść Twojej publikacji, stan prawny: ${esc(book.legalState)}. Zaznaczaj przeczytane sekcje, a mapa na ekranie startowym zabuduje się sama.</p>${html}` };
}
export async function kursChapter(n, sec) {
  const book = await getJSON('book'); const chs = chapters(book); const kor = (await getJSON('korekty')).filter(x => x.ch === +n);
  const idx = chs.findIndex(c => c.n === +n); const c = chs[idx];
  if (!c) return { title: 'Nie znaleziono', html: '<div class="empty"><strong>Nie ma takiego rozdziału.</strong><a href="#/kurs">Wróć do spisu</a></div>' };
  const pr = chProgress(c);
  const toc = c.sections.map(s => `<a href="#/kurs/${c.n}/${s.id}" data-sec="${s.id}" class="${state().read[secKey(c.n, s.id)] ? 'read' : ''}"><span class="n">${s.id.startsWith(c.n + '.0') ? '' : s.id}</span><span>${esc(s.title)}</span></a>`).join('');
  const body = c.sections.map(s => `
<section class="sec" id="s-${s.id}">${s.id === `${c.n}.0` ? '' : `<h2><span class="n">${s.id}</span>${esc(s.title)}</h2>`}
${kor.filter(x => x.sec === s.id).map(x => `<div style="max-width:66ch;margin-top:12px">${noticeHTML(x)}</div>`).join('')}<div class="prose">${blocksHTML(s.blocks)}</div>
<div class="done-row"><button class="btn small ${state().read[secKey(c.n, s.id)] ? '' : 'quiet'}" data-act="read" data-s="${s.id}" aria-pressed="${!!state().read[secKey(c.n, s.id)]}">${icon('check')} <span>${state().read[secKey(c.n, s.id)] ? 'Przeczytane' : 'Oznacz jako przeczytane'}</span></button></div></section>`).join('');
  const check = c.check.length ? `<section class="sec" id="s-check"><h2>Sprawdź się</h2><div class="prose"><p>Odpowiedz sobie na pytania, potem porównaj z kluczem. Karta po karcie:</p></div><div style="margin-top:12px"><a class="btn primary" href="#/cwicz/fiszki/${c.n}">${icon('flash')} Fiszki z rozdziału ${c.n} (${c.check.length})</a></div></section>` : '';
  const prev = chs[idx - 1], nxt = chs[idx + 1];
  return {
    title: `Rozdział ${c.n}`, crumb: c.part, html: `
<div class="reader"><article>
<header class="chead">${dz(c.n)}<h1>${esc(c.title)}</h1><div class="meta"><span class="tag">${esc(c.part.replace(/\..*/, ''))}</span><span class="tag ${pr.pct === 1 ? 'green' : ''} num" id="chprog">${pr.done}/${pr.tot} sekcji</span></div></header>
${body}${check}
${c.sources ? `<p class="src"><b>Podstawa:</b> ${safe(c.sources.replace(/^Źródła:\s*/, ''))}</p>` : ''}
<nav class="row" style="justify-content:space-between;margin-top:26px">${prev ? `<a class="btn quiet" href="#/kurs/${prev.n}">${icon('back')} ${prev.n}</a>` : '<span></span>'}${nxt ? `<a class="btn" href="#/kurs/${nxt.n}">Rozdział ${nxt.n} ${icon('next')}</a>` : ''}</nav>
</article><aside class="toc" aria-label="Spis rozdziału"><h3>W tym rozdziale</h3>${toc}</aside></div>`,
    after: el => {
      if (sec) el.querySelector('#s-' + CSS.escape(sec))?.scrollIntoView({ block: 'start' });
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { el.querySelectorAll('.toc a').forEach(a => a.classList.toggle('on', a.dataset.sec === e.target.id.slice(2))); } }), { rootMargin: '-90px 0px -70% 0px' });
      el.querySelectorAll('section.sec').forEach(s => io.observe(s));
      el._cleanup = () => io.disconnect();
      el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-act="read"]'); if (!b) return;
        const k = secKey(c.n, b.dataset.s); const on = !state().read[k];
        set(S => { if (on) S.read[k] = Date.now(); else delete S.read[k]; });
        b.setAttribute('aria-pressed', on); b.classList.toggle('quiet', !on); b.querySelector('span').textContent = on ? 'Przeczytane' : 'Oznacz jako przeczytane';
        el.querySelector(`.toc a[data-sec="${b.dataset.s}"]`)?.classList.toggle('read', on);
        const p = chProgress(c); const t = el.querySelector('#chprog'); t.textContent = `${p.done}/${p.tot} sekcji`; t.classList.toggle('green', p.pct === 1);
        if (on && p.pct === 1) toast('Rozdział zabudowany na mapie.');
      });
    }
  };
}

/* ───────── BAZA ───────── */
const baseTabs = cur => `<div class="seg" role="tablist">${[['ustawy', 'Ustawy'], ['zmiany', 'Zmiany'], ['przepisy', 'Z kursu'], ['akty', 'Akty prawne'], ['fakty', 'Fakty i stawki'], ['korekty', 'Korekty'], ['slownik', 'Słownik'], ['zrodla', 'Źródła']].map(([k, n]) => `<a href="#/baza/${k}" aria-current="${k === cur}">${n}</a>`).join('')}</div>`;
export async function baza(tab = 'przepisy', q = '') {
  const head = `<h1 class="pagetitle">Baza wiedzy</h1>${baseTabs(tab)}`;
  if (tab === 'przepisy') {
    const data = (await getJSON('przepisy')).filter(x => x.h);
    const acts = [...new Set(data.map(x => x.ref && (x.ref.match(/(k\.c\.|k\.r\.o\.|k\.p\.c\.|u\.k\.w\.h\.|u\.g\.n\.|k\.p\.a\.|p\.b\.|u\.p\.c\.c\.|u\.p\.d\.o\.f\.|u\.p\.t\.|u\.s\.p\.|RODO|u\.p\.p\.|k\.c)/)?.[1])).filter(Boolean))];
    return { title: 'Baza', html: `${head}<p class="lead">Przepisy cytowane w kursie (${data.length} pozycji). Treść przepisu zawsze porównaj z aktualnym tekstem jednolitym w ISAP.</p>
<div class="searchbar" style="margin:14px 0 10px">${icon('search')}<input class="inp" id="bq" type="search" placeholder="Szukaj w przepisach, np. art. 158 albo zadatek" autocomplete="off" value="${esc(q)}" aria-label="Szukaj w przepisach"></div>
<div class="chips" id="actchips">${acts.map(a => `<button type="button" aria-pressed="false" data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div>
<div class="stack" id="plist" style="margin-top:14px"></div>`,
      after: el => {
        const list = el.querySelector('#plist'), inp = el.querySelector('#bq'); let act = '';
        const draw = () => {
          const terms = fold(inp.value).split(/\s+/).filter(Boolean);
          const rows = data.filter(x => (!act || (x.ref || '').includes(act)) && terms.every(t => fold(x.h + ' ' + (x.ref || '')).includes(t))).slice(0, 80);
          list.innerHTML = rows.length ? rows.map(x => `<article class="plot ref"><div class="refh"><span class="code">${esc(strip(x.ref || 'Przepis'))}</span><a class="where" href="#/kurs/${x.ch}/${x.sec}">rozdz. ${x.ch} · ${esc(x.secTitle)}</a></div><div class="body">${x.ref ? safe(x.h.replace(/^<b>.*?<\/b>\s*/, '')) : safe(x.h)}</div></article>`).join('') : `<div class="empty"><strong>Brak wyników.</strong>Spróbuj krótszej frazy albo numeru artykułu.</div>`;
        };
        inp.addEventListener('input', draw);
        el.querySelector('#actchips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const on = b.getAttribute('aria-pressed') !== 'true'; el.querySelectorAll('#actchips button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', on); act = on ? b.dataset.a : ''; draw(); });
        draw();
      } };
  }
  if (tab === 'akty') {
    const acts = await getJSON('akty'); const groups = [...new Set(acts.map(a => a.group))];
    return { title: 'Baza', html: `${head}<p class="lead">Wykaz aktów z kursu wraz z adresami publikacji (stan: wrzesień 2026). Numery pozycji warto każdorazowo potwierdzić w Dzienniku Ustaw, bo teksty jednolite są często ogłaszane na nowo.</p>
<div class="searchbar" style="margin:14px 0">${icon('search')}<input class="inp" id="aq" type="search" placeholder="Szukaj aktu" aria-label="Szukaj aktu"></div><div id="alist"></div>`,
      after: el => {
        const draw = () => { const t = fold(el.querySelector('#aq').value); el.querySelector('#alist').innerHTML = groups.map(g => { const r = acts.filter(a => a.group === g && fold(a.title + a.pub).includes(t)); return r.length ? `<div class="sectionhead"><h2>${esc(g)}</h2><span class="muted num">${r.length}</span></div><div class="grid c2">${r.map(a => `<article class="card act"><span class="t">${esc(a.title)}</span><span class="pub num">${esc(a.pub)}</span>${a.bookPub ? `<span class="tag amber">w książce: ${esc(a.bookPub)}</span>` : ''}${a.note ? `<span class="note">${esc(a.note)}</span>` : ''}<span class="note">${a.eli ? esc(a.eli) : 'numeru nie sprawdzano w ELI'}</span></article>`).join('')}</div>` : ''; }).join(''); };
        el.querySelector('#aq').addEventListener('input', draw); draw();
      } };
  }
  if (tab === 'fakty') {
    const f = await getJSON('fakty');
    const lvl = l => ({ A: ['green', 'A · dwa źródła urzędowe'], B: ['blue', 'B · kurs + źródło'], C: ['amber', 'C · tylko kurs – zweryfikuj'] }[l] || ['', l]);
    return { title: 'Baza', html: `${head}<p class="lead">Najważniejsze stawki i progi. Każda pozycja ma poziom pewności. ${esc(f.note)}</p>
${f.groups.map(g => `<div class="sectionhead"><h2>${esc(g.title)}</h2></div><div class="grid c2">${g.items.map(i => { const [c, t] = lvl(i.lvl); return `<article class="card fact"><span class="l">${esc(i.l)}</span><span class="v">${esc(i.v)}</span>${i.note ? `<span class="note">${esc(i.note)}</span>` : ''}<div class="row"><span class="tag ${c}">${t}</span>${i.ch ? `<a class="where" style="font-size:.8rem;font-weight:600" href="#/kurs/${i.ch}/${i.sec}">${esc(i.ref)}</a>` : ''}</div>${i.srcs ? `<div class="srcs">${i.srcs.map(s => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)}</a>`).join('')}</div>${i.checked ? `<span class="note">Sprawdzono: ${esc(i.checked)}</span>` : ''}` : ''}</article>`; }).join('')}</div>`).join('')}` };
  }
  if (tab === 'slownik') {
    const g = (await getJSON('slownik')).sort((a, b) => a.term.localeCompare(b.term, 'pl'));
    const letters = [...new Set(g.map(x => x.term[0].toUpperCase()))];
    let out = '', cur = '';
    g.forEach(x => { const L = x.term[0].toUpperCase(); if (L !== cur) { cur = L; out += `<div class="letter" id="l-${L}">${L}</div>`; } out += `<dl class="term" style="margin:0"><dt>${esc(x.term)}</dt><dd>${safe(x.def)}</dd></dl>`; });
    return { title: 'Baza', html: `${head}<p class="lead">${g.length} pojęć z kursu.</p><div class="az">${letters.map(l => `<a href="#/baza/slownik" data-l="${l}">${l}</a>`).join('')}</div>${out}`,
      after: el => el.querySelector('.az').addEventListener('click', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); document.getElementById('l-' + a.dataset.l)?.scrollIntoView(); } }) };
  }
  if (tab === 'korekty') {
    const k = await getJSON('korekty'); const kn = KN;
    return { title: 'Baza', html: `${head}<p class="lead">Różnice między książką a aktualnym stanem na dzień sprawdzenia oraz miejsca, których nie udało się potwierdzić. Tam, gdzie książka podawała nieaktualny numer publikacji, zmieniłem go w treści i zaznaczyłem to tutaj; pozostałe różnice opisuję w ramkach.</p><div class="warn" style="margin-top:12px;max-width:70ch"><b>Zakres sprawdzenia.</b> Porównałem tekst aplikacji z Twoim PDF-em (nic nie dopisano), sprawdziłem w rejestrze ELI numery publikacji aktów z wykazu oraz wybrane stawki i terminy. Nie sprawdzałem artykuł po artykule całej książki. Aplikacja nie zastępuje tekstu ustawy – o stanie prawnym rozstrzyga Dziennik Ustaw.</div><div class="stack" style="margin-top:14px">${k.map(x => noticeHTML(x, kn, true)).join('')}</div>` };
  }
  const z = await getJSON('zrodla');
  return { title: 'Baza', html: `${head}<p class="lead">Gdzie sprawdzać aktualny stan prawny. Aplikacja jest pomocą do nauki – nie zastępuje tekstu ustawy.</p>${z.map(s => `<div class="sectionhead"><h2>${esc(s.title)}</h2></div>${s.items.length ? `<ul class="prose">${s.items.map(i => `<li>${safe(i)}</li>`).join('')}</ul>` : ''}${s.text ? `<p class="prose">${safe(s.text)}</p>` : ''}`).join('')}` };
}

/* ───────── ĆWICZ ───────── */
export async function cwiczHub() {
  const t = await getJSON('test'); const h = state().quiz.hist; const wrong = Object.keys(state().quiz.wrong).length;
  const cats = [...new Set(t.questions.map(q => q.cat))];
  return { title: 'Ćwicz', html: `<h1 class="pagetitle">Ćwicz</h1><p class="lead">Wiedza zostaje, gdy ją przywołujesz. Wybierz tryb.</p>
<div class="grid c2" style="margin-top:16px">
<a class="card toolcard" href="#/cwicz/test"><span class="ic">${icon('quiz')}</span><b>Test egzaminacyjny</b><span>${t.questions.length} pytań jednokrotnego wyboru. Losowe 20 albo cały zestaw.</span></a>
<a class="card toolcard" href="#/cwicz/fiszki"><span class="ic">${icon('flash')}</span><b>Fiszki z rozdziałów</b><span>Pytania otwarte z kursu – odpowiadasz w myślach, potem odsłaniasz wzorzec.</span></a>
<a class="card toolcard" href="#/cwicz/test/bledy"><span class="ic">${icon('warn')}</span><b>Powtórka błędów</b><span>${wrong ? wrong + ' pytań, na które odpowiedziałeś źle.' : 'Na razie brak błędów do powtórzenia.'}</span></a>
</div>
${t.scoreNote ? `<div class="note" style="margin-top:18px;max-width:70ch">${esc(t.scoreNote)}</div>` : ''}
<div class="sectionhead"><h2>Historia testów</h2></div>
${h.length ? `<div class="stack">${h.slice().reverse().slice(0, 8).map(x => `<div class="card row" style="justify-content:space-between"><span>${new Date(x.t).toLocaleDateString('pl-PL')} · ${esc(x.mode)}</span><b class="num">${x.ok}/${x.n} · ${x.pct}%</b></div>`).join('')}</div>` : `<div class="empty"><strong>Nic jeszcze nie rozwiązano.</strong>Zacznij od 20 losowych pytań.</div>`}` };
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export async function test(mode) {
  const t = await getJSON('test');
  if (!mode) return { title: 'Test', html: `<h1 class="pagetitle">Test egzaminacyjny</h1><p class="lead">${esc(t.intro)}</p><div class="row" style="margin-top:20px"><a class="btn primary" href="#/cwicz/test/20">20 losowych</a><a class="btn" href="#/cwicz/test/100">Wszystkie ${t.questions.length}</a></div><div class="sectionhead"><h2>Według działu</h2></div><div class="chips">${[...new Set(t.questions.map(q => q.cat))].sort().map((c, i) => `<a class="btn small quiet" href="#/cwicz/test/cat${i}">${esc(c)}</a>`).join('')}</div>` };
  const cats = [...new Set(t.questions.map(q => q.cat))].sort();
  let qs, label;
  if (mode === '20') { qs = shuffle(t.questions).slice(0, 20); label = '20 losowych'; }
  else if (mode === '100') { qs = t.questions; label = 'Wszystkie'; }
  else if (mode === 'bledy') { qs = t.questions.filter(q => state().quiz.wrong[q.n]); label = 'Powtórka błędów'; }
  else if (mode.startsWith('cat')) { const c = cats[+mode.slice(3)]; qs = t.questions.filter(q => q.cat === c); label = c; }
  if (!qs?.length) return { title: 'Test', html: `<div class="empty"><strong>Brak pytań w tym trybie.</strong><a href="#/cwicz">Wróć</a></div>` };
  return { title: 'Test', crumb: label, html: `<div id="quiz"></div>`, after: el => runQuiz(el.querySelector('#quiz'), qs, label) };
}
function runQuiz(root, qs, label) {
  let i = 0, ok = 0; const res = [];
  const draw = () => {
    const q = qs[i]; let picked = null;
    root.innerHTML = `<div class="flash"><div class="row" style="justify-content:space-between"><b class="num">Pytanie ${i + 1} z ${qs.length}</b><span class="tag">${esc(q.cat.replace(/\.\s.*/, ''))}</span></div>
<div class="progress-dots">${qs.map((_, k) => `<i class="${k < i ? (res[k] ? 'ok' : 'bad') : k === i ? 'cur' : ''}"></i>`).join('')}</div>
<div class="plot face"><p class="q">${esc(q.q)}</p></div>
<div class="opts" role="radiogroup">${Object.entries(q.o).map(([k, v]) => `<button class="opt" role="radio" aria-checked="false" data-k="${k}"><b>${k.toUpperCase()}</b><span>${esc(v)}</span></button>`).join('')}</div>
<div id="fb"></div></div>`;
    root.querySelector('.opts').addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b || picked) return; picked = b.dataset.k;
      const right = picked === q.a; res[i] = right; if (right) ok++;
      root.querySelectorAll('.opt').forEach(o => { o.disabled = true; if (o.dataset.k === q.a) o.classList.add('right'); else if (o.dataset.k === picked) o.classList.add('wrong'); });
      set(S => { if (right) delete S.quiz.wrong[q.n]; else S.quiz.wrong[q.n] = 1; });
      root.querySelector('#fb').innerHTML = `<div class="${right ? 'ok' : 'bad'}" role="status">${right ? 'Dobrze.' : `Poprawna odpowiedź: <b>${q.a.toUpperCase()}</b>. Wróć do kursu, jeśli to nie jest oczywiste.`}</div><div class="row" style="margin-top:12px"><button class="btn primary" id="nx">${i + 1 < qs.length ? 'Dalej' : 'Zobacz wynik'}</button></div>`;
      root.querySelector('#nx').focus();
      root.querySelector('#nx').onclick = () => { i++; i < qs.length ? draw() : done(); };
    });
  };
  const done = () => {
    const pct = Math.round(ok / qs.length * 100);
    set(S => { S.quiz.hist.push({ t: Date.now(), mode: label, n: qs.length, ok, pct }); S.quiz.hist = S.quiz.hist.slice(-50); });
    root.innerHTML = `<div class="flash" style="justify-items:center;text-align:center"><div class="scorering" style="--p:${pct}"><div><b class="num">${pct}%</b><span>${ok} z ${qs.length}</span></div></div><h2>${pct >= 90 ? 'Bardzo dobrze.' : pct >= 75 ? 'Dobrze.' : pct >= 60 ? 'Dostatecznie – powtórz materiał.' : 'Wróć do kursu i spróbuj ponownie.'}</h2><div class="row"><a class="btn primary" href="#/cwicz/test/bledy">Powtórz błędy</a><a class="btn" href="#/cwicz">Koniec</a></div></div>`;
  };
  draw();
}
export async function fiszki(n) {
  const book = await getJSON('book'); const chs = chapters(book).filter(c => c.check.length);
  if (!n) return { title: 'Fiszki', html: `<h1 class="pagetitle">Fiszki</h1><p class="lead">Wybierz rozdział. Pytania otwarte z kursu z wzorcowymi odpowiedziami.</p><div class="chapgrid" style="margin-top:16px">${chs.map(c => `<a class="chap" href="#/cwicz/fiszki/${c.n}"><span class="dz">${c.n}</span><span><span class="name">${esc(c.title)}</span><span class="meta">${c.check.length} fiszek</span></span><span class="go">${icon('next')}</span></a>`).join('')}</div>` };
  const c = chs.find(x => x.n === +n); if (!c) return { title: 'Fiszki', html: '<div class="empty"><strong>Brak fiszek.</strong></div>' };
  return { title: 'Fiszki', crumb: `Rozdział ${c.n}`, html: '<div id="fl"></div>', after: el => {
    let i = 0; const root = el.querySelector('#fl');
    const draw = () => {
      const k = `${c.n}.${i}`; root.innerHTML = `<div class="flash"><div class="row" style="justify-content:space-between"><b class="num">Fiszka ${i + 1} z ${c.check.length}</b><span class="tag">${c.n}. ${esc(c.title.slice(0, 28))}</span></div><div class="plot face"><p class="q">${safe(c.check[i])}</p></div><div id="ans"></div><div class="row"><button class="btn primary" id="show">Pokaż odpowiedź</button></div></div>`;
      root.querySelector('#show').onclick = () => {
        root.querySelector('#ans').innerHTML = `<p class="a">${safe(c.answers[i] || 'Brak wzorca w publikacji.')}</p>`;
        root.querySelector('.row:last-child').innerHTML = `<button class="btn quiet" data-r="0">Jeszcze nie umiem</button><button class="btn primary" data-r="1">Umiem</button>`;
        root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { set(S => { S.flash[k] = +b.dataset.r; }); i++; i < c.check.length ? draw() : (root.innerHTML = `<div class="empty"><strong>Rozdział przerobiony.</strong>Umiesz: ${c.check.filter((_, j) => state().flash[`${c.n}.${j}`] === 1).length} z ${c.check.length}.<div style="margin-top:12px"><a class="btn" href="#/cwicz/fiszki">Inne rozdziały</a></div></div>`); });
      };
    };
    draw();
  } };
}

/* ───────── NARZĘDZIA ───────── */
const field = (id, label, val, unit = '', hint = '') => `<div class="field"><label for="${id}">${label}</label><div class="inp-wrap"><input class="inp" id="${id}" inputmode="decimal" value="${val}" autocomplete="off">${unit ? `<span class="unit">${unit}</span>` : ''}</div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const sw = (id, label, on = false) => `<label class="switch"><span>${label}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;
const line = (a, b, cls = '') => `<div class="sumline ${cls}"><span>${a}</span><b>${b}</b></div>`;
const TOOLS = {
  koszty: { name: 'Koszty zakupu', icon: 'tool', desc: 'Taksa, PCC, opłaty sądowe i prowizja przy zakupie.',
    form: () => `${field('cena', 'Cena nieruchomości', '600000', 'zł')}<div class="field"><label for="rynek">Rynek</label><select class="inp" id="rynek"><option value="wtorny">Wtórny (od osoby prywatnej)</option><option value="pierwotny">Pierwotny (deweloper, VAT)</option></select></div>${sw('pierw', 'Kupujący nabywa pierwsze mieszkanie lub dom (zwolnienie z PCC)')}${sw('kred', 'Kredyt hipoteczny (wpis hipoteki)', true)}${field('pr', 'Prowizja biura', '2', '%')}<div class="field"><label for="prk">Kto płaci prowizję</label><select class="inp" id="prk"><option value="sprzedajacy">Sprzedający</option><option value="kupujacy">Kupujący</option></select></div>`,
    calc: g => { const r = C.kosztyZakupu({ cena: g.n('cena'), rynek: g.v('rynek'), pierwsze: g.c('pierw'), kredyt: g.c('kred'), prowizjaPct: g.n('pr'), prowizjaPlaci: g.v('prk') }); return `${line('Maks. taksa notarialna (netto)', fmtPLN(r.taksa))}${line('Taksa + 23% VAT', fmtPLN(r.taksaBrutto))}${line('PCC 2%', fmtPLN(r.pcc))}${line('Opłaty sądowe (wpisy)', fmtPLN(r.kw))}${line('PCC od hipoteki (wg przykładu z kursu)', fmtPLN(r.pccHip))}${line('Prowizja biura (brutto)', fmtPLN(r.prow))}${line('Do zapłaty przez kupującego', fmtPLN(r.razem), 'total')}<p class="note" style="margin-top:12px">Taksa to <b>maksimum</b> – notariusz może pobrać mniej. Pominięto m.in. wypisy aktu i koszty kredytu. Przy rynku pierwotnym PCC zwykle nie występuje (zakup opodatkowany VAT). Stawki: kurs, rozdz. 17.</p>`; },
    pre: g => { } },
  prowizja: { name: 'Prowizja i VAT', icon: 'tool', desc: 'Prowizja netto, VAT 23% i kwota brutto.',
    form: () => `${field('cena', 'Cena transakcji', '500000', 'zł')}${field('pct', 'Stawka prowizji', '2', '%')}${sw('brutto', 'Podana stawka już zawiera VAT')}`,
    calc: g => { const r = C.prowizja({ cena: g.n('cena'), pct: g.n('pct'), netto: !g.c('brutto') }); return `${line('Netto', fmtPLN(r.netto))}${line('VAT 23%', fmtPLN(r.vat))}${line('Brutto', fmtPLN(r.brutto), 'total')}<p class="note" style="margin-top:12px">Przy zwolnieniu podmiotowym z VAT faktura nie zawiera VAT – kwota netto jest wtedy kwotą należną.</p>`; } },
  rata: { name: 'Rata kredytu', icon: 'tool', desc: 'Rata równa i malejąca, łączny koszt odsetek.',
    form: () => `${field('k', 'Kwota kredytu', '400000', 'zł')}${field('o', 'Oprocentowanie roczne', '7', '%', 'Wpisz aktualne oprocentowanie z oferty banku.')}${field('l', 'Okres', '25', 'lat')}<div class="field"><label for="typ">Rodzaj rat</label><select class="inp" id="typ"><option value="rowne">Równe</option><option value="malejace">Malejące</option></select></div>`,
    calc: g => { const r = C.rata({ kwota: g.n('k'), rocznePct: g.n('o'), lata: g.n('l'), typ: g.v('typ') }); return `${line('Pierwsza rata', fmtPLN(r.pierwsza), 'total')}${line('Ostatnia rata', fmtPLN(r.ostatnia))}${line('Liczba rat', r.n)}${line('Suma odsetek', fmtPLN(r.odsetki))}${line('Łącznie do spłaty', fmtPLN(r.razem))}<p class="note" style="margin-top:12px">Obliczenie orientacyjne: bez prowizji, ubezpieczeń i zmian oprocentowania. Wiążąca jest oferta banku.</p>`; } },
  najem: { name: 'Rentowność najmu', icon: 'tool', desc: 'Stopa zwrotu z najmu i czas zwrotu inwestycji.',
    form: () => `${field('c', 'Cena zakupu', '500000', 'zł')}${field('cz', 'Czynsz miesięcznie', '3000', 'zł')}${field('ko', 'Koszty miesięcznie (czynsz administracyjny, ubezpieczenie…)', '600', 'zł')}${field('pu', 'Miesięcy bez najemcy w roku', '1', 'mies.')}${field('pod', 'Ryczałt od przychodu z najmu', '8.5', '%', 'Stawki ryczałtu sprawdź w kursie (rozdz. 17.6) i w aktualnych przepisach.')}`,
    calc: g => { const r = C.rentownosc({ cena: g.n('c'), czynszMies: g.n('cz'), kosztyMies: g.n('ko'), pustostanyMies: g.n('pu'), podatekPct: g.n('pod') }); return `${line('Przychód roczny', fmtPLN(r.rocznyBrutto))}${line('Podatek (ryczałt)', fmtPLN(r.podatek))}${line('Zysk netto rocznie', fmtPLN(r.netto), 'total')}${line('Rentowność brutto', r.brutto + '%')}${line('Rentowność netto', r.nettoPct + '%')}${line('Zwrot inwestycji', r.lataZwrot ? r.lataZwrot + ' lat' : 'brak')}<p class="note" style="margin-top:12px">Model uproszczony: bez wzrostu cen, remontów i kosztów kredytu. Przy ryczałcie nie odlicza się kosztów, więc koszty wpływają tu tylko na zysk, nie na podatek.</p>`; } },
  pit: { name: 'PIT od sprzedaży', icon: 'tool', desc: 'Czy sprzedaż podlega 19% podatku (reguła 5 lat).',
    form: () => `${field('rn', 'Rok nabycia', '2023', '')}${field('rs', 'Rok sprzedaży', '2026', '')}${field('p', 'Przychód ze sprzedaży', '600000', 'zł')}${field('kn', 'Koszty nabycia (cena, PCC, taksa…)', '492000', 'zł')}${field('na', 'Udokumentowane nakłady', '0', 'zł')}${field('ks', 'Koszty sprzedaży (np. prowizja)', '0', 'zł')}`,
    calc: g => { const r = C.pitSprzedaz({ rokNabycia: g.n('rn'), rokSprzedazy: g.n('rs'), przychod: g.n('p'), kosztyNabycia: g.n('kn'), nakłady: g.n('na'), kosztySprzedazy: g.n('ks') }); return `${r.wolne ? '<div class="ok">Upłynęło 5 lat liczonych od końca roku nabycia – sprzedaż nie podlega podatkowi dochodowemu.</div>' : ''}${line('Dochód', fmtPLN(r.dochod))}${line('Podatek 19%', fmtPLN(r.podatek), 'total')}<p class="note" style="margin-top:12px">Pominięto ulgę mieszkaniową (wydatki na własne cele mieszkaniowe w ciągu 3 lat), nabycie w spadku i inne wyjątki – patrz rozdz. 17.5. To nie jest porada podatkowa.</p>`; } },
  m2: { name: 'Cena za m²', icon: 'tool', desc: 'Szybkie porównanie ofert.',
    form: () => `${field('c', 'Cena', '650000', 'zł')}${field('m', 'Powierzchnia', '52.4', 'm²')}`,
    calc: g => `${line('Cena za m²', fmtPLN(C.cenaM2({ cena: g.n('c'), m2: g.n('m') })), 'total')}` },
};
export function narzedzia() {
  return { title: 'Narzędzia', html: `<h1 class="pagetitle">Narzędzia</h1><p class="lead">Kalkulatory liczą na stawkach z kursu (stan IX 2026). Wyniki są orientacyjne – przed podaniem klientowi sprawdź aktualne przepisy.</p>
<div class="grid c3" style="margin-top:16px">${Object.entries(TOOLS).map(([k, t]) => `<a class="card toolcard" href="#/narzedzia/${k}"><span class="ic">${icon(t.icon)}</span><b>${t.name}</b><span>${t.desc}</span></a>`).join('')}<a class="card toolcard" href="#/narzedzia/listy"><span class="ic">${icon('check')}</span><b>Checklisty</b><span>Listy kontrolne z kursu: start biura, prezentacja, transakcja.</span></a><a class="card toolcard" href="#/narzedzia/wzory"><span class="ic">${icon('sheet')}</span><b>Wzory dokumentów</b><span>Umowy pośrednictwa, karta AML, klauzula RODO, protokoły – do wypełnienia, skopiowania i wydruku.</span></a><a class="card toolcard" href="#/narzedzia/start"><span class="ic">${icon('road')}</span><b>Start biura</b><span>Lista kontrolna otwarcia biura: OC, AML, rejestracja, podatki – z odnośnikami do przepisów.</span></a></div>` };
}
export async function narzedzie(id) {
  if (id === 'listy') return listy();
  const t = TOOLS[id]; if (!t) return { title: 'Narzędzia', html: '<div class="empty"><strong>Nie ma takiego narzędzia.</strong></div>' };
  return { title: t.name, crumb: 'Narzędzia', html: `<h1 class="pagetitle">${t.name}</h1><div class="calc"><form class="form plot" onsubmit="return false" aria-label="Dane">${t.form()}</form><section class="result card" aria-live="polite" id="res"></section></div>`,
    after: el => {
      const g = { n: i => num(el.querySelector('#' + i).value), v: i => el.querySelector('#' + i).value, c: i => el.querySelector('#' + i).checked };
      const run = () => { el.querySelector('#res').innerHTML = t.calc(g); };
      el.querySelector('form').addEventListener('input', run); run();
    } };
}
async function listy() {
  const d = await getJSON('checklisty');
  return { title: 'Checklisty', crumb: 'Narzędzia', html: `<h1 class="pagetitle">Checklisty</h1><p class="lead">${esc(d.intro)}</p>${d.lists.map((l, li) => { const done = l.items.filter((_, i) => state().checks[`c${li}.${i}`]).length; return `<section class="plot" style="margin-top:16px"><div class="row" style="justify-content:space-between"><h2 style="font-size:1.1rem">${esc(l.title)}</h2><span class="tag num" data-cnt="${li}">${done}/${l.items.length}</span></div>${l.items.map((it, i) => `<label class="check"><input type="checkbox" data-k="c${li}.${i}" ${state().checks[`c${li}.${i}`] ? 'checked' : ''}><span>${safe(it)}</span></label>`).join('')}</section>`; }).join('')}`,
    after: el => el.addEventListener('change', e => { const k = e.target.dataset?.k; if (!k) return; set(S => { if (e.target.checked) S.checks[k] = 1; else delete S.checks[k]; }); const li = k.slice(1).split('.')[0]; const l = d.lists[li]; el.querySelector(`[data-cnt="${li}"]`).textContent = `${l.items.filter((_, i) => state().checks[`c${li}.${i}`]).length}/${l.items.length}`; }) };
}

/* ───────── DROGA DO LUTEGO ───────── */
const PLAN = [
  { id: 'p1', t: 'Fundamenty zawodu', w: 'do połowy listopada 2026', ch: '1–4', tasks: ['Przeczytaj rozdziały 1–4 (zawód, etyka, start działalności)', 'Rozwiąż fiszki z rozdziałów 2 i 4', 'Zdecyduj wstępnie o formie działalności (JDG / spółka) i omów z księgowym'] },
  { id: 'p2', t: 'Prawo cywilne i księgi wieczyste', w: 'do końca grudnia 2026', ch: '5–11', tasks: ['Przeczytaj rozdziały 5–11', 'Rozwiąż test: dział B i C (prawo cywilne, stan prawny)', 'Przećwicz czytanie księgi wieczystej (EKW) na przykładowym numerze'] },
  { id: 'p3', t: 'Prawo publiczne, podatki, finanse', w: 'do połowy stycznia 2027', ch: '12–19', tasks: ['Przeczytaj rozdziały 12–19', 'Przelicz kilka transakcji w kalkulatorach', 'Rozwiąż test: dział D'] },
  { id: 'p4', t: 'Praktyka biura i zgodność', w: 'do końca stycznia 2027', ch: '20–29', tasks: ['Przeczytaj rozdziały 20–29, szczególnie AML i RODO', 'Przejdź checklistę 1: przed rozpoczęciem działalności', 'Przygotuj wzory umów, procedury AML i RODO (najlepiej z pomocą prawnika)', 'Wykup polisę OC pośrednika przed pierwszą czynnością'] },
  { id: 'p5', t: 'Pierwszy dzień biura', w: 'luty 2027', ch: '', tasks: ['Rejestracja działalności w CEIDG (PKD 68.31.Z – sprawdź w aktualnym wykazie PKD)', 'Zgłoszenia w ZUS i urzędzie skarbowym zgodnie z wybraną formą', 'Sprawdź w wydziale emerytalnym Policji, jak działalność gospodarcza wpływa na Twoje świadczenie', 'Pierwsza oferta, pierwsza umowa pośrednictwa, pierwszy klient'] },
];
export async function droga() {
  const book = await getJSON('book'); const chs = chapters(book);
  const chPct = r => { const [a, b] = r.split('–').map(Number); const sel = chs.filter(c => c.n >= a && c.n <= (b || a)); const p = sel.map(chProgress); const d = p.reduce((s, x) => s + x.done, 0), t = p.reduce((s, x) => s + x.tot, 0); return t ? Math.round(d / t * 100) : 0; };
  const days = Math.max(0, Math.ceil((FEB - new Date()) / 864e5));
  return { title: 'Droga do lutego', html: `<h1 class="pagetitle">Droga do lutego</h1><p class="lead">Do 1 lutego 2027 zostało <b>${days}</b> ${plural(days, 'dzień', 'dni', 'dni')}. Plan to propozycja podziału materiału – dostosuj do swojego tempa. Pozycje bez numeru rozdziału to zadania organizacyjne.</p>
<div class="timeline" style="margin-top:22px">${PLAN.map(p => `<section class="phase"><h3>${p.t}</h3><div class="when">${p.w}${p.ch ? ` · rozdziały ${p.ch} · przeczytane ${chPct(p.ch)}%` : ''}</div>${p.ch ? `<div class="bar" style="margin-bottom:8px"><i style="width:${chPct(p.ch)}%"></i></div>` : ''}<div class="plot solid" style="padding:4px 14px">${p.tasks.map((t, i) => `<label class="check"><input type="checkbox" data-k="${p.id}.${i}" ${state().plan[`${p.id}.${i}`] ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div></section>`).join('')}</div>
<p class="note" style="margin-top:20px;max-width:64ch">Terminy i kolejność to moja propozycja organizacji nauki, nie wymóg prawny. Wymogi formalne otwarcia biura (OC, umowy na piśmie, AML, RODO) opisuje kurs.</p>`,
    after: el => el.addEventListener('change', e => { const k = e.target.dataset?.k; if (!k) return; set(S => { if (e.target.checked) S.plan[k] = 1; else delete S.plan[k]; }); }) };
}

/* ───────── USTAWIENIA ───────── */
export function ustawienia() {
  const S = state();
  return { title: 'Ustawienia', html: `<h1 class="pagetitle">Ustawienia</h1>
<div class="stack" style="max-width:640px;margin-top:16px">
<section class="plot"><h2 style="font-size:1.05rem;margin-bottom:10px">Wygląd</h2>
<div class="field"><span class="lbl">Motyw</span><div class="seg" style="margin:0;padding-inline:0">${[['auto', 'Automatyczny'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, n]) => `<button type="button" data-th="${k}" aria-pressed="${S.theme === k}">${n}</button>`).join('')}</div></div>
<div class="field" style="margin-top:14px"><span class="lbl">Rozmiar tekstu</span><div class="seg" style="margin:0;padding-inline:0">${[[0.9, 'Mniejszy'], [1, 'Normalny'], [1.15, 'Większy'], [1.3, 'Duży']].map(([k, n]) => `<button type="button" data-fs="${k}" aria-pressed="${S.fontScale === k}">${n}</button>`).join('')}</div></div></section>
<section class="plot"><h2 style="font-size:1.05rem;margin-bottom:6px">Twoje dane</h2><p class="note">Postępy zapisują się tylko w tej przeglądarce. Przy zmianie telefonu skorzystaj z kopii zapasowej.</p><div class="row" style="margin-top:12px"><button class="btn small" id="exp">Zapisz kopię</button><label class="btn small quiet">Wczytaj kopię<input type="file" id="imp" accept="application/json" hidden></label><button class="btn small quiet" id="rst">Wyzeruj postępy</button></div></section>
<section class="plot"><h2 style="font-size:1.05rem;margin-bottom:6px">O aplikacji</h2><p class="note">Treść kursu: publikacja „Kurs Pośrednika w Obrocie Nieruchomościami", stan prawny wrzesień 2026. Aplikacja ma charakter edukacyjny i nie stanowi porady prawnej ani podatkowej. Przed zastosowaniem przepisu sprawdź jego aktualne brzmienie w ISAP (isap.sejm.gov.pl).</p></section></div>`,
    after: el => {
      el.addEventListener('click', e => {
        const t = e.target.closest('[data-th],[data-fs]'); if (t) { set(S => { if (t.dataset.th) S.theme = t.dataset.th; else S.fontScale = +t.dataset.fs; }); applyPrefs(); el.querySelectorAll('[data-th]').forEach(b => b.setAttribute('aria-pressed', b.dataset.th === state().theme)); el.querySelectorAll('[data-fs]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.fs === state().fontScale)); }
        if (e.target.id === 'exp') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })); a.download = `akademia-posrednika-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }
        if (e.target.id === 'rst' && confirm('Wyzerować wszystkie postępy, wyniki i zaznaczenia?')) { resetAll(); applyPrefs(); toast('Postępy wyzerowane.'); location.hash = '#/'; }
      });
      el.querySelector('#imp').addEventListener('change', async e => { try { importJSON(await e.target.files[0].text()); applyPrefs(); toast('Kopia wczytana.'); } catch (err) { toast(err.message); } });
    } };
}
