# Ocaleni w schronie (Survivors)

Zasady życia ocalałych, którzy trafili do schronu. Znajdowanie ocalałych i eskortowanie ich do schronu opisuje [bootstrap.md](bootstrap.md), a szansę na znalezienie ocalałego [loot.md](loot.md).

## Przybycie

- Ocalały trafia do schronu przy rozładunku (**Unload**).
- Aplikacja zapamiętuje datę i godzinę przybycia każdego ocalałego. W przyszłości posłuży do liczenia, jak długo ocalali przetrwali w schronie.
- Nowo przybyły ocalały jest najedzony.

## Jedzenie

- Każdy ocalały w schronie zjada 1 Food raz na 24 godziny.
- Liczy się tylko jedzenie w magazynie schronu. Food w plecaku trzeba najpierw rozładować.
- Ocalały idący z użytkownikiem nie je. Jego licznik zaczyna się dopiero po przybyciu do schronu.
- Ranny ocalały (zob. [combat.md](combat.md#rany)) przy każdym posiłku zjada 2 Food zamiast 1. Jeśli w magazynie jest tylko 1 Food, zjada je i też zostaje najedzony.

## Etapy głodu

Każdy etap trwa 24 godziny:

| Etap     | Nazwa w aplikacji | Co się dzieje, gdy etap minie                                   |
|----------|-------------------|-----------------------------------------------------------------|
| Najedzony | Satiated         | ocalały zjada 1 Food i zostaje najedzony; bez jedzenia staje się głodny |
| Głodny    | Hungry           | ocalały zaczyna głodować                                        |
| Głodujący | Starving         | ocalały opuszcza schron                                         |

- Bez jedzenia użytkownik ma więc 72 godziny od ostatniego posiłku ocalałego, żeby przynieść jedzenie do schronu.
- Głodny lub głodujący ocalały zjada 1 Food, gdy tylko pojawi się ono w magazynie (czyli przy rozładunku), i znów jest najedzony na 24 godziny.
- Gdy jedzenia nie wystarcza dla wszystkich, pierwszeństwo ma ten, kto czeka na posiłek najdłużej. Ranny zjada wtedy swoje 2 Food naraz, zanim przyjdzie kolej na następnego.
- Ocalały, który opuścił schron, przepada, ale zostaje w historii schronu (zob. niżej).

## Historia

- Schron zapamiętuje ocalałych, którzy go opuścili: imię, datę przybycia, datę odejścia i powód (na razie tylko głód).
- Data odejścia to chwila, w której minął ostatni etap głodu, a nie chwila otwarcia aplikacji.
- Historia nie jest jeszcze nigdzie pokazywana. Posłuży w przyszłości do statystyk, np. jak długo ocaleni przetrwali w schronie.

## Czas, gdy aplikacja jest zamknięta

- Posiłki i odejścia liczą się także wtedy, gdy aplikacja jest zamknięta. Po otwarciu aplikacja rozlicza wszystkie zaległe posiłki po kolei, w kolejności ich terminów, tak jakby działała cały czas.
- Magazyn zmienia się tylko przy otwartej aplikacji, więc takie rozliczenie daje ten sam wynik.
- Jeśli ktoś opuścił schron, aplikacja pokazuje okno z informacją, kto odszedł i dlaczego, np. „Ada left Bunker: there was no food”.

## Interfejs

- W panelu schronu każdy ocalały ma plakietkę z imieniem, etapem głodu i paskiem postępu, który pokazuje, ile zostało do końca bieżącego etapu, oraz czas słownie:
  - najedzony: „eats in 14 h” (albo „hungry in 14 h”, gdy w magazynie nie ma jedzenia),
  - głodny: „starving in 20 h”,
  - głodujący: „leaves in 5 h”.
- Kolor paska i etapu zależy od etapu: zielony, pomarańczowy, czerwony.
- Ranny ocalały ma na plakietce także oznaczenie rany i przycisk **Treat** (zob. [combat.md](combat.md#rany)).
- Gdy któryś ocalały jest głodny, przycisk **Shelter** ma pomarańczową kropkę, a gdy któryś głoduje, czerwoną, pulsującą. Dzięki temu widać to także podczas spaceru.
