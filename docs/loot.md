# Zdobycze (Loot)

Każde przeszukanie daje losową ilość jednego zasobu.

Przeszukanie nie daje ocalałych. Ocalałych zdobywa się tylko w misjach ratunkowych (zob. [landmarks.md](landmarks.md)).

W grze są cztery zasoby: **Junk**, **Food**, **Cells** (baterie) i **Isotopes**. Z Junk wytwarza się w schronie przedmioty (zob. [crafting.md](crafting.md)), Food jedzą ocaleni (zob. [survivors.md](survivors.md)), a Cells zasilają radio (zob. [landmarks.md](landmarks.md#radio)). Isotopes zdobywa się tylko w strefach radiacji z licznikiem Geigera (zob. [radiation.md](radiation.md)), więc nie ma ich w tabelach poniżej.

Cells są rzadkie poza ruinami. Nic w grze ich jeszcze nie wytwarza, więc jedynym źródłem jest przeszukiwanie.

Przeszukanie może też dać podręcznik ([crafting.md](crafting.md#podręczniki-manuals)), odkryć landmark ([landmarks.md](landmarks.md)) albo zakończyć się spotkaniem z wrogiem ([combat.md](combat.md)). Wygrana walka podwaja liczbę zasobów.

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

*Plains*

| Zasób | Waga |
|-------|------|
| Junk  | 45   |
| Food  | 45   |
| Cells | 10   |

*Forest*

| Zasób | Waga |
|-------|------|
| Junk  | 20   |
| Food  | 75   |
| Cells | 5    |

*Ruins*

| Zasób | Waga |
|-------|------|
| Junk  | 60   |
| Food  | 10   |
| Cells | 30   |
