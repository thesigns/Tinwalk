# Dzień i noc (Night)

Pora dnia w grze to prawdziwa pora dnia w miejscu, w którym jest użytkownik. Po ciemku przeszukanie daje mniej łupu, chyba że użytkownik ma latarkę (zob. [crafting.md](crafting.md)).

## Kiedy jest noc

- Aplikacja liczy wysokość słońca nad horyzontem z czasu i położenia (uproszczone wzory NOAA). Dokładność to kilka minut.
- Noc zaczyna się, gdy słońce zejdzie 6° pod horyzont (koniec zmierzchu cywilnego), i kończy się, gdy znów wzejdzie na tę wysokość (początek świtu cywilnego). Zaraz po zachodzie jest jeszcze jasno, więc noc zaczyna się w Polsce ok. 30–45 minut po zachodzie słońca.
- Za kołem podbiegunowym działa to samo: w czasie dnia polarnego nocy nie ma wcale, a w czasie nocy polarnej trwa cały czas.
- Pora dnia zależy od czasu gry (`clock.now()`), więc w trybie debug przyspieszony czas przewija też dzień i noc.

## Przeszukiwanie po ciemku

| Pora  | Bez latarki          | Z latarką |
|-------|----------------------|-----------|
| Dzień | bez zmian            | +1        |
| Noc   | −1 (ale co najmniej 1) | +1      |

- Kara i premia dotyczą liczby zasobów wylosowanej z tabeli odległości (zob. [loot.md](loot.md)). Skarb za wygraną walkę nie zależy od pory dnia ani latarki (zob. [combat.md](combat.md#wygrana)).
- Do 1 km od schronu przeszukanie zawsze daje 1 sztukę, więc tam noc niczego nie zabiera.
- Z latarką noc nie różni się od dnia. Gra nigdy nie nagradza wychodzenia po ciemku, tylko przestaje za nie karać.
- O tym, czy jest noc, decyduje miejsce i chwila przeszukania.

## Latarka

- Latarka działa, gdy jest w plecaku. Nie trzeba jej włączać.
- Każde przeszukanie, które daje zasoby, zużywa jedno użycie latarki, w dzień i w nocy. Ucieczka i przegrana walka nie dają zasobów, więc nie zużywają latarki.
- Z kilku latarek używana jest ta z najmniejszą liczbą użyć, żeby zużywały się po kolei. Latarki się nie sumują: premia to zawsze +1.
- Latarka, której skończyły się użycia, znika (baterie się wyczerpały). Latarek nie ładuje się: baterie są w koszcie jej wytworzenia.
- Zużyta latarka zwalnia miejsce w plecaku, zanim znaleziony łup trafi do plecaka.

## Interfejs

- Pod słowem biomu przy podziałce mapy jest pora dnia i czas do zmiany, np. „Day · dark in 3 h” albo „Night · light in 5 h”. Podczas dnia albo nocy polarnej jest samo „Day” albo „Night”.
- Komunikat po przeszukaniu mówi, gdy zadziałała noc albo latarka, np. „You've found 2 Junk. It was too dark to search well.” albo „You've found 4 Food. Your Flashlight lit up dark corners and went dead.”
- Komunikat o ciemności pojawia się tylko wtedy, gdy noc naprawdę zabrała sztukę.
