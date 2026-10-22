import { esc, getJSON, toast } from './util.js';

/* ───────── Wzory dokumentów: wypełnianie, kopiowanie, wydruk ───────── */
const sup = s => String(s).replace(/\[(\d+)\]/g, (_, n) => [...n].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));
const chip = (r, shorts) => r[0] === 'x'
  ? `<a class="rchip ext" href="${esc(r[2])}" target="_blank" rel="noopener">${esc(r[1])}</a>`
  : `<a class="rchip" href="#/baza/ustawy/${esc(r[0])}/a/${encodeURIComponent(r[1])}">art. ${esc(sup(r[1]))} ${esc(shorts[r[0]] || r[0])}</a>`;

export async function wzory(id) {
  const d = await getJSON('wzory');
  if (!id) {
    return {
      title: 'Wzory', crumb: 'Narzędzia', html: `<h1 class="pagetitle">Wzory dokumentów</h1>
<p class="lead">Szkice dokumentów do dostosowania. Każdy ma podstawy prawne z odnośnikami do artykułów. To nie porada prawna – przed pierwszym użyciem daj wzór do przeglądu prawnikowi lub radcy.</p>
<div class="grid c2" style="margin-top:14px">${d.docs.map(x => `<a class="card act" href="#/narzedzia/wzory/${x.id}"><span class="t">${esc(x.title)}</span><span class="pub">${esc(x.use)}</span></a>`).join('')}</div>`
    };
  }
  const x = d.docs.find(z => z.id === id);
  if (!x) return { title: 'Wzory', html: '<div class="empty"><strong>Nie ma takiego wzoru.</strong><a href="#/narzedzia/wzory">Wróć do listy</a></div>' };
  const html = `<h1 class="pagetitle" style="font-size:1.45rem">${esc(x.title)}</h1><p class="lead">${esc(x.use)}</p>
<div class="plot solid wz-basis"><b>Podstawy prawne i uwagi</b><ul class="plist" style="margin-top:10px">${x.basis.map(b => `<li class="pi law"><p>${esc(b.t)}</p><div class="rchips">${b.r.map(r => chip(r, d.shorts)).join('')}</div></li>`).join('')}</ul></div>
<div class="wz"><form class="form plot" id="wzf" onsubmit="return false" aria-label="Pola dokumentu"><b>Uzupełnij pola</b>${x.fields.map(f => `<label class="fld"><span>${esc(f.l)}</span><input class="inp" data-k="${esc(f.k)}" autocomplete="off"></label>`).join('')}</form>
<section class="wzdoc card" aria-label="Podgląd dokumentu"><div class="wzbar"><button class="btn" id="cp" type="button">Kopiuj tekst</button><button class="btn quiet" id="pr" type="button">Drukuj / zapisz PDF</button><button class="btn quiet" id="dl" type="button">Pobierz .txt</button></div><div class="wzbody" id="wzb" tabindex="0"></div></section></div>
<p class="note legend">Fragmenty w nawiasach kwadratowych to miejsca do decyzji lub uzupełnienia – usuń je przed podpisem.</p>`;
  return {
    title: x.title.length > 24 ? 'Wzór' : x.title, crumb: 'Wzory', html, after: el => {
      const vals = {}; const out = el.querySelector('#wzb');
      const plain = () => x.body.replace(/\{(\w+)\}/g, (_, k) => vals[k] || '[…]');
      const draw = () => { out.innerHTML = esc(x.body).replace(/\{(\w+)\}/g, (_, k) => vals[k] ? `<mark class="f">${esc(vals[k])}</mark>` : '<mark class="e">[…]</mark>'); };
      draw();
      el.querySelector('#wzf').addEventListener('input', e => { const k = e.target.dataset.k; if (k) { vals[k] = e.target.value.trim(); draw(); } });
      el.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(plain()); toast('Skopiowano tekst'); } catch { toast('Nie udało się skopiować – zaznacz tekst ręcznie'); } };
      el.querySelector('#pr').onclick = () => window.print();
      el.querySelector('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([plain()], { type: 'text/plain;charset=utf-8' })); a.download = x.id + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    }
  };
}
