# Zdobycze (Loot)

Każde przeszukanie daje losową ilość jednego zasobu.

W grze są dwa zasoby: **Junk** i **Food**. Amunicję i inne przedmioty będzie się w przyszłości wytwarzać z Junk w schronie, a większe rzeczy będą kosztowały więcej Junk.

## Odległość od schronu

Ilość łupu i szansa na znalezienie ocalałego zależą od odległości od środka schronu w linii prostej, w miejscu przeszukania.

| Odległość | Liczba zasobów | Szansa znalezienia ocalałego |
|-----------|----------------|------------------------------|
| < 1 km    | 1              | 1%                           |
| 1-2 km    | 1-2            | 2%                           |
| 2-4 km    | 2-4            | 4%                           |
| 4-8 km    | 3-6            | 6%                           |
| > 8 km    | 4-8            | 8%                           |

- Przeszukiwać można dopiero 200 m od schronu, więc pierwszy próg to w praktyce 200 m – 1 km.
- Odległość równa granicy należy do wyższego progu (np. dokładnie 1 km to próg 1-2 km).
- Liczba zasobów jest losowana równomiernie z przedziału.

## Biom

Wagi zasobów zależą od biomu w miejscu przeszukania.

*Plains*

| Zasób | Waga |
|-------|------|
| Junk  | 50   |
| Food  | 50   |

*Forest*

| Zasób | Waga |
|-------|------|
| Junk  | 20   |
| Food  | 80   |

*Ruins*

| Zasób | Waga |
|-------|------|
| Junk  | 80   |
| Food  | 20   |
