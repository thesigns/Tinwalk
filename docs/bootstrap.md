# Tinwalk — opis aplikacji

## Czym jest Tinwalk

Tinwalk to aplikacja gamifikująca spacery, w klimacie survivalowo-zbierackim. Działa w przeglądarce, a w przyszłości także jako instalowalna PWA. Użytkownik wychodzi z domu, przeszukuje okolicę, przynosi zdobycze do schronu i w ten sposób go rozwija.

## Zasady projektu

- Cała aplikacja jest po angielsku: teksty w interfejsie, kod, nazwy, komentarze.
- Wyjątek: dokumentacja w plikach `.md` w folderze `docs` jest po polsku.
- Technologia: HTML, CSS i czysty JavaScript, bez frameworków i bez kroku budowania. Mapa rysowana na Canvas.
- Aplikacja korzysta z lokalizacji przeglądarki (Geolocation API), więc musi działać przez HTTPS (np. GitHub Pages; lokalnie `localhost`).
- Cały stan aplikacji jest zapisywany lokalnie w przeglądarce. Nie ma serwera.
- Aplikacja ma działać mobile-first w trybie portrait.
- Aplikacja nie chroni przed oszukiwaniem (fałszywy GPS, jazda samochodem, edycja eksportu, `?debug`). To świadoma decyzja: aplikacja jest jednoosobowa i lokalna, więc oszukiwanie szkodzi tylko samemu oszukującemu.

---

## Zakres prototypu

Wszystko w tej sekcji ma zostać zaimplementowane teraz. Rzeczy spoza tej sekcji nie implementujemy.

### Lokalizacja

- Gdy aplikacja jest otwarta, śledzi pozycję użytkownika na bieżąco.
- Każdy pomiar ma dokładność (`accuracy`). Pomiary o dokładności gorszej niż 50 m są ignorowane, a aplikacja pokazuje komunikat w stylu „Waiting for a better GPS signal…”.
- Akcje zależne od położenia (zakładanie schronu, przeszukiwanie, rozładunek) są dostępne tylko przy dobrym sygnale.
- Wszystkie odległości są liczone między punktami w metrach (wzór haversine).
- Aplikacja używa tylko świeżych pomiarów: `maximumAge: 0`, a pomiary starsze niż 30 s (według `timestamp`) są ignorowane. Ma to znaczenie po wybudzeniu telefonu, gdy przeglądarka może podać starą pozycję z pamięci.
- Przeglądarka przestaje śledzić pozycję, gdy ekran jest zablokowany. Aplikacji to nie przeszkadza: użytkownik otwiera aplikację tam, gdzie chce coś zrobić.

#### Brak dostępu do lokalizacji

- Jeśli użytkownik odmówi zgody na lokalizację, aplikacja pokazuje ekran z wyjaśnieniem, że bez lokalizacji nie da się z niej korzystać, i krótką instrukcją, jak włączyć zgodę w ustawieniach przeglądarki, oraz przycisk **Try again**.
- Jeśli lokalizacja jest niedostępna z innego powodu (wyłączony GPS, błąd, przekroczony czas), pasek stanu pokazuje „No GPS signal”, a akcje zależne od położenia są nieaktywne.
- W trybie debug aplikacja działa bez GPS.

### Schron (Shelter)

- Na początku użytkownik nie ma schronu i widzi tylko przycisk **Create a Shelter**.
- Po kliknięciu aplikacja ustala środek schronu i prosi o nazwę schronu.
- Schron zwykle zakłada się w domu, gdzie GPS jest najsłabszy. Dlatego środek schronu nie jest pojedynczym pomiarem: aplikacja zbiera pomiary przez ok. 10 s (z pominięciem gorszych niż 50 m) i liczy ich średnią ważoną dokładnością. W tym czasie pokazuje komunikat „Locating your shelter…” i aktualną dokładność.
- Nazwę wpisuje się we własnym oknie aplikacji (nie przez `prompt()`). Maksymalnie 24 znaki. Pusta nazwa oznacza nazwę domyślną „Shelter”.
- Schron to okrąg o promieniu 100 m. Użytkownik jest w schronie, gdy jego pozycja znajduje się wewnątrz tego okręgu.
- Żeby stan nie przeskakiwał przy granicy z powodu drgań GPS, obowiązuje histereza: użytkownik wchodzi do schronu, gdy jest najwyżej 100 m od środka, a wychodzi z niego dopiero, gdy jest dalej niż 110 m.
- W prototypie użytkownik ma dokładnie jeden schron. Nie można go przenieść ani założyć kolejnego.
- Schron ma magazyn, w którym przechowywane są zasoby i ocaleni.

