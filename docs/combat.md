# Walka (Combat)

Przy przeszukaniu można natknąć się na wroga. Walka to dwie karty: wróg ciągnie kartę zagrożenia, użytkownik ją widzi i decyduje, czy uciec, czy pociągnąć własną kartę ciosu, i czym walczyć. Niepokonany wróg zostaje na mapie. Broń, z którą się walczy, i apteczki, którymi leczy się rany, opisuje [crafting.md](crafting.md).

Pomysł pochodzi z jednoosobowej gry w karty autora: ciągnie się kartę i decyduje, czy ciągnąć drugą (wyższa wygrywa, niższa przegrywa), czy spasować, co nie jest ani wygraną, ani przegraną.

Zasada ogólna: kara nigdy nie blokuje chodzenia ani przeszukiwania. Użytkownik nie ma punktów życia. Skutki porażki dotyczą zasobów w plecaku i towarzyszącego ocalałego.

## Wrogowie

| Wróg        | Gdzie                    | Talia zagrożenia | Atak | Strata przy ucieczce | Strata przy przegranej |
|-------------|--------------------------|------------------|------|----------------------|------------------------|
| Rat         | poza strefami radiacji   | 1–6              | 1    | 10%                  | 30%                    |
| Mutated Rat | w strefach radiacji      | 4–10             | 2    | 15%                  | 40%                    |

