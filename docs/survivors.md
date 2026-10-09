# Ocaleni w schronie (Survivors)

Zasady życia ocalałych, którzy trafili do schronu. Ocalałych w drużynie użytkownika opisuje [party.md](party.md), a misje ratunkowe, z których się ich zdobywa, [landmarks.md](landmarks.md).

## Przybycie

- Ocalały trafia do schronu, gdy użytkownik zostawi go tam z drużyny (**Leave**, zob. [party.md](party.md)).
- Aplikacja zapamiętuje datę i godzinę pierwszego przybycia każdego ocalałego. W przyszłości posłuży do liczenia, jak długo ocalali przetrwali w schronie.
- Przybycie nie zmienia głodu: ocalały je według tego samego licznika co w drużynie.

## Jedzenie

- Każdy ocalały w schronie zjada 1 Food raz na 24 godziny.
- Liczy się tylko jedzenie w magazynie schronu. Food w plecaku trzeba najpierw rozładować.
- Ocalały w drużynie też je, z plecaka albo, gdy użytkownik jest w schronie, z magazynu (zob. [party.md](party.md#jedzenie)).
- Chory ocalały (zob. [radiation.md](radiation.md#choroba-sick)) przy każdym posiłku zjada 2 Food zamiast 1. Jeśli w magazynie jest tylko 1 Food, zjada je i też zostaje najedzony. Ranny je 1 Food jak każdy, ale goi się tylko wtedy, gdy jest najedzony (zob. [combat.md](combat.md#gojenie)).
- Posiłek, który przypadł, gdy aplikacja była zamknięta, ocalały zjada o czasie, bo jedzenie już wtedy było. Posiłek, na który zabrakło jedzenia przy otwartej aplikacji, zjada dopiero wtedy, gdy jedzenie się pojawi.
- Część jedzenia w magazynie może być skażona, choć tego nie widać. Ocalały, który zje skażone Food, choruje (zob. [radiation.md](radiation.md#skażone-jedzenie)).

## Etapy głodu

Każdy etap trwa 24 godziny:

| Etap     | Nazwa w aplikacji | Co się dzieje, gdy etap minie                                   |
|----------|-------------------|-----------------------------------------------------------------|
| Najedzony | Satiated         | ocalały zjada 1 Food i zostaje najedzony; bez jedzenia staje się głodny |
| Głodny    | Hungry           | ocalały zaczyna głodować                                        |
| Głodujący | Starving         | ocalały opuszcza schron                                         |

- Bez jedzenia użytkownik ma więc 72 godziny od ostatniego posiłku ocalałego, żeby przynieść jedzenie do schronu.
- Głodny lub głodujący ocalały zjada 1 Food, gdy tylko pojawi się ono w magazynie (czyli przy rozładunku), i znów jest najedzony na 24 godziny.
- Gdy jedzenia nie wystarcza dla wszystkich, pierwszeństwo ma ten, kto czeka na posiłek najdłużej. Chory zjada wtedy swoje 2 Food naraz, zanim przyjdzie kolej na następnego.
- Ocalały, który opuścił schron, przepada, ale zostaje w historii schronu (zob. niżej).

## Historia

- Schron zapamiętuje ocalałych, którzy odeszli ze schronu albo z drużyny: imię, datę przybycia (pustą u tych, którzy nigdy nie dotarli do schronu), datę odejścia i powód: głód, porzucenie na pustkowiu albo śmierć od ran.
- Data odejścia to chwila, w której minął ostatni etap głodu, a nie chwila otwarcia aplikacji.
- Historia nie jest jeszcze nigdzie pokazywana. Posłuży w przyszłości do statystyk, np. jak długo ocaleni przetrwali w schronie.

## Czas, gdy aplikacja jest zamknięta

- Posiłki i odejścia liczą się także wtedy, gdy aplikacja jest zamknięta. Po otwarciu aplikacja rozlicza wszystkie zaległe posiłki po kolei, w kolejności ich terminów, tak jakby działała cały czas.
- Magazyn zmienia się tylko przy otwartej aplikacji, więc takie rozliczenie daje ten sam wynik.
- Jeśli ktoś opuścił schron, aplikacja pokazuje okno z informacją, kto odszedł i dlaczego, np. „Ada left Bunker: there was no food”.

## Interfejs

- Na zakładce **Shelter** każdy ocalały ma plakietkę z imieniem, etapem głodu i paskiem postępu, który pokazuje, ile zostało do końca bieżącego etapu, oraz czas słownie:
  - najedzony: „eats in 14 h” (albo „hungry in 14 h”, gdy w magazynie nie ma jedzenia),
  - głodny: „starving in 20 h”,
  - głodujący: „leaves in 5 h”.
- Kolor paska i etapu zależy od etapu: zielony, pomarańczowy, czerwony.
- Ranny albo chory ocalały ma na plakietce także kropelki krwi za rany albo oznaczenie choroby i przycisk **Treat** (zob. [combat.md](combat.md#interfejs) i [radiation.md](radiation.md#interfejs)).
- Gdy któryś ocalały jest głodny, zakładka **Shelter** ma pomarańczową kropkę, a gdy któryś głoduje, czerwoną, pulsującą. Dzięki temu widać to także podczas spaceru.