### Pustkowie (Wasteland)

- Wszystko poza schronami to pustkowie.
- Po wyjściu z obszaru schronu użytkownik jest na pustkowiu.

### Przeszukiwanie (Search area)

- Przycisk **Search area** jest dostępny, gdy użytkownik jest na pustkowiu i jego pozycja jest oddalona o co najmniej 200 m od:
  - środka każdego schronu,
  - środka każdego aktywnego przeszukanego obszaru.
- Gdy warunek nie jest spełniony, przycisk jest nieaktywny, a aplikacja pokazuje krótką informację zależną od przyczyny:
  - za blisko schronu (od 100 do 200 m od środka): „Too close to your shelter”,
  - za blisko aktywnego przeszukanego obszaru: „This area has already been searched”,
  - za słaby sygnał: „Waiting for a better GPS signal…”.
- Przeszukanie tworzy przeszukany obszar: okrąg o promieniu 100 m ze środkiem w pozycji użytkownika.
- Przeszukany obszar wygasa po 12 godzinach od przeszukania i znika z mapy.

### Zdobycze

Każde przeszukanie daje losowo 1–3 jednostki jednego zasobu. Zasób jest losowany z wagami:

| Zasób | Waga | Zastosowanie (docelowo)         |
|-------|------|---------------------------------|
| Junk  | 40   | rozbudowa schronu               |
| Food  | 25   | utrzymanie ocalałych w schronie |
| Ammo  | 15   | obrona i walka                  |
| Meds  | 10   | leczenie ocalałych              |
| Tech  | 10   | zaawansowane konstrukcje        |

- Komunikat po przeszukaniu, np. „You've found 3 Junk”.
- **W prototypie zasoby są tylko zbierane i liczone.** Nie ma zużycia jedzenia, walki, leczenia ani budowania.

### Plecak

- Plecak mieści łącznie 30 jednostek wszystkich zasobów (np. 15 Food i 15 Ammo).
- Gdy znalezisko nie mieści się w całości, użytkownik zabiera tyle, ile się zmieści, a reszta przepada. Komunikat, np. „You've found 3 Junk, but could only carry 1”.
- Z pełnym plecakiem nadal można przeszukiwać (np. w nadziei na ocalałego).
- Dotknięcie plecaka na pasku stanu otwiera jego zawartość: ile jednostek każdego zasobu niesie użytkownik i ile miejsca zostało.
- Z plecaka można wyrzucać zasoby, np. żeby zrobić miejsce na inne. Użytkownik zaznacza przyciskami −/+, ile jednostek którego zasobu wyrzucić (przytrzymanie przycisku zmienia liczbę dalej), i zatwierdza przyciskiem **Drop**. Zamknięcie okna bez zatwierdzenia niczego nie wyrzuca.
- Wyrzucone zasoby przepadają. Wyrzucać można wszędzie, także w schronie.

### Ocaleni (Survivors)

- Każde przeszukanie ma 5% szansy na znalezienie ocalałego, osobno od losowania zasobów.
- Ocalały może się pojawić tylko wtedy, gdy z użytkownikiem nie idzie już żaden ocalały. Użytkownik eskortuje najwyżej jednego ocalałego naraz.
- Po znalezieniu użytkownik wybiera: **Take with you** albo **Leave**. Pozostawiony ocalały przepada.
- Ocalały idący z użytkownikiem zwiększa pojemność plecaka o 30 jednostek (łącznie 60).
- Ocalały ma losowe imię.
- W prototypie ocaleni w schronie tylko się liczą i nic nie robią.

### Rozładunek (Unload)

- Gdy użytkownik jest w schronie, dostępny jest przycisk **Unload**.
- Rozładunek przenosi całą zawartość plecaka do magazynu schronu, a towarzyszącego ocalałego do schronu.
- Po rozładunku pojemność plecaka wraca do 30.
- W schronie nie można przeszukiwać.

### Mapa