- Rodzaj nowego wroga zależy od tego, czy miejsce przeszukania leży w strefie radiacji (zob. [radiation.md](radiation.md)). Zmutowany szczur zdradza więc strefę także graczowi bez licznika Geigera.
- Atak wroga wpływa tylko na szansę zranienia towarzysza (zob. [Przegrana](#przegrana)).

## Spotkanie

- Przeszukanie, którego obszar obejmuje wroga pozostawionego na mapie (w promieniu 200 m od miejsca przeszukania), zawsze kończy się walką z nim. Gdy takich wrogów jest kilku, walczy się z najbliższym.
- Poza tym każde przeszukanie ma 5% szansy na spotkanie z nowym wrogiem. Spotkanie jest losowane przed zasobami.
- Wyjątek: przeszukanie, które kończy misję ratunkową, nigdy nie spotyka nowego wroga (zob. [landmarks.md](landmarks.md#ratunek)). Wróg pozostawiony na mapie może jednak blokować ratunek.
- Spotkanie może się zdarzyć także przy pełnym albo pustym plecaku.
- Obszar jest przeszukany bez względu na wynik spotkania.

## Karty

- Wróg ciągnie kartę zagrożenia ze swojej talii (zob. tabelę wrogów). Każde spotkanie, także z tym samym wrogiem, to nowa karta. Dzięki temu gracz nie utknie na wrogu, który raz wyciągnął wysoką kartę.
- Pod kartą zagrożenia jest krótki opis zależny od jej wartości, np. „Scrawny and limping” (Rat, 1–2) albo „Huge, foaming at the mouth” (Mutated Rat, 9–10).
- Okno walki pokazuje kartę zagrożenia, zakrytą kartę ciosu i listę wyborów:
  - każda broń w plecaku z premią i liczbą użyć, np. „Knife · +2 · 4/6 uses”, od najsilniejszej, a spośród takich samych od najbardziej zużytej,
  - **Bare hands** (+0),
  - **Run**.
- Aplikacja nie pokazuje szansy na wygraną w procentach. Gracz ocenia ją sam z kart i premii.
- Po wyborze broni (albo gołych rąk) karta ciosu odwraca się. Cios = karta 1–10 + premia broni:

| Broń          | Premia | Cios  |
|---------------|--------|-------|
| Bez broni     | +0     | 1–10  |
| Knife         | +2     | 3–12  |
| Combat knife  | +4     | 5–14  |

- Pod kartą ciosu widać, z czego się składa, np. „4 + 4 for the Combat knife”.

### Wynik

| Cios                   | Wynik     |
|------------------------|-----------|
| wyższy od zagrożenia   | wygrana   |
| równy zagrożeniu       | remis     |
| niższy od zagrożenia   | przegrana |

- Każda walka (wygrana, remis albo przegrana) zużywa jedno użycie wybranej broni. Nie zużywa jej tylko ucieczka.

## Ucieczka (Run)

- Ucieczka zawsze się udaje.
- Użytkownik gubi część zasobów z plecaka (procent zależy od wroga, zob. tabelę), zaokrągloną w dół, ale co najmniej 1 jednostkę. Przy pustym plecaku nic nie gubi.
- Gubione jednostki są losowane spośród wszystkich jednostek zasobów w plecaku. Przedmioty i podręczniki nigdy się nie gubią.
- Przeszukanie nic nie daje: nie ma zasobów, podręcznika ani landmarku.
- Ucieczka nie zużywa broni i nie rani ocalałego.
- Wróg zostaje na mapie.

## Wygrana

- Przeszukanie daje dwa razy więcej zasobów niż zwykle. Jeśli łup się nie mieści, obowiązuje zwykła zasada: reszta przepada.
- Podręcznik i landmark można znaleźć tak samo jak zwykle.
- Wróg znika z mapy.

## Remis

- Walka jest nierozstrzygnięta: użytkownik nic nie traci, ale przeszukanie nic nie daje (nie ma zasobów, podręcznika ani landmarku).
- Wróg zostaje na mapie.

## Przegrana

- Użytkownik gubi część zasobów z plecaka, tak jak przy ucieczce, ale większą (procent zależy od wroga, zob. tabelę).
- Przeszukanie nic nie daje: nie ma zasobów, podręcznika ani landmarku.
- Jeśli z użytkownikiem idzie ocalały, może zostać zraniony. Szansa = atak wroga / (atak wroga + obrona użytkownika). Obrona użytkownika wynosi na razie 1, więc dla Rat to 50%, a dla Mutated Rat ok. 67%.
- Wróg zostaje na mapie.

## Wrogowie na mapie

- Wróg, którego użytkownik nie pokonał (ucieczka, remis albo przegrana), zostaje na mapie na zawsze, w miejscu, w którym go spotkał.
- Na mapie wróg to ikona jego rodzaju na czerwonym kółku, żeby odróżniał się od landmarków.
- Znika dopiero po pokonaniu.
- Wróg stoi w środku przeszukanego obszaru, więc walka z nim jest możliwa dopiero, gdy ten obszar wygaśnie (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)).

## Rany

- Ranny może być tylko ocalały. Rana dotyczy ocalałego, który idzie z użytkownikiem, ale trwa dalej także po jego przybyciu do schronu.
- Rana goi się sama po 72 godzinach (czasu gry).
- Ranny ocalały idący z użytkownikiem zwiększa pojemność plecaka o 10 jednostek zamiast 30.
  - Jeśli po zranieniu zawartość plecaka przekracza pojemność, nic nie wypada, ale nic nie da się dołożyć, dopóki zawartość nie spadnie poniżej pojemności.
- Ranny ocalały w schronie je więcej (zob. [survivors.md](survivors.md)).
- Kolejna rana nie pogarsza stanu ocalałego, ale odnawia czas gojenia do 72 godzin.

### Leczenie

- Apteczka (First aid kit) leczy ranę od razu. Jedno użycie leczy jedną ranę, a u chorego ocalałego naraz także chorobę (zob. [radiation.md](radiation.md#choroba-sick)).
- Leczy się ręcznie, przyciskiem **Treat**:
  - ocalałego idącego z użytkownikiem apteczką z plecaka, w panelu plecaka,
  - ocalałego w schronie apteczką z magazynu, na jego plakietce w panelu schronu. Tu nie trzeba być w schronie.
- Przycisk jest nieaktywny, gdy pod ręką nie ma apteczki.

## Interfejs

- Po odwróceniu karty ciosu okno walki podsumowuje wynik, np. „You fought off the Rat: double loot!”, „A stalemate: the Rat holds its ground and stays on your map. You find nothing here.” albo „The Mutated Rat got the better of you and stays on your map. You lost 4 Junk and 2 Food.”, oraz informuje o zużytej broni. Okno zamyka przycisk **OK**.
- Po ucieczce komunikat mówi, co zgubiono, np. „You ran, dropping 1 Food. The Rat stays on your map.”
- Gdy użytkownik wraca do wroga z mapy, okno zaczyna się od „The Rat you met here is still around.”
- Odwrócenie karty ma krótką animację i dźwięk, a wynik własny dźwięk i wibrację (trafienie, szczęk ostrzy przy remisie, upadek przy przegranej).
- Ranny ocalały ma na plakietce oznaczenie „Wounded” i czas do zagojenia, np. „heals in 50 h”.
- Pasek stanu pokazuje, że towarzyszący ocalały jest ranny.
