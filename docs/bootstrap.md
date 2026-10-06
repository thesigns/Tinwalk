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

- Przycisk **Search area** jest dostępny, gdy użytkownik jest na pustkowiu, jest co najmniej 200 m od środka schronu i nie stoi wewnątrz aktywnego przeszukanego obszaru.
- Gdy warunek nie jest spełniony, przycisk jest nieaktywny, a aplikacja pokazuje krótką informację zależną od przyczyny:
  - za blisko schronu (od 100 do 200 m od środka): „Too close to your shelter”,
  - za blisko aktywnego przeszukanego obszaru: „This area has already been searched”,
  - za słaby sygnał: „Waiting for a better GPS signal…”.
- Każde przeszukanie zostawia punkt w pozycji użytkownika. Punkty działają jak metaballe 2D: pojedynczy punkt to koło o promieniu 200 m (średnica 400 m), a punkty blisko siebie zlewają się w jeden obły kształt. Przeszukany obszar to wnętrze tych kształtów.
  - Każdy punkt ma wpływ, który maleje z odległością: w(d) = (1 − d²/R²)², gdzie R = 300 m, a od 300 m wynosi zero. Wpływ jest dzielony przez wartość w odległości 200 m, żeby pojedynczy punkt sięgał dokładnie 200 m.
  - Miejsce jest przeszukane, gdy suma wpływów wszystkich aktywnych punktów wynosi co najmniej 1.
  - Dwa punkty zlewają się, gdy ich środki dzieli mniej niż ok. 465 m.
  - Ponieważ przeszukiwać można dopiero za krawędzią, kolejne przeszukania na trasie wypadają co ok. 200 m, czyli na 3 km spaceru jest ich ok. 15.
- Każdy punkt wygasa po 6 godzinach od przeszukania i znika z mapy, a przeszukany obszar kurczy się razem z nim. Dzięki temu tę samą ulubioną trasę można przejść z pożytkiem dwa razy dziennie.

### Zdobycze

Zasoby i ilość łupu są opisane w [loot.md](loot.md).

| Zasób | Zastosowanie (docelowo)                                  |
|-------|----------------------------------------------------------|
| Junk  | rozbudowa schronu i wytwarzanie przedmiotów, np. amunicji |
| Food  | utrzymanie ocalałych w schronie                          |
| Cells | zasilanie radia, a docelowo innych urządzeń elektrycznych |
| Isotopes | docelowo produkcja Reactor Fuel; tylko ze stref radiacji (zob. [radiation.md](radiation.md)) |

- Komunikat po przeszukaniu, np. „You've found 3 Junk”.
- Przeszukanie może dać podręcznik, który odblokowuje wytwarzanie przedmiotów (zob. [crafting.md](crafting.md)).
- Po ciemku przeszukanie daje mniej, chyba że użytkownik ma latarkę (zob. [night.md](night.md)).
- Część pustkowia jest skażona radiacją. Strefy są niewidoczne i wykrywa je licznik Geigera (zob. [radiation.md](radiation.md)).
- Przeszukanie może zakończyć się spotkaniem z wrogiem, a niepokonany wróg zostaje na mapie (zob. [combat.md](combat.md)).
- Przeszukanie może czasem odkryć landmark, który zostaje na mapie na zawsze (zob. [landmarks.md](landmarks.md)).
- W prototypie nie ma budowania.

### Plecak