- Aplikacja nie pokazuje prawdziwej mapy. W tle rysowana jest fikcyjna, proceduralnie generowana mapa terenu ze schematycznymi ikonami: wzgórza, drzewa, ruiny budynków, pustynia z kaktusami, puste równiny.
- Teren jest generowany deterministycznie z szerokości i długości geograficznej (np. szum simplex), więc to samo miejsce na Ziemi zawsze wygląda tak samo.
- Szum jest próbkowany we współrzędnych metrycznych (Web Mercator), a nie bezpośrednio w stopniach. Stopień długości geograficznej jest krótszy niż stopień szerokości (w Polsce ok. 65–70 km wobec 111 km), więc próbkowanie w stopniach rozciągałoby teren w poziomie.
- Teren jest renderowany w kafelkach na niewidocznych płótnach (offscreen canvas) i trzymany w pamięci podręcznej, żeby nie rysować wszystkich ikon w każdej klatce.
- Regiony terenu mają skalę od kilkuset metrów do około kilometra, tak żeby typowy spacer przechodził przez kilka różnych terenów.
- Mapa jest zawsze skierowana na północ.
- Na mapie widoczne są:
  - schron jako okrąg z nazwą,
  - aktywne przeszukane obszary jako okręgi,
  - pozycja użytkownika jako czerwona kropka (z okręgiem dokładności GPS).
- Domyślny widok obejmuje około 1–2 km wokół użytkownika i jest wycentrowany na użytkowniku.
- Mapę można przybliżać i oddalać (gest szczypania oraz przyciski +/−) w zakresie od ok. 500 m do ok. 5 km szerokości widoku. W prototypie nie można jej przesuwać: zawsze jest wycentrowana na użytkowniku.
- W prototypie teren nie wpływa na zdobycze. Jest tylko tłem.

### Interfejs

- Główny ekran to mapa.
- Pasek stanu pokazuje: zawartość plecaka (np. „Backpack 12/30”), czy idzie z nami ocalały, oraz jakość sygnału GPS. Dotknięcie plecaka otwiera panel plecaka.
- Przyciski zależą od kontekstu: **Create a Shelter**, **Search area**, **Unload**.
- Panel schronu pokazuje nazwę schronu, stan magazynu i liczbę ocalałych.

#### Pierwsze uruchomienie

- Przy pierwszym uruchomieniu aplikacja pokazuje krótki ekran powitalny: o co w niej chodzi i że potrzebuje lokalizacji.
- Prośba o zgodę na lokalizację pojawia się dopiero po kliknięciu przycisku na tym ekranie (np. **Start**), a nie od razu po załadowaniu strony.

### Zapis stanu

- Stan aplikacji jest zapisywany w `localStorage` jako JSON po każdej zmianie.
- Aplikacja pozwala wyeksportować stan do pliku JSON i zaimportować go z powrotem (ochrona przed utratą danych).
- Zapisany stan ma pole `version`, żeby w przyszłości dało się migrować starsze zapisy. Import odrzuca plik o nieznanej wersji lub nieprawidłowej strukturze i pokazuje komunikat.
- Przy starcie aplikacja wywołuje `navigator.storage.persist()`, żeby zmniejszyć ryzyko, że przeglądarka sama usunie dane (np. Safari po kilku dniach nieużywania strony).

### Tryb deweloperski

- Tryb debug, włączany np. parametrem w adresie (`?debug`), pozwala ustawić pozycję użytkownika ręcznie, klikając na mapie, zamiast korzystać z GPS.
- Tryb debug pozwala też przyspieszyć czas, żeby sprawdzić wygasanie przeszukanych obszarów.
- Żeby przyspieszanie działało, cały kod pobiera aktualny czas z jednej wspólnej funkcji zegara, a nie bezpośrednio z `Date.now()`.
- Dzięki temu aplikację można testować przy biurku.

---

## Na przyszłość

Tych rzeczy nie implementujemy w prototypie.

- Wiele schronów, przenoszenie zasobów między nimi.
- Rozbudowa schronu z Junk i Tech, rozwój w stylu miasta z Cywilizacji.
- Zużycie jedzenia przez ocalałych w schronie.
- Walka z użyciem Ammo.
- Leczenie ocalałych za pomocą Meds.
- Zaawansowane konstrukcje z Tech.
- Praca ocalałych w schronie.
- Wpływ terenu na zdobycze.
- Wybór, co zrobić ze znaleziskiem, które nie mieści się w plecaku (np. wyrzucenie czegoś na miejscu zamiast utraty nadmiaru).
- Unikalne przedmioty, które zajmują miejsce w plecaku.
- Pełna aplikacja PWA (instalacja na ekranie głównym, działanie offline).
- Utrzymywanie włączonego ekranu podczas spaceru (Wake Lock API).
- Podstawowa ochrona przed oszukiwaniem, np. limit prędkości przemieszczania się.