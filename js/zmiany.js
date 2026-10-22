import { esc, getJSON } from './util.js';

/* ───────── Zmiany w prawie ogłoszone po tekstach jednolitych ───────── */
const fmt = iso => { if (!iso) return 'termin nieustalony w ELI'; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }); };
const tabs = () => `<div class="seg" role="tablist">${[['ustawy', 'Ustawy'], ['zmiany', 'Zmiany'], ['przepisy', 'Z kursu'], ['akty', 'Akty prawne'], ['fakty', 'Fakty i stawki'], ['korekty', 'Korekty'], ['slownik', 'Słownik'], ['zrodla', 'Źródła']].map(([k, n]) => `<a href="#/baza/${k}" aria-current="${k === 'zmiany'}">${n}</a>`).join('')}</div>`;

function card(x, today) {
  const eff = x.eff ? new Date(x.eff + 'T00:00:00') : null;
  const st = !eff ? ['amber', 'termin nieustalony'] : eff <= today ? ['green', 'już obowiązuje'] : ['blue', 'wejdzie w życie'];
  return `<article class="zm"><header><span class="tag ${st[0]}">${st[1]}</span><b>${esc(fmt(x.eff))}</b></header>
<h3>${esc(x.title)}</h3><p class="pub num">${esc(x.disp)} · ogłoszona ${esc(fmt(x.ann))}</p>
<p class="zacts">Zmienia: ${x.acts.map(a => `<a href="#/baza/ustawy/${esc(a.id)}">${esc(a.short)}</a>`).join(', ')}</p>
${x.notes.length ? `<ul class="znotes">${x.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="note">Wpływu na pracę pośrednika nie oceniałem – zob. wykaz zmian przy ustawie i pełny tekst aktu.</p>'}
<details class="zeff"><summary>Wejście w życie wg ustawy zmieniającej</summary><p>${esc(x.effText || 'Brak odczytanego przepisu – zob. akt.')}</p></details>
<a class="rchip ext" href="https://api.sejm.gov.pl/eli/acts/${esc(x.id)}/text.pdf" target="_blank" rel="noopener">Tekst ustawy (PDF, ELI)</a></article>`;
}

export async function zmiany() {
  const d = await getJSON('zmiany'); const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = new Date('2026-01-01T00:00:00');
  const fut = d.items.filter(x => !x.eff || new Date(x.eff + 'T00:00:00') > today);
  const now = d.items.filter(x => x.eff && new Date(x.eff + 'T00:00:00') <= today && new Date(x.eff + 'T00:00:00') >= y).reverse();
  const old = d.items.filter(x => x.eff && new Date(x.eff + 'T00:00:00') < y).reverse();
  const html = `<h1 class="pagetitle">Baza wiedzy</h1>${tabs()}
<p class="lead">Co zmieniło się w ustawach z bazy po ich ostatnich tekstach jednolitych i co dopiero wejdzie w życie. Lista powstała automatycznie z rejestru ELI Sejmu (stan na ${esc(d.asOf)}); uwagi pod pozycjami dotyczą tylko tego, co sprawdziłem w tekście ustawy zmieniającej.</p>
<p class="note legend"><b>Ważne:</b> to wykaz ustaw zmieniających, nie tekst ujednolicony. Brzmienie przepisu „po zmianie” zobaczysz w fragmentach cytowanych przy danej ustawie. Zmiany wkomponowałem w tekst tylko w dwóch miejscach u.g.n. (art. 10 ust. 2 i art. 93 ust. 4).</p>
<div class="sectionhead"><h2>Wejdą w życie (${fut.length})</h2></div><div class="grid c2">${fut.map(x => card(x, today)).join('')}</div>
<div class="sectionhead"><h2>Obowiązują od 1 stycznia 2026 (${now.length})</h2></div><div class="grid c2">${now.map(x => card(x, today)).join('')}</div>
<details class="olds"><summary>Starsze zmiany po t.j. (${old.length})</summary><div class="grid c2" style="margin-top:12px">${old.map(x => card(x, today)).join('')}</div></details>`;
  return { title: 'Baza', html };
}