- Plecak mieści łącznie 50 jednostek wszystkich zasobów i przedmiotów (np. 25 Junk i 25 Food). Każdy zasób zajmuje 1 jednostkę. Ile miejsca zajmuje przedmiot albo podręcznik, opisuje [crafting.md](crafting.md).
- Gdy znalezisko nie mieści się w całości, użytkownik zabiera tyle, ile się zmieści, a reszta przepada. Komunikat, np. „You've found 3 Junk, but could only carry 1”.
- Z pełnym plecakiem nadal można przeszukiwać (np. w nadziei na landmark albo żeby uratować ocalałego).
- Dotknięcie plecaka na pasku stanu otwiera jego zawartość: ile jednostek każdego zasobu niesie użytkownik, jakie przedmioty i ile miejsca zostało.
- Z plecaka można wyrzucać zasoby, np. żeby zrobić miejsce na inne. Użytkownik zaznacza przyciskami −/+, ile jednostek którego zasobu wyrzucić (przytrzymanie przycisku zmienia liczbę dalej), i zatwierdza przyciskiem **Drop**. Zamknięcie okna bez zatwierdzenia niczego nie wyrzuca.
- Przedmioty i podręczniki wyrzuca się pojedynczo.
- Wyrzucone zasoby i przedmioty przepadają. Wyrzucać można wszędzie, także w schronie.

### Ocaleni (Survivors)

