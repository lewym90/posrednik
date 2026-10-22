import { esc, fold, icon, getJSON, toast } from './util.js';

/* ───────── Ustawy: pełne teksty jednolite z rejestru ELI Sejmu ───────── */
const MON = { stycznia: 0, lutego: 1, marca: 2, kwietnia: 3, maja: 4, czerwca: 5, lipca: 6, sierpnia: 7, września: 8, października: 9, listopada: 10, grudnia: 11 };
const SUPD = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const fmtD = d => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const isoD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const dates = t => [...t.matchAll(/(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+(\d{4})/g)].map(m => new Date(+m[3], MON[m[2]], +m[1]));
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const idx = () => getJSON('ustawy/_index');
const act = id => getJSON('ustawy/' + id);
const sup = s => s.replace(/\[(\d+)\]/g, (_, n) => [...n].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));
const normId = s => {
  s = String(s).trim().toLowerCase().replace(/^art\.?\s*/, '').replace(/\s+/g, '');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '[' + [...m].map(c => SUPD[c]).join('') + ']');
  s = s.replace(/\^(\d+)/g, '[$1]').replace(/\((\d+)\)$/, '[$1]');
  return s;
};

/* ── status przypisów: które brzmienie obowiązuje dziś ── */
function noteInfo(f, byN) {
  const t = f.t, d = today();
  const m = t.match(/obowiązuje do wejścia w życie zmiany, o której mowa w odnośniku (\d+)/i);
  if (m) {
    const k = byN[+m[1]]; const ds = k ? dates(k.t) : []; const eff = ds.length ? ds[ds.length - 1] : null;
    if (eff) return eff <= d ? { c: 'dead', s: `Nieobowiązujące od ${fmtD(eff)} – zastąpione brzmieniem z przypisu ${m[1]}` } : { c: 'old', s: `Obowiązuje do ${fmtD(new Date(eff - 864e5))}; od ${fmtD(eff)} zmiana (przypis ${m[1]})` };
    return { c: 'old', s: `Brzmienie czasowe – zob. przypis ${m[1]}` };
  }
  if (/z dniem określonym w komunikacie/i.test(t)) return { c: 'soon', s: 'Wejdzie w życie z dniem określonym w komunikacie' };
  const w = [...t.matchAll(/wejdzie w życie z dniem (\d{1,2}\s+\S+\s+\d{4})/gi)];
  if (w.length) {
    const ds = dates(w[w.length - 1][1]); const eff = ds[0];
    if (eff) return eff <= d ? { c: 'now', s: `Obowiązuje od ${fmtD(eff)} (w t.j. oznaczone jako przyszłe)` } : { c: 'soon', s: `Wejdzie w życie ${fmtD(eff)}` };
  }
  return null;
}

function artHTML(a, meta) {
  const byN = Object.fromEntries((a.f || []).map(f => [f.n, f]));
  const info = Object.fromEntries((a.f || []).map(f => [f.n, noteInfo(f, byN)]));
  const blocks = a.b.map(b => {
    const ns = [...b.t.matchAll(/⟦(\d+)⟧/g)].map(m => +m[1]);
    const st = ns.map(n => info[n]).filter(Boolean);
    const body = esc(b.t).replace(/⟦(\d+)⟧/g, (_, n) => `<sup class="fnm" data-fn="${n}" tabindex="0" role="button" aria-label="Przypis ${n}">${n})</sup>`);
    const pill = st.map(s => `<span class="vpill ${s.c}">${esc(s.s)}</span>`).join('');
    const dead = st.some(s => s.c === 'dead');
    return `<p class="lb k-${b.k}${dead ? ' dead' : ''}">${body}${pill ? `<span class="vrow">${pill}</span>` : ''}</p>`;
  }).join('');
  const notes = (a.f || []).length ? `<ol class="fns" aria-label="Przypisy redakcyjne">${a.f.map(f => `<li id="fn-${esc(a.id)}-${f.n}" value="${f.n}"><span class="fnn">${f.n})</span> ${esc(f.t)}</li>`).join('')}</ol>` : '';
  const ch = (a.m || []).map(m => {
    const eff = isoD(m.eff), now = eff <= today();
    return `<aside class="chg ${now ? 'now' : 'soon'}"><div class="row"><span class="tag ${now ? 'green' : 'amber'}">${now ? 'Zmiana już obowiązuje' : 'Zmiana wejdzie w życie'} · ${fmtD(eff)}</span></div><p>${esc(m.what)}</p>${m.text ? `<blockquote>${esc(m.text)}</blockquote>` : ''}<span class="note">${esc(m.src)} · stan na 22 października 2026 r.</span></aside>`;
  }).join('');
  return `<article class="art" id="a-${esc(a.id)}"><header><a class="anum" href="#/baza/ustawy/${meta.id}/a/${encodeURIComponent(a.id)}" aria-label="Art. ${esc(a.n)} – link do artykułu"><small>art.</small>${esc(a.n)}</a></header><div class="abody">${a.warn ? `<p class="note warnbox">${esc(a.warn)}</p>` : ''}${blocks}${ch}${notes}</div></article>`;
}

