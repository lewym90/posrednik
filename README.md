# Akademia Pośrednika

Aplikacja PWA (kurs, baza wiedzy, quizy, kalkulatory i plan otwarcia biura) dla pośrednika w obrocie nieruchomościami.
Treść kursu: publikacja „Kurs Pośrednika w Obrocie Nieruchomościami", stan prawny wrzesień 2026.

Bez budowania i bez zależności: zwykłe pliki HTML, CSS i JavaScript. Działa offline po pierwszym otwarciu.

## Publikacja na GitHub Pages

1. Utwórz repozytorium i wgraj całą zawartość tego folderu do gałęzi `main` (plik `index.html` musi leżeć w katalogu głównym).
2. Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. Po minucie adres to `https://<użytkownik>.github.io/<repozytorium>/`.

## Instalacja na ekranie głównym

- **iPhone / iPad (Safari):** Udostępnij → Do ekranu początkowego.
- **Android (Chrome):** menu ⋮ → Zainstaluj aplikację.
- **Windows (Edge/Chrome):** ikona instalacji w pasku adresu.

## Aktualizacja treści

Po zmianie jakiegokolwiek pliku uruchom `python3 tools/mksw.py .` (odświeża listę plików offline) i zwiększ `VERSION` w `sw.template.js`, inaczej telefon będzie trzymał starą wersję z pamięci podręcznej.

## Uwaga

Aplikacja ma charakter edukacyjny i nie stanowi porady prawnej ani podatkowej. Aktualny tekst przepisów: https://isap.sejm.gov.pl