- Ocalałych zdobywa się tylko w misjach ratunkowych: radio w schronie odbiera wezwanie rannego ocalałego, który czeka przy landmarku (zob. [landmarks.md](landmarks.md)). Zwykłe przeszukanie nie daje ocalałych.
- Użytkownik eskortuje najwyżej jednego ocalałego naraz.
- Po ratunku użytkownik wybiera: **Take with you** albo **Leave**. Pozostawiony ocalały przepada.
- Ocalały idący z użytkownikiem zwiększa pojemność plecaka o 30 jednostek (łącznie 80), a ranny tylko o 10 (zob. [combat.md](combat.md#rany)).
- Ocalały ma losowe imię.
- Ocaleni w schronie jedzą i bez jedzenia odchodzą (zob. [survivors.md](survivors.md)). Poza tym w prototypie nic nie robią.
- Ocalały może zostać ranny w walce. Ranę leczy się apteczką albo goi się sama (zob. [combat.md](combat.md#rany)).

### Rozładunek (Unload)

- Gdy użytkownik jest w schronie, dostępny jest przycisk **Unload**.
- Rozładunek przenosi całą zawartość plecaka (zasoby, przedmioty i podręczniki) do magazynu schronu, a towarzyszącego ocalałego do schronu. Głodni ocaleni od razu jedzą przyniesione jedzenie.
- Po rozładunku pojemność plecaka wraca do 50.
- W schronie nie można przeszukiwać.
- W schronie można też wytwarzać przedmioty i zabierać je z magazynu do plecaka (zob. [crafting.md](crafting.md)).

### Mapa

- Aplikacja nie pokazuje prawdziwej mapy. W tle rysowana jest fikcyjna, proceduralnie generowana mapa terenu ze schematycznymi ikonami. Są trzy biomy: równiny (rzadkie kępki trawy, rysowane jak znak łąki na mapach topograficznych: pionowe kreski na krótkiej linii gruntu), las (drzewa) i ruiny (plan zrujnowanego miasta).
- Równiny zajmują ok. 50% świata, bo dają najbardziej zrównoważony łup. Lasy i ruiny zajmują po ok. 25%.
- Równiny to tło: wszystko, co nie jest lasem ani ruinami.
- Lasy powstają z szumu simplex zniekształconego drugim szumem (domain warping), więc mają nieregularne brzegi, zatoki i polany, a nie obłe plamy.
- Ruiny to pozostałości osad. Świat jest podzielony na komórki ok. 1,85 km, a w każdej może stać jedna osada o promieniu ok. 185–925 m. Osada ma własną, obróconą siatkę ulic z prostokątnymi kwartałami (ok. 90 × 60 m) i szerszą arterią co cztery przecznice. Jej brzeg jest postrzępiony szumem, a część kwartałów to puste działki.
- Gdy osady się stykają, każdy kwartał należy do tej, której brzeg jest bliżej, więc łączą się jak dzielnice jednego miasta.
- Ruiny obejmują całe kwartały razem z ulicami, więc na ulicy w osadzie też jest się w ruinach.
- Osady są rysowane jako wektorowe kształty, a nie próbkowane jak reszta terenu, żeby kwartały i ulice były ostre przy każdym przybliżeniu.
- Ruiny nie mają ikon. Przy oddaleniu kwartał jest jedną plamą, a przy największych przybliżeniach (do ok. 750 m szerokości widoku) rozpada się na budynki: dwa rzędy wzdłuż dłuższych ulic z podwórzem pośrodku. Część budynków jest uszkodzona (brakuje im rogu), a część zawalona (zostaje tylko przerywany obrys).
- Każda osada ma stałą, wylosowaną nazwę złożoną z dwóch członów, np. „Rustford” albo „Pinemouth”. Nazwy nie ma na mapie, żeby jej nie zaśmiecać; widać ją tylko pod słowem **Ruins** obok kompasu (zob. Interfejs).
- Grunt ma bardzo delikatne, rozległe cieniowanie, żeby nie był płaski, ale nie wyglądał na poplamiony.
- Teren jest generowany deterministycznie z szerokości i długości geograficznej (np. szum simplex), więc to samo miejsce na Ziemi zawsze wygląda tak samo.
- Szum jest próbkowany we współrzędnych metrycznych (Web Mercator), a nie bezpośrednio w stopniach. Stopień długości geograficznej jest krótszy niż stopień szerokości (w Polsce ok. 65–70 km wobec 111 km), więc próbkowanie w stopniach rozciągałoby teren w poziomie.
- Teren jest renderowany w kafelkach na niewidocznych płótnach (offscreen canvas) i trzymany w pamięci podręcznej, żeby nie rysować wszystkich ikon w każdej klatce.
- Szum lasu jest próbkowany na rzadkiej siatce, ale granica lasu jest wyznaczana dopiero z wartości interpolowanej dla każdego piksela kafelka. Dzięki temu jest gładka i ostra, a nie schodkowa.
- Regiony terenu mają skalę od kilkuset metrów do około kilometra, tak żeby typowy spacer przechodził przez kilka różnych terenów. Na prostym odcinku 3 km teren zmienia się średnio ok. 6 razy.
- Mapa jest zawsze skierowana na północ.
- Na mapie widoczne są:
  - schron jako okrąg z nazwą,
  - aktywne przeszukane obszary jako zlane kształty, zakreskowane czerwonym ołówkiem, z krzyżykiem w miejscu każdego przeszukania,
  - odkryte landmarki jako małe ikony, a cel misji ratunkowej zakreślony czerwonym ołówkiem (zob. [landmarks.md](landmarks.md)),
  - niepokonani wrogowie jako ikony na czerwonych kółkach (zob. [combat.md](combat.md#wrogowie-na-mapie)),
  - pozycja użytkownika jako pinezka (z okręgiem dokładności GPS),
- Pinezka jest zielona, gdy użytkownik może przeszukać obszar, a czerwona, gdy nie może (np. jest w przeszukanym obszarze, za blisko schronu albo w schronie). Przy słabym sygnale pinezka jest szara.
- Domyślny widok obejmuje około 1–2 km wokół użytkownika i jest wycentrowany na użytkowniku.
- Mapę można przybliżać i oddalać (gest szczypania, na komputerze kółko myszy) w zakresie od ok. 500 m do ok. 5 km szerokości widoku.
- Mapę można przesuwać palcem (na komputerze przeciąganiem myszą), żeby obejrzeć dłuższą trasę albo cel misji. Przesunięta mapa zostaje w miejscu, a przycisk z celownikiem przy menu wraca do śledzenia użytkownika.
- Biom w miejscu przeszukania wpływa na to, jaki zasób się znajdzie (zob. [loot.md](loot.md)).
- Oprócz biomów jest niewidoczna warstwa stref radiacji (zob. [radiation.md](radiation.md)). Mapa jej nie pokazuje.

### Interfejs

- Główny ekran to mapa.
- Pasek stanu pokazuje: zawartość plecaka (np. „Backpack 12/50”), czy idzie z nami ocalały, oraz jakość sygnału GPS. Dotknięcie plecaka otwiera panel plecaka.
- Przyciski zależą od kontekstu: **Create a Shelter**, **Search area**, **Unload**.
- Obok kompasu i podziałki mapy jedno słowo mówi, gdzie stoi użytkownik: **Shelter**, **Plains**, **Forest** albo **Ruins**. W ruinach pod spodem jest mniejszym drukiem nazwa osady. Najniżej jest pora dnia i czas do jej zmiany, np. „Day · dark in 3 h” (zob. [night.md](night.md)). Dzięki temu na granicy biomów nie trzeba zgadywać z mapy, jaki łup da przeszukanie. Bez pozycji słowa nie ma, a przy słabym sygnale jest przygaszone, tak jak pinezka.
- Panel schronu pokazuje nazwę schronu, stan magazynu, przedmioty i podręczniki, warsztat (zob. [crafting.md](crafting.md)), radio (zob. [landmarks.md](landmarks.md#radio)) oraz ocalałych z ich etapem głodu i ranami (zob. [survivors.md](survivors.md)).

#### Ekran startowy

- Przy każdym uruchomieniu aplikacji, zanim pojawi się cokolwiek innego, aplikacja pokazuje ekran z logo (napisem **Tinwalk**), wersją zapisu i datą ostatniej aktualizacji, np. „Save version 8 · Updated 5 Oct 2026”.
- Pod spodem jest przypomnienie o bezpieczeństwie: „When you walk outdoors, stay aware of your surroundings. Don't enter restricted, private or dangerous areas, and keep an eye on traffic. Stay safe!” i przycisk **I understand**.
- Dopiero po kliknięciu przycisku aplikacja zaczyna śledzić pozycję, a przy pierwszym uruchomieniu pokazuje ekran powitalny.
- Datę aktualizacji trzeba zmieniać ręcznie (stała `APP_UPDATED` w `js/version.js`), bo aplikacja nie ma kroku budowania.

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
- Rozbudowa schronu z Junk, rozwój w stylu miasta z Cywilizacji.
- Wytwarzanie amunicji i kolejnych przedmiotów z Junk.
- Statystyki ocalałych, np. jak długo przetrwali w schronie.
- Walka z użyciem amunicji.
- Kolejni wrogowie, np. bandyci zabierający Junk. Szansa na wroga zależna od odległości od schronu i biomu.
- Pancerz zwiększający obronę użytkownika.
- Wiedza od ocalałych, np. była pielęgniarka w schronie pozwala wytwarzać apteczki.
- Praca ocalałych w schronie.
- Konfiguracja wartości gry (np. progów odległości w [loot.md](loot.md)).
- Wybór, co zrobić ze znaleziskiem, które nie mieści się w plecaku (np. wyrzucenie czegoś na miejscu zamiast utraty nadmiaru).
- Pełna aplikacja PWA (instalacja na ekranie głównym, działanie offline).
- Utrzymywanie włączonego ekranu podczas spaceru (Wake Lock API).
- Podstawowa ochrona przed oszukiwaniem, np. limit prędkości przemieszczania się.
- Inne misje do landmarków, np. „czeka tam coś specjalnego”.
- Łup zależny od rodzaju landmarku, np. apteka częściej daje apteczki.
- Wytwarzanie Cells w schronie:
  - mini-reaktor produkujący Cells z Reactor Fuel; Reactor Fuel wytwarza się z Isotopes (zob. [radiation.md](radiation.md)),
  - panele słoneczne.
- Kolejne urządzenia w schronie zasilane z Cells i przedmioty z baterią w koszcie, np. karabin laserowy, dron zwiadowczy. Przedmiotów nie ładuje się: zużyty znika.
- Psucie się niektórych rzeczy i naprawy z Junk.