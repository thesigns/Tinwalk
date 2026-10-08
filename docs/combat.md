# Walka (Combat)

Przy przeszukaniu można natknąć się na wroga. Walka to rzut kośćmi przeciw rzutowi kośćmi: wróg pokazuje swoją siłę, użytkownik ucieka albo sięga po broń, potem wróg rzuca atak, a użytkownik ucieka albo kontratakuje. Niepokonany wróg zostaje na mapie. Broń, z którą się walczy, i apteczki, którymi leczy się rany, opisuje [crafting.md](crafting.md).

Zasada ogólna: kara nigdy nie blokuje chodzenia ani przeszukiwania. Użytkownik nie ma punktów życia. Skutki porażki dotyczą zasobów w plecaku.

## Siła

Siłę zapisuje się jak rzut kośćmi w grach fabularnych: `xdy+z`, czyli x rzutów kością o y ściankach plus z (z może być ujemne albo go nie być). Na przykład `2d6-2` to suma dwóch kości sześciennych minus 2. Podobnie jak talia kart siła wyznacza zakres wyników, ale rozkład nie musi być płaski: kilka kości daje wyniki skupione wokół środka (słabszy, ale przewidywalny przeciwnik), jedna kość daje każdy wynik równie często (bardziej nieprzewidywalny).

- Siła użytkownika wynosi na razie 2d6 (2–12).
- Broń do walki wręcz dodaje własne kości (zob. [Broń](#broń)).

## Wrogowie

| Wróg        | Gdzie                    | Siła  | Zakres | Skarb                |
|-------------|--------------------------|-------|--------|----------------------|
| Rat         | poza strefami radiacji   | 2d3   | 2–6    | 1 Junk + 1 Food      |
| Mutated Rat | w strefach radiacji      | 1d6+2 | 3–8    | 1 Junk + 1 Isotope   |

- Szczury są celowo słabe: to przeciwnicy na początek gry.
- Rodzaj nowego wroga zależy od tego, czy miejsce przeszukania leży w strefie radiacji (zob. [radiation.md](radiation.md)). Zmutowany szczur zdradza więc strefę także graczowi bez licznika Geigera.

## Broń

| Broń          | Premia | Siła z bronią | Zakres |
|---------------|--------|---------------|--------|
| Bez broni     | –      | 2d6           | 2–12   |
| Knife         | 1d3    | 2d6+1d3       | 3–15   |
| Combat knife  | 1d5    | 2d6+1d5       | 3–17   |

- Broń zużywa jedno użycie tylko wtedy, gdy użytkownik nią zaatakuje (wygrana czy przegrana). Sięgnięcie po broń i ucieczka jej nie zużywają.

## Spotkanie

- Przeszukanie, którego obszar obejmuje wroga pozostawionego na mapie (w promieniu 200 m od miejsca przeszukania), zawsze kończy się walką z nim. Gdy takich wrogów jest kilku, walczy się z najbliższym.
- Poza tym każde przeszukanie ma 12% szansy na spotkanie z nowym wrogiem (średnio raz na ok. 8 przeszukań, czyli mniej więcej co 1,7 km marszu). Spotkanie jest losowane przed zasobami.
- Wyjątek: przeszukanie, które kończy misję ratunkową, nigdy nie spotyka nowego wroga (zob. [landmarks.md](landmarks.md#ratunek)). Wróg pozostawiony na mapie może jednak blokować ratunek.
- Spotkanie może się zdarzyć także przy pełnym albo pustym plecaku.
- Obszar jest przeszukany bez względu na wynik spotkania.
- Landmark odkryty przy tym przeszukaniu powstaje bez względu na wynik walki (zob. [landmarks.md](landmarks.md#odkrywanie)).

## Przebieg walki

1. **Wróg się pokazuje.** Okno walki pokazuje wroga i jego siłę (np. 2d3, a pod spodem zakres 2–6). Siła użytkownika to znak zapytania, dopóki nie wybierze broni, a gdy w plecaku nie ma broni, od razu 2d6. Wybory:
   - **Reach for a weapon**, czyli sięgnięcie po broń. Gdy w plecaku nie ma broni, ten przycisk to od razu **Fight bare-handed** (2d6) i krok 2 jest pomijany.
   - **Run**: ucieczka za 10% zasobów z plecaka.
2. **Wybór broni.** Lista: każda broń w plecaku z siłą i liczbą użyć, np. „Knife · 2d6+1d3 · 4/6 uses”, od najsilniejszej, a spośród takich samych od najbardziej zużytej, oraz **Bare hands** (2d6). Tu nie da się uciec.
3. **Wróg atakuje.** Wróg rzuca swoimi kośćmi i w miejscu jego siły pojawia się wynik. Po stronie użytkownika widać jego siłę z wybraną bronią, np. 2d6+1d3 (3–15). Wybory:
   - **Attack**: kontratak.
   - **Run**: ucieczka, teraz już za 20% zasobów z plecaka.
4. **Rozstrzygnięcie.** Użytkownik rzuca swoją siłą i w miejscu jego siły pojawia się wynik.

| Rzut użytkownika        | Wynik     |
|-------------------------|-----------|
| wyższy od ataku wroga   | wygrana   |
| równy albo niższy       | przegrana |

- Każde spotkanie, także z tym samym wrogiem, to nowy rzut. Dzięki temu gracz nie utknie na wrogu, który raz wyrzucił dużo.
- Aplikacja nie pokazuje szansy na wygraną w procentach. Gracz ocenia ją sam z zapisu kości i zakresu.
- Przycisk **Run** mówi, ile jednostek zasobów kosztuje ucieczka, np. „drop 3 supplies”, a przy pustym plecaku „nothing to drop”.

## Ucieczka (Run)

- Ucieczka zawsze się udaje.
- Użytkownik gubi 10% zasobów z plecaka, jeśli ucieka przed atakiem wroga (krok 1), albo 20%, jeśli już po nim (krok 3). Wynik jest zaokrąglany w dół, ale wynosi co najmniej 1 jednostkę. Przy pustym plecaku użytkownik nic nie gubi.
- Gubione jednostki są losowane spośród wszystkich jednostek zasobów w plecaku. Przedmioty i podręczniki nigdy się nie gubią.
- Przeszukanie nic nie daje: nie ma zasobów ani podręcznika.
- Wróg zostaje na mapie.

## Wygrana

- Przeszukanie daje zwykłe zasoby, a do tego skarb wroga (zob. tabelę wrogów).
- Skarb trafia do plecaka po zasobach z przeszukania. Jeśli się nie mieści, obowiązuje zwykła zasada: reszta przepada.
- Podręcznik można znaleźć tak samo jak zwykle.
- Wróg znika z mapy.

## Przegrana

- Użytkownik gubi 40% zasobów z plecaka, bez względu na wroga, zaokrąglone w dół, ale co najmniej 1 jednostkę, tak jak przy ucieczce.
- Przeszukanie nic nie daje: nie ma zasobów ani podręcznika.
- Wróg zostaje na mapie.

## Wrogowie na mapie

- Wróg, którego użytkownik nie pokonał (ucieczka albo przegrana), zostaje na mapie na zawsze, w miejscu, w którym go spotkał.
- Na mapie wróg to odznaka jego rodzaju na czerwonym tle, żeby odróżniał się od landmarków na papierze (`img/enemy-icons/<rodzaj>.svg`, tak jak odznaki landmarków).
- Znika dopiero po pokonaniu.
- Stuknięcie odznaki wroga otwiera jego kartę: ilustrację, nazwę, opis i siłę w kostkach z zakresem, tak jak przed rzutem w walce, np. 2d3 i (2–6), oraz przycisk **Close**. Dzięki temu można ocenić wroga, zanim się do niego wróci. Wrogowie są rysowani nad landmarkami, więc gdy odznaki się nakładają, stuknięcie trafia we wroga.
- Wróg stoi w środku przeszukanego obszaru, więc walka z nim jest możliwa dopiero, gdy ten obszar wygaśnie (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)).

## Rany

- W walce nikt nie zostaje ranny. Ranny jest ocalały uratowany w misji ratunkowej: od chwili ratunku (zob. [landmarks.md](landmarks.md#ratunek)).
- Rana dotyczy ocalałego, który idzie z użytkownikiem, ale trwa dalej także po jego przybyciu do schronu.
- Rana goi się sama po 72 godzinach (czasu gry).
- Ranny ocalały idący z użytkownikiem zwiększa pojemność plecaka o 10 jednostek zamiast 30.
  - Jeśli po zranieniu zawartość plecaka przekracza pojemność, nic nie wypada, ale nic nie da się dołożyć, dopóki zawartość nie spadnie poniżej pojemności.
- Ranny ocalały w schronie je więcej (zob. [survivors.md](survivors.md)).
- Kolejna rana nie pogarsza stanu ocalałego, ale odnawia czas gojenia do 72 godzin.

### Leczenie

- Apteczka (First aid kit) leczy ranę od razu. Jedno użycie leczy jedną ranę, a u chorego ocalałego naraz także chorobę (zob. [radiation.md](radiation.md#choroba-sick)).
- Leczy się ręcznie, przyciskiem **Treat**:
  - ocalałego idącego z użytkownikiem apteczką z plecaka, na zakładce **You** albo w panelu plecaka,
  - ocalałego w schronie apteczką z magazynu, na jego plakietce na zakładce **Shelter**. Tu nie trzeba być w schronie.
- Przycisk jest nieaktywny, gdy pod ręką nie ma apteczki.

## Interfejs

- Kolejność okien po przeszukaniu:
  1. karta nowego landmarku, jeśli przeszukanie go odkryło,
  2. okno walki, jeśli przeszukanie spotkało wroga,
  3. okno ze znaleziskiem z przeszukania, po wygranej także ze skarbem wroga. Po ucieczce albo przegranej się nie pokazuje.
  4. Dalej, jak zwykle, ratunek ocalałego i podręcznik.
- Okno walki przypomina układem kartę landmarku: na górze ilustracja wroga w medalionie (`img/enemies/<rodzaj>.svg`, nieco mniejsza niż landmarku, żeby zmieściła się walka), pod nią nazwa wroga i jego opis kursywą, wszystko wyśrodkowane.
- Niżej są dwie kolumny podpisane nazwą wroga i „You”. Przed rzutem każda pokazuje na szaro siłę, a pod nią zakres, np. 2d3 i (2–6). U użytkownika, który ma broń do wyboru, zamiast siły jest znak zapytania, dopóki jej nie wybierze. Po rzucie w miejscu siły pojawia się duży wynik: u wroga czerwony, u użytkownika czarny.
- Nad przyciskami jest krótki komunikat, np. „Fight or run?”, „What do you fight with?”, „The Rat attacks! Strike back or run?”.
- Po rozstrzygnięciu okno podsumowuje wynik, np. „You beat the Rat.”, „A tie goes to the Rat, and it stays on your map.” albo „The Mutated Rat got the better of you and stays on your map. You lost 4 Junk and 2 Food.”, oraz informuje o zużytej broni. Okno zamyka przycisk **OK**.
- Po wygranej okno ze znaleziskiem ma pod zasobami z przeszukania sekcję „The Rat's stash” z żetonami tego, co zabrano, np. „+1 Junk” i „+1 Food”. Zasób, który się nie zmieścił, ma wyblakły żeton „+0”, a uwaga pod znaleziskiem mówi „You had no room for all of its stash.” albo „You had no room for its stash.”
- Po ucieczce komunikat mówi, co zgubiono, np. „You ran, dropping 1 Food. The Rat stays on your map.”
- Pojawienie się rzutu ma krótką animację i dźwięk, a wynik walki własny dźwięk i wibrację (trafienie, upadek przy przegranej).
- Ranny ocalały ma na plakietce oznaczenie „Wounded” i czas do zagojenia, np. „heals in 50 h”.
- Pasek stanu pokazuje, że towarzyszący ocalały jest ranny.
