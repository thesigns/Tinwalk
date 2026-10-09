# Zdobycze (Loot)

Każde przeszukanie daje losową ilość jednego zasobu.

Przeszukanie nie daje ocalałych. Ocalałych zdobywa się tylko w misjach ratunkowych (zob. [landmarks.md](landmarks.md)).

W grze jest pięć zasobów: **Junk**, **Food**, **Data** (dyskietki, taśmy i dyski z przedwojenną wiedzą), **Cells** (baterie) i **Isotopes**. Z Junk wytwarza się w schronie przedmioty (zob. [crafting.md](crafting.md)), Food jedzą ocaleni (zob. [survivors.md](survivors.md)), a Cells zasilają radio (zob. [landmarks.md](landmarks.md#radio)). Data na razie do niczego nie służy; w przyszłości będzie się za nie prowadzić research w schronie.

Przeszukanie bez niczego daje tylko trzy podstawowe zasoby: Junk, Food i Data. Isotopes zdobywa się w strefach radiacji z licznikiem Geigera (zob. [radiation.md](radiation.md)) i ze zmutowanych szczurów. Cells przeszukania nie dają: wypadają z pokonanych dronów (Mosquidrone, zob. [combat.md](combat.md#wrogowie)).

Przeszukanie może też dać podręcznik ([crafting.md](crafting.md#podręczniki-manuals)), odkryć landmark ([landmarks.md](landmarks.md)) albo zakończyć się spotkaniem z wrogiem ([combat.md](combat.md)). Wygrana walka dokłada do zasobów skarb wroga ([combat.md](combat.md#wygrana)).

## Odległość od schronu

Ilość łupu zależy od odległości od środka schronu w linii prostej, w miejscu przeszukania.

| Odległość | Liczba zasobów |
|-----------|----------------|
| < 1 km    | 1              |
| 1-2 km    | 1-2            |
| 2-4 km    | 2-4            |
| 4-8 km    | 3-6            |
| > 8 km    | 4-8            |

- Przeszukiwać można dopiero 200 m od schronu, więc pierwszy próg to w praktyce 200 m – 1 km.
- Odległość równa granicy należy do wyższego progu (np. dokładnie 1 km to próg 1-2 km).
- Liczba zasobów jest losowana równomiernie z przedziału.
- W strefie radiacji przeszukanie z licznikiem Geigera daje 1 Isotopes zamiast zwykłego łupu, a bez licznika Food jest skażone (zob. [radiation.md](radiation.md)).
- W nocy przeszukanie bez latarki daje o 1 mniej (ale co najmniej 1), a z latarką o 1 więcej, w dzień i w nocy (zob. [night.md](night.md)).

## Biom

Wagi zasobów zależą od biomu w miejscu przeszukania.

| Zasób | Barrens | Forest | Ruins |
|-------|---------|--------|-------|
| Junk  | 80      | 10     | 10    |
| Food  | 10      | 80     | 10    |
| Data  | 10      | 10     | 80    |

- Każdy biom słynie z jednego zasobu, więc wybór trasy spaceru to decyzja: po Junk idzie się na pustkowia, po jedzenie do lasu, po Data do ruin.
- Gdy w okolicy brakuje któregoś biomu, gracz może zacząć grę w innym świecie (nowy World ID).

## Landmarki

Przeszukanie, którego obszar obejmuje landmark (ten sam zasięg, który kończy misję ratunkową, zob. [landmarks.md](landmarks.md)), losuje łup trzy razy: raz z wagami Barrens, raz Forest i raz Ruins, bez względu na biom, w którym stoi landmark. Dzięki temu daje około trzy razy więcej zasobów i zwykle po trochu Junk, Food i Data.

- Każde z trzech losowań ma zwykłą liczbę zasobów zależną od odległości od schronu.
- Ciemność i latarka działają na każde losowanie osobno: w nocy bez latarki każde daje o 1 mniej (ale co najmniej 1), z latarką każde o 1 więcej. Latarka zużywa przy tym jedno użycie, jak przy zwykłym przeszukaniu.
- W strefie radiacji z licznikiem Geigera przeszukanie daje 3 Isotopes zamiast zwykłego łupu (licznik zużywa jedno użycie). Bez licznika jedzenie jest skażone, jak przy zwykłym przeszukaniu.
- Bonus dotyczy także przeszukania, które landmark odkrywa, i przeszukania, które kończy misję ratunkową.
- Gdy kilka landmarków jest w zasięgu, bonus i tak jest jeden.
- Okno ze znaleziskiem pokazuje wtedy nazwę landmarku i obok siebie mniejsze medale, po jednym na każdy znaleziony zasób (np. „+2 Junk”, „+1 Food”, „+2 Data”).
