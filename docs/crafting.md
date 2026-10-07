# Wytwarzanie (Crafting)

Przedmioty i wyposażenie schronu wytwarza się w schronie z zasobów z magazynu (głównie z Junk, a urządzenia elektryczne także z Cells). Każdy przepis wymaga odpowiedniego podręcznika, który trzeba najpierw znaleźć na pustkowiu i donieść do schronu. Walkę, w której przydają się przedmioty, opisuje [combat.md](combat.md).

## Podręczniki (Manuals)

| Podręcznik           | Odblokowuje               |
|----------------------|---------------------------|
| Knifemaking Manual   | Knife, Combat knife       |
| Pharmacology Manual  | First aid kit             |
| Radio Manual         | Radio                     |
| Electric Tools Manual | Flashlight, Geiger counter |

### Znajdowanie

- Każde przeszukanie może dać podręcznik, osobno od zasobów i landmarku.
- Pierwszym podręcznikiem jest zawsze Radio Manual: dopóki użytkownik go nie ma (ani w schronie, ani w plecaku), wypada tylko on. Radio otwiera drogę do misji ratunkowych, a to jedyne źródło ocalałych (zob. [landmarks.md](landmarks.md)).
- Wypada tylko podręcznik, którego użytkownik jeszcze nie ma: ani w schronie, ani w plecaku. Gdy ma już wszystkie, podręczniki przestają wypadać.
- Szansa bazowa to 2%. Każde przeszukanie bez podręcznika zwiększa ją o 1 punkt procentowy, najwyżej do 20%. Po znalezieniu podręcznika (także zostawionego) szansa wraca do 2%. Dzięki temu nawet przy pechu pierwszy podręcznik pojawia się w rozsądnym czasie.
- Przeszukanie zakończone ucieczką albo przegraną walką nie losuje podręcznika i nie zwiększa szansy (zob. [combat.md](combat.md)).
- Gdy użytkownik ma już Radio Manual, to, który podręcznik wypada, zależy od biomu. Wagi dotyczą tylko podręczników, których użytkownik jeszcze nie ma:

| Podręcznik           | Plains | Forest | Ruins |
|----------------------|--------|--------|-------|
| Knifemaking Manual   | 1      | 1      | 1     |
| Pharmacology Manual  | 1      | 1      | 2     |
| Electric Tools Manual | 1     | 1      | 2     |

### Zabieranie

- Po znalezieniu (po ewentualnym landmarku, oknie ze znaleziskiem i ewentualnym ratunku ocalałego) aplikacja pokazuje okno z podręcznikiem i przyciskami **Take** oraz **Leave**.
- Podręcznik zajmuje 3 jednostki miejsca w plecaku. Gdy miejsca brakuje, **Take** jest nieaktywne, a okno pozwala otworzyć plecak i coś wyrzucić.
- Zostawiony albo wyrzucony podręcznik przepada, ale może wypaść ponownie.
- Podręcznik zaczyna działać dopiero po rozładunku w schronie. Zostaje w schronie na zawsze i nie można go zabrać z powrotem do plecaka.

## Przepisy

| Przedmiot      | Podręcznik           | Koszt    | Użycia | Miejsce w plecaku |
|----------------|----------------------|----------|--------|-------------------|
| Knife          | Knifemaking Manual   | 5 Junk   | 6      | 2                 |
| Combat knife   | Knifemaking Manual   | 15 Junk  | 12     | 3                 |
| First aid kit  | Pharmacology Manual  | 7 Junk   | 3      | 2                 |
| Flashlight     | Electric Tools Manual | 10 Junk + 1 Cell | 10 | 2              |
| Geiger counter | Electric Tools Manual | 10 Junk + 1 Cell | 10 | 2              |
| Radio          | Radio Manual         | 30 Junk  | –      | –                 |

- Wytwarzać można tylko w schronie (tak jak rozładowywać). Zasoby są pobierane z magazynu schronu, nie z plecaka.
- Wytworzony przedmiot trafia do magazynu schronu.
- Wytworzenie jest natychmiastowe.

## Wyposażenie schronu

- Radio nie jest przedmiotem, tylko wyposażeniem schronu. Wytwarza się je raz i zostaje w schronie na zawsze.
- Nie ma liczby użyć, nie zajmuje miejsca w magazynie i nie można go zabrać do plecaka.
- Duży koszt jest zamierzony: zbudowanie radia to cel sam w sobie.
- Radio działa na baterie (Cells), których nie dostaje się razem z nim (zob. [landmarks.md](landmarks.md#radio)).
- Do czego służy radio, opisuje [landmarks.md](landmarks.md#radio).

## Przedmioty

- Każdy przedmiot ma liczbę pozostałych użyć. Przedmiot, któremu skończyły się użycia, znika.
- Przedmioty tego samego rodzaju mogą mieć różną liczbę użyć (np. jeden nóż 4/6, drugi 6/6), więc są pokazywane osobno.
- Do czego służą noże, opisuje [combat.md](combat.md), apteczki [combat.md](combat.md#rany), a latarka [night.md](night.md).
- Licznik Geigera wykrywa strefy radiacji i pozwala w nich znajdować Isotopes (zob. [radiation.md](radiation.md)).

### Przedmioty elektryczne

- Latarka i licznik Geigera mają baterię w koszcie wytworzenia. Ich użycia to zapas energii z tej baterii.
- Przedmiotów elektrycznych nie ładuje się. Gdy skończą się użycia, przedmiot znika, tak jak nóż.

### Plecak

- Przedmioty zajmują miejsce w plecaku razem z zasobami (zob. tabelę przepisów).
- W schronie można zabrać przedmiot z magazynu do plecaka, jeśli jest na niego miejsce.
- Rozładunek przenosi do magazynu wszystko, także przedmioty.
- Przedmioty można wyrzucać z plecaka pojedynczo. Wyrzucony przedmiot przepada.

## Interfejs

- Panel schronu ma sekcję **Workshop**: listę przepisów z posiadanych podręczników, z kosztem (np. „10 Junk + 1 Cell”) i przyciskiem **Craft**. Przycisk jest nieaktywny, gdy brakuje zasobów albo użytkownik nie jest w schronie. Przy zbudowanym radiu zamiast przycisku jest napis „Built”.
- Bez żadnego podręcznika sekcja pokazuje krótką informację, że przepisy pochodzą z podręczników znajdowanych na pustkowiu.
- Panel schronu pokazuje posiadane podręczniki oraz przedmioty w magazynie z liczbą użyć. Przy przedmiocie jest przycisk **Pack**, który przenosi go do plecaka (aktywny tylko w schronie i gdy jest miejsce).
- Panel plecaka pokazuje przedmioty z liczbą użyć i zajmowanym miejscem.
