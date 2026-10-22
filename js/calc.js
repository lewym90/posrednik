// Czyste funkcje obliczeniowe (testowalne w Node). Stawki: stan wg kursu (IX 2026) – w UI oznaczone jako do weryfikacji.
export const VAT = 0.23;
export const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

// Maksymalna taksa notarialna (netto) – rozp. MS z 28.06.2004 (tabela z kursu, rozdz. 17.9)
export function taksaMax(v, { grupaI = false } = {}) {
  let t;
  if (v <= 3000) t = 100;
  else if (v <= 10000) t = 100 + 0.03 * (v - 3000);
  else if (v <= 30000) t = 310 + 0.02 * (v - 10000);
  else if (v <= 60000) t = 710 + 0.01 * (v - 30000);
  else if (v <= 1e6) t = 1010 + 0.004 * (v - 60000);
  else if (v <= 2e6) t = 4770 + 0.002 * (v - 1e6);
  else t = Math.min(6770 + 0.0025 * (v - 2e6), grupaI ? 7500 : 10000);
  return r2(t);
}

export function kosztyZakupu({ cena, rynek = 'wtorny', pierwsze = false, kredyt = false, prowizjaPct = 0, prowizjaPlaci = 'sprzedajacy', wpisy = 1 }) {
  const taksa = taksaMax(cena);
  const taksaBrutto = r2(taksa * (1 + VAT));
  const pcc = (rynek === 'wtorny' && !pierwsze) ? r2(cena * 0.02) : 0;
  const kw = 200 * wpisy + (kredyt ? 200 : 0);       // wpis własności 200 zł + wpis hipoteki 200 zł (kurs, 17.9)
  const pccHip = kredyt ? 19 : 0;                    // przykład z kursu 17.10 (PCC od ustanowienia hipoteki)
  const prow = r2(cena * prowizjaPct / 100 * (1 + VAT));
  const prowKup = prowizjaPlaci === 'kupujacy' ? prow : 0;
  const razem = r2(taksaBrutto + pcc + kw + pccHip + prowKup);
  return { taksa, taksaBrutto, pcc, kw, pccHip, prow, prowKup, razem };
}

export function prowizja({ cena, pct, netto = true }) {
  const n = netto ? cena * pct / 100 : cena * pct / 100 / (1 + VAT);
  return { netto: r2(n), vat: r2(n * VAT), brutto: r2(n * (1 + VAT)) };
}

// Rata annuitetowa / malejąca
export function rata({ kwota, rocznePct, lata, typ = 'rowne' }) {
  const n = Math.round(lata * 12), i = rocznePct / 100 / 12;
  if (n <= 0 || kwota <= 0) return { pierwsza: 0, ostatnia: 0, odsetki: 0, razem: 0, n };
  if (typ === 'rowne') {
    const R = i === 0 ? kwota / n : kwota * i / (1 - Math.pow(1 + i, -n));
    return { pierwsza: r2(R), ostatnia: r2(R), odsetki: r2(R * n - kwota), razem: r2(R * n), n };
  }
  const cz = kwota / n; let odset = 0, bal = kwota, first = 0, last = 0;
  for (let k = 1; k <= n; k++) { const o = bal * i; odset += o; const r = cz + o; if (k === 1) first = r; last = r; bal -= cz; }
  return { pierwsza: r2(first), ostatnia: r2(last), odsetki: r2(odset), razem: r2(kwota + odset), n };
}

export function rentownosc({ cena, czynszMies, kosztyMies = 0, pustostanyMies = 0, podatekPct = 8.5 }) {
  const rocznyBrutto = czynszMies * (12 - pustostanyMies);
  const rocznyKoszty = kosztyMies * 12;
  const przychod = rocznyBrutto;
  const podatek = r2(przychod * podatekPct / 100);          // ryczałt: od przychodu, bez kosztów
  const netto = r2(rocznyBrutto - rocznyKoszty - podatek);
  return { rocznyBrutto: r2(rocznyBrutto), brutto: cena ? r2(rocznyBrutto / cena * 100) : 0, podatek, netto, nettoPct: cena ? r2(netto / cena * 100) : 0, lataZwrot: netto > 0 ? r2(cena / netto) : null };
}

export function cenaM2({ cena, m2 }) { return m2 > 0 ? r2(cena / m2) : 0; }

// Podatek od sprzedaży (PIT-39): 19% od dochodu, o ile sprzedaż przed upływem 5 lat (liczonych od końca roku nabycia)
export function pitSprzedaz({ rokNabycia, rokSprzedazy, przychod, kosztyNabycia, nakłady = 0, kosztySprzedazy = 0 }) {
  const wolne = rokSprzedazy > rokNabycia + 5;   // 5 pełnych lat od końca roku nabycia: sprzedaż najwcześniej 1 stycznia roku +6
  const dochod = Math.max(0, przychod - kosztyNabycia - nakłady - kosztySprzedazy);
  return { wolne, dochod: r2(dochod), podatek: wolne ? 0 : r2(dochod * 0.19) };
}