/* ── lista ustaw ── */
export async function ustawyList() {
  const ix = await idx(); const groups = [...new Set(ix.map(x => x.group))];
  const opts = ix.map(x => `<option value="${x.id}">${esc(x.short)} – ${esc(x.title.replace(/^Ustawa z dnia \d+ \S+ \d+ r\.\s*[–-]?\s*/, '').slice(0, 54))}</option>`).join('');
  const html = `<h1 class="pagetitle">Baza wiedzy</h1>${tabs()}
<p class="lead">Pełne teksty ${ix.length} ustaw w brzmieniu z ogłoszonych tekstów jednolitych. Treść pobrano programowo z rejestru ELI Sejmu (bez przepisywania), razem z przypisami redakcyjnymi – to one mówią, które brzmienie obowiązuje od kiedy.</p>
<div class="plot jump" style="margin:14px 0"><b>Przejdź do artykułu</b><form id="jf" class="row" style="gap:8px;margin-top:8px"><select class="inp" id="jact" aria-label="Ustawa">${opts}</select><input class="inp" id="jart" inputmode="text" placeholder="np. 158 albo 385¹" aria-label="Numer artykułu" autocomplete="off" style="max-width:150px"><button class="btn" type="submit">Otwórz</button></form></div>
<div class="plot" style="margin:14px 0"><b>Szukaj w treści wszystkich ustaw</b><div class="searchbar" style="margin-top:8px">${icon('search')}<input class="inp" id="gq" type="search" placeholder="np. zadatek, odstępne, rękojmia, pierwokup" autocomplete="off" aria-label="Szukaj w treści ustaw"></div><p class="note" id="gstat" style="margin-top:6px">Pierwsze wyszukiwanie pobiera wszystkie teksty (kilka MB) i zapisuje je do pracy bez internetu.</p><div id="gres" style="margin-top:6px"></div></div>
<div id="glist">${groups.map(g => `<div class="sectionhead"><h2>${esc(g)}</h2></div><div class="grid c2">${ix.filter(x => x.group === g).map(x => `<a class="card act" href="#/baza/ustawy/${x.id}"><span class="t">${esc(x.title)}</span><span class="pub num">${esc(x.short)} · ${esc(x.tj)} · ${x.arts} art.</span>${x.amend ? `<span class="tag amber">${x.amend} zm. po t.j. – zob. wykaz</span>` : '<span class="tag green">brak późniejszych zmian w ELI</span>'}</a>`).join('')}</div>`).join('')}</div>`;
  return {
    title: 'Baza', html, after: el => {
      el.querySelector('#jf').addEventListener('submit', e => { e.preventDefault(); const v = normId(el.querySelector('#jart').value); if (!v) return; location.hash = `#/baza/ustawy/${el.querySelector('#jact').value}/a/${encodeURIComponent(v)}`; });
      const q = el.querySelector('#gq'), out = el.querySelector('#gres'), st = el.querySelector('#gstat'); let all = null, busy = false;
      const load = async () => { if (all) return all; if (busy) return null; busy = true; all = []; let n = 0; await Promise.all(ix.map(async x => { const d = await act(x.id); n++; st.textContent = `Pobieranie tekstów: ${n} z ${ix.length}…`; all.push(d); })); st.textContent = 'Gotowe – teksty zapisane do pracy bez internetu.'; return all; };
      let tmr; q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(async () => {
        const terms = fold(q.value).split(/\s+/).filter(t => t.length > 1); if (!terms.length) { out.innerHTML = ''; return; }
        const d = await load(); if (!d) return; const hits = [];
        for (const a of d) { a._f ??= a.arts.map(x => fold(x.b.map(b => b.t).join(' '))); a.arts.forEach((x, i) => { const f = a._f[i]; if (terms.every(t => f.includes(t))) hits.push({ a, x, f }); }); }
        hits.sort((p, r) => p.f.length - r.f.length);
        const snip = (h) => { const t = h.x.b.map(b => b.t).join(' ').replace(/⟦\d+⟧/g, ''); const i = Math.max(0, fold(t).indexOf(terms[0]) - 60); return (i ? '…' : '') + esc(t.slice(i, i + 190)).replace(new RegExp('(' + terms.map(z => z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>'); };
        out.innerHTML = hits.length ? hits.slice(0, 40).map(h => `<a class="hit" href="#/baza/ustawy/${h.a.id}/a/${encodeURIComponent(h.x.id)}"><div class="k">${esc(h.a.short)}</div><div class="h">Art. ${esc(h.x.n)}</div><div class="s">${snip(h)}</div></a>`).join('') + (hits.length > 40 ? `<p class="note" style="padding:8px 10px">Pokazano 40 z ${hits.length}. Zawęź frazę.</p>` : '') : '<div class="empty"><strong>Brak wyników.</strong>Spróbuj innego słowa (szukanie ignoruje polskie znaki).</div>';
      }, 250); });
    }
  };
}
const tabs = () => `<div class="seg" role="tablist">${[['ustawy', 'Ustawy'], ['zmiany', 'Zmiany'], ['przepisy', 'Z kursu'], ['akty', 'Akty prawne'], ['fakty', 'Fakty i stawki'], ['korekty', 'Korekty'], ['slownik', 'Słownik'], ['zrodla', 'Źródła']].map(([k, n]) => `<a href="#/baza/${k}" aria-current="${k === 'ustawy'}">${n}</a>`).join('')}</div>`;

/* ── widok ustawy ── */
export async function ustawa(id, mode, arg) {
  const ix = await idx(); const meta0 = ix.find(x => x.id === id);
  if (!meta0) return { title: 'Baza', html: '<div class="empty"><strong>Nie ma takiej ustawy w bazie.</strong><a href="#/baza/ustawy">Wróć do listy</a></div>' };
  const d = await act(id); const D = d;
  const head = (i) => i < 0 ? 'Przepisy wstępne' : D.heads[i].t;
  const range = i => { const r = D.arts.filter(a => a.h === i); return r.length ? (r.length === 1 ? `art. ${r[0].n}` : `art. ${r[0].n}–${r[r.length - 1].n}`) : ''; };
  const meta = `<div class="plot actmeta"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag blue">${esc(D.short)}</span><span class="tag green">${esc(D.tj)}</span><span class="tag">stan prawny t.j.: ${fmtD(isoD(D.legal))}</span></div><p class="note" style="margin-top:8px">Tekst jednolity pobrany z rejestru ELI Sejmu ${esc(D.checked)} bez zmian merytorycznych. <a href="${esc(D.pdf)}" target="_blank" rel="noopener">PDF (ELI)</a> · <a href="${esc(D.isap)}" target="_blank" rel="noopener">ISAP</a></p>${amendHTML(D)}</div>`;
  const back = `<p class="crumbline"><a href="#/baza/ustawy">Ustawy</a> › <a href="#/baza/ustawy/${id}">${esc(D.short)}</a></p>`;
  if (!mode) {
    const toc = D.heads.map((h, i) => ({ h, i, r: range(i) }));
    const pre = range(-1) ? `<li class="l0"><a href="#/baza/ustawy/${id}/h/-1"><span>Przepisy wstępne</span><small>${range(-1)}</small></a></li>` : '';
    return {
      title: D.short, crumb: 'Ustawy', html: `<h1 class="pagetitle" style="font-size:1.35rem">${esc(D.title)}</h1>${meta}
<div class="plot" style="margin:14px 0"><div class="searchbar">${icon('search')}<input class="inp" id="aq" type="search" placeholder="Szukaj w tej ustawie albo wpisz numer artykułu" autocomplete="off" aria-label="Szukaj w ustawie"></div><div id="ares" style="margin-top:6px"></div></div>
<nav aria-label="Spis treści"><ul class="toc">${pre}${toc.map(({ h, i, r }) => `<li class="l${h.lvl}"><a href="#/baza/ustawy/${id}/h/${i}"><span>${esc(h.t)}</span><small>${r}</small></a></li>`).join('')}</ul></nav>`,
      after: el => {
        const q = el.querySelector('#aq'), out = el.querySelector('#ares'); D._f ??= D.arts.map(x => fold(x.b.map(b => b.t).join(' ')));
        q.addEventListener('input', () => {
          const raw = q.value.trim(); if (!raw) { out.innerHTML = ''; return; }
          const nid = normId(raw); const byId = D.arts.find(a => a.id === nid);
          const terms = fold(raw).split(/\s+/).filter(t => t.length > 1);
          const hits = terms.length ? D.arts.map((x, i) => ({ x, i })).filter(({ i }) => terms.every(t => D._f[i].includes(t))) : [];
          const snip = x => { const t = x.b.map(b => b.t).join(' ').replace(/⟦\d+⟧/g, ''); const j = Math.max(0, fold(t).indexOf(terms[0]) - 60); return (j ? '…' : '') + esc(t.slice(j, j + 190)).replace(new RegExp('(' + terms.map(z => z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>'); };
          out.innerHTML = (byId ? `<a class="hit" href="#/baza/ustawy/${id}/a/${encodeURIComponent(byId.id)}"><div class="k">Numer artykułu</div><div class="h">Art. ${esc(byId.n)}</div></a>` : '') + (hits.length ? hits.slice(0, 40).map(({ x }) => `<a class="hit" href="#/baza/ustawy/${id}/a/${encodeURIComponent(x.id)}"><div class="h">Art. ${esc(x.n)}</div><div class="s">${snip(x)}</div></a>`).join('') + (hits.length > 40 ? `<p class="note" style="padding:8px 10px">Pokazano 40 z ${hits.length}.</p>` : '') : (byId ? '' : '<div class="empty"><strong>Brak wyników.</strong>Spróbuj innego słowa albo numeru.</div>'));
        });
      }
    };
  }
  let hi, focus = null;
  if (mode === 'a') { const a = D.arts.find(x => x.id === normId(arg || '')) || D.arts.find(x => x.id === arg); if (!a) return { title: D.short, crumb: 'Ustawy', html: `${back}<div class="empty"><strong>Nie ma art. ${esc(arg)} w tej ustawie.</strong>Sprawdź numer (np. 385¹ wpisz jako 385^1).</div>` }; hi = a.h; focus = a.id; }
  else hi = parseInt(arg, 10);
  const arts = D.arts.filter(a => a.h === hi);
  const pathTxt = hi < 0 ? 'Przepisy wstępne' : D.heads[hi].path.map(esc).join(' › ');
  const near = (delta) => { let j = hi + delta; while (j >= -1 && j < D.heads.length) { if (D.arts.some(a => a.h === j)) return j; j += delta; } return null; };
  const pv = near(-1), nx = near(1);
  const sub = hi >= 0 && !arts.length ? D.heads.map((h, i) => ({ h, i })).filter(({ h, i }) => i > hi && h.lvl > D.heads[hi].lvl && (() => { for (let k = hi + 1; k < i; k++) if (D.heads[k].lvl <= D.heads[hi].lvl) return false; return true; })()) : [];
  const nav = `<div class="pager">${pv !== null ? `<a class="btn quiet" href="#/baza/ustawy/${id}/h/${pv}">‹ ${esc(head(pv).slice(0, 38))}</a>` : '<span></span>'}${nx !== null ? `<a class="btn quiet" href="#/baza/ustawy/${id}/h/${nx}">${esc(head(nx).slice(0, 38))} ›</a>` : '<span></span>'}</div>`;
  return {
    title: D.short, crumb: 'Ustawy', html: `${back}<h1 class="pagetitle" style="font-size:1.15rem;line-height:1.35">${pathTxt}</h1>${arts.length ? arts.map(a => artHTML(a, D)).join('') : `<div class="empty"><strong>Ten dział nie ma własnych artykułów.</strong>Wybierz podrozdział:</div><ul class="toc">${sub.map(({ h, i }) => `<li class="l${h.lvl}"><a href="#/baza/ustawy/${id}/h/${i}"><span>${esc(h.t)}</span><small>${range(i)}</small></a></li>`).join('')}</ul>`}${nav}
<p class="note" style="margin-top:16px">Przypisy redakcyjne (z tekstu jednolitego) pokazują zmiany i brzmienia czasowe. Zielone/pomarańczowe znaczniki wyliczam z dat w przypisach względem dzisiejszej daty – o wiążącym brzmieniu rozstrzyga Dziennik Ustaw.</p>`,
    after: el => {
      el.addEventListener('click', e => { const s = e.target.closest('.fnm'); if (!s) return; const art = s.closest('.art'); const li = art.querySelector(`li[value="${s.dataset.fn}"]`); if (li) { li.scrollIntoView({ block: 'center' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1400); } });
      if (focus) { const t = el.querySelector(`#a-${CSS.escape(focus)}`); if (t) { t.classList.add('focus'); requestAnimationFrame(() => t.scrollIntoView({ block: 'start' })); } }
    }
  };
}
function amendHTML(D) {
  const am = D.amend || []; const d = today();
  if (!am.length) return '<p class="note" style="margin-top:6px">W rejestrze ELI nie ma aktów zmieniających ogłoszonych po tym tekście jednolitym (sprawdzono 22.10.2026).</p>';
  return `<div class="amend"><b>Zmiany ogłoszone po tym tekście jednolitym (${am.length})</b><p class="note" style="margin:4px 0 0">Poniższe akty zmieniają ustawę po dacie tekstu jednolitego. Nie wkomponowałem ich w tekst – przytaczam dosłownie fragmenty aktów zmieniających, żeby widać było, co i od kiedy się zmienia.</p><ul>${am.map(a => { const e = a.eff ? isoD(a.eff) : null; const done = D.applied && D.applied.includes(a.id); return `<li><span class="tag ${e && e <= d ? 'red' : 'blue'}">${e ? (e <= d ? 'już obowiązuje od ' : 'wejdzie w życie ') + fmtD(e) : 'termin: zob. akt'}</span>${done ? ' <span class="tag green">uwzględnione też przy artykułach</span>' : ''}<br><a href="https://api.sejm.gov.pl/eli/acts/${a.id}/text.pdf" target="_blank" rel="noopener">${esc(a.disp)}</a> – <span class="note">${esc((a.title || '').slice(0, 200))}</span>${a.ex && a.ex.length ? `<details><summary>Zmiany w tej ustawie (dosłownie z aktu zmieniającego, ${a.ex.length} art.)</summary>${a.ex.map(x => `<div class="exc"><b>${esc(x.art)}</b> ${esc(x.text)}</div>`).join('')}${a.effText ? `<div class="exc eff"><b>Wejście w życie:</b> ${esc(a.effText)}</div>` : ''}</details>` : `<details><summary>Brak wyodrębnionego fragmentu – otwórz PDF aktu</summary>${a.effText ? `<div class="exc eff"><b>Wejście w życie:</b> ${esc(a.effText)}</div>` : ''}</details>`}</li>`; }).join('')}</ul></div>`;
}
