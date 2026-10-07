# Radiacja (Radiation)

Na pustkowiu są strefy skażone radiacją. Nie widać ich na mapie. Wykrywa je tylko licznik Geigera (zob. [crafting.md](crafting.md)). Z licznikiem przeszukanie w strefie daje Isotopes, a bez niego jedzenie znalezione w strefie jest skażone i może wywołać chorobę.

## Strefy

- Radiacja to osobna warstwa nad biomami (zob. [bootstrap.md](bootstrap.md#mapa)), niezależna od nich: strefa może leżeć na równinach, w lesie i w ruinach.
- Strefy powstają z szumu simplex zniekształconego drugim szumem, tak jak lasy, ale z innym ziarnem. Są deterministyczne: to samo miejsce na Ziemi jest zawsze tak samo skażone.
- Strefy zajmują ok. 20% powierzchni świata.
- Typowe przejście przez strefę to ok. 250 m (połowa przejść ma od 130 do 420 m).
- Na spacerze z 15 przeszukaniami średnio 3 wypadają w strefie. Ok. 14% takich spacerów w ogóle nie trafia na radiację (symulacja).
- Strefa ma natężenie od 0 przy brzegu do 1 w najgorętszym rdzeniu. Natężenie wpływa tylko na trzaski licznika (zob. niżej), a nie na zasady gry.
- W promieniu 200 m od środka schronu (tam, gdzie nie można przeszukiwać) radiacji nie ma.
- O tym, czy przeszukanie jest w strefie, decyduje miejsce przeszukania.
- W strefach zamiast zwykłych szczurów spotyka się zmutowane (Mutated Rat), silniejsze (zob. [combat.md](combat.md#wrogowie)). Niepokonany zmutowany szczur zostaje na mapie, więc zdradza strefę także graczowi bez licznika.

## Licznik Geigera

Licznik działa, gdy jest w plecaku. Nie trzeba go włączać.

### Wykrywanie

- Gdy użytkownik z licznikiem w plecaku jest w strefie, obok kompasu widać ikonkę radiacji. Bez licznika nic nie zdradza strefy.
- Licznik trzeszczy (dźwięk i wibracja przez ok. 1,2 s):
  - przy wejściu do strefy,
  - przy przeszukaniu w strefie,
  - przy każdym dotknięciu ekranu w strefie.
- Trzaski są losowe jak rozpady, które liczy prawdziwy licznik, i tym częstsze, im głębiej w strefie: od ok. 6 na sekundę przy brzegu do ok. 60 w rdzeniu. Wibracje są rzadsze (3–12 na sekundę), bo telefon nie wibruje tak szybko.
- Trzaski zależą od ustawień dźwięku i wibracji. Przy obu wyłączonych zostaje sama ikonka.
- Z ikonki wypływają okręgi, w losowych odstępach jak trzaski i tym częściej, im głębiej w strefie: od ok. 0,8 na sekundę przy brzegu do ok. 5 w rdzeniu. Dzięki temu ikonka pokazuje natężenie także przy wyłączonym dźwięku. Przy ograniczonych animacjach (`prefers-reduced-motion`) okręgów nie ma.
- Wykrywanie nie zużywa licznika.

### Przeszukanie w strefie z licznikiem

- Przeszukanie daje **1 Isotopes zamiast zwykłych zasobów**. Reszta łupu jest zbyt skażona, żeby ją zabrać.
- Przeszukanie zużywa jedno użycie licznika. Z kilku liczników używany jest ten z najmniejszą liczbą użyć. Zużyty licznik znika.
- Noc i latarka nie mają wpływu na Isotopes (zob. [night.md](night.md)), a latarka się wtedy nie zużywa.
- Wygrana walka dokłada skarb zmutowanego szczura: 1 Junk i 1 Isotope. Isotope ze skarbu przypada także bez licznika (zob. [combat.md](combat.md#wrogowie)).
- Ucieczka i przegrana walka nie dają łupu, więc nie zużywają licznika.
- Podręcznik losuje się jak zwykle, a landmark powstaje jak zwykle, także przy ucieczce albo przegranej (zob. [landmarks.md](landmarks.md#odkrywanie)).

## Isotopes

- To czwarty zasób, obok Junk, Food i Cells. Zajmuje 1 jednostkę w plecaku i podlega tym samym zasadom co inne zasoby (rozładunek, wyrzucanie, straty w walce).
- Isotopes nie wypadają w zwykły sposób. Jedynym źródłem jest przeszukanie w strefie z licznikiem.
- Na razie do niczego nie służą. W przyszłości będzie się z nich wytwarzać Reactor Fuel do produkcji Cells (zob. [bootstrap.md](bootstrap.md#na-przyszłość)).

## Skażone jedzenie

- Przeszukanie w strefie bez licznika daje zwykły łup. Jeśli to Food, jest ono skażone.
- Skażone Food wygląda jak zwykłe: użytkownik widzi tylko łączną liczbę Food, w plecaku i w magazynie.
- Gdy Food ubywa (wyrzucanie, straty w walce, jedzenie), każda zabrana jednostka jest skażona z prawdopodobieństwem równym udziałowi skażonych w tym miejscu. Przykład: w magazynie jest 15 Food, w tym 5 skażonych, więc pierwsza zjedzona jednostka jest skażona z szansą 1/3.
- Rozładunek przenosi do magazynu całe jedzenie, także skażone.
- Skażone jedzenie nie psuje się i nie znika samo.

## Choroba (Sick)

- Ocalały, który zje choć jedną skażoną jednostkę, zachoruje. Choruje tylko ocalały w schronie, bo ocalały idący z użytkownikiem nie je.
- Choroba działa jak rana (zob. [combat.md](combat.md#rany)):
  - mija sama po 72 godzinach,
  - chory przy każdym posiłku zjada 2 Food zamiast 1 (zob. [survivors.md](survivors.md)), które też mogą być skażone,
  - kolejne skażone jedzenie nie pogarsza stanu, ale odnawia czas choroby do 72 godzin.
- Gdy skażonego jedzenia jest dużo, chory może chorować bez końca. To zamierzone.
- Ocalały może być naraz ranny i chory. Czas gojenia liczy się osobno, ale kary się nie sumują: ranny i chory zjada 2 Food, a nie 3.
- Apteczka leczy chorobę tak jak ranę. Jedno użycie leczy naraz ranę i chorobę.

## Interfejs

- Po zachorowaniu aplikacja pokazuje okno z tytułem „Ada is sick” i tekstem „Ada got sick: the food was contaminated. A first aid kit will help.” Gdy posiłki rozliczają się po otwarciu aplikacji, okno wymienia wszystkich, którzy zachorowali, a pomija tych, którzy zdążyli odejść z głodu.
- Na plakietce ocalałego jest oznaczenie „Sick” z ikoną radiacji i czasem do wyzdrowienia, np. „heals in 50 h”, oraz przycisk **Treat**. Ranny i chory ma oznaczenie „Wounded & sick” i czas do późniejszego z wyzdrowień.
- Komunikat po przeszukaniu z licznikiem, np. „You've found 1 Isotope. Your Geiger counter showed everything else here was too hot to keep.” Gdy licznik się zużyje, komunikat kończy się „…, then went dead.”
- W trybie debug panel GPS pokazuje natężenie radiacji w miejscu użytkownika.
