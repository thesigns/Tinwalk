# Walka (Combat)

Przy przeszukaniu można natknąć się na wroga. Walka to rzut kośćmi przeciw rzutowi kośćmi: wróg pokazuje swoją siłę, użytkownik ucieka albo sięga po broń, potem wróg rzuca atak, a użytkownik ucieka albo kontratakuje. Niepokonany wróg zostaje na mapie. Broń, z którą się walczy, i apteczki, którymi leczy się rany, opisuje [crafting.md](crafting.md).

Zasada ogólna: kara nigdy nie blokuje chodzenia ani przeszukiwania. Użytkownik nie ma punktów życia. Skutkiem przegranej są rany (zob. [Rany](#rany)), a skutkiem ucieczki utrata zasobów z plecaka.

## Siła

Siłę zapisuje się jak rzut kośćmi w grach fabularnych: `xdy+z`, czyli x rzutów kością o y ściankach plus z (z może być ujemne albo go nie być). Na przykład `2d6-2` to suma dwóch kości sześciennych minus 2. Podobnie jak talia kart siła wyznacza zakres wyników, ale rozkład nie musi być płaski: kilka kości daje wyniki skupione wokół środka (słabszy, ale przewidywalny przeciwnik), jedna kość daje każdy wynik równie często (bardziej nieprzewidywalny).

- Siła użytkownika wynosi na razie 2d6 (2–12).
- Każda rana odejmuje 1 od siły rannego, np. użytkownik z 2 ranami ma 2d6-2 (0–10) (zob. [Rany](#rany)).
- Każdy ocalały w drużynie dodaje swoją siłę, na razie 1d6 (zob. [party.md](party.md#siła)). Jednakowe kości się sumują, np. użytkownik z towarzyszem ma 3d6 (3–18). Siła w oknie walki, w tym przy wyborze broni, to siła całej drużyny. Ciężko ranni mogą ją zmniejszać: ranny bardziej przeszkadza, niż pomaga, np. ocalały z 4 ranami ma 1d6-4 (od −3 do 2).
- Broń do walki wręcz dodaje własne kości (zob. [Broń](#broń)).

## Wrogowie

| Wróg        | Gdzie                    | Siła  | Zakres | Skarb                |
|-------------|--------------------------|-------|--------|----------------------|
| Rat         | poza strefami radiacji   | 2d3   | 2–6    | 1 Junk + 1 Food      |
| Mutated Rat | w strefach radiacji      | 1d6+2 | 3–8    | 1 Junk + 1 Isotope   |
| Mosquidrone | wszędzie                 | 1d6   | 1–6    | 1 Junk + 1 Cell      |

- Szczury i Mosquidrone są celowo słabe: to przeciwnicy na początek gry.
- Mosquidrone to przedwojenny dron do zwalczania szkodników, zbudowany jak komar. Jedna kość czyni go nieprzewidywalnym: bywa słabszy od szczura, bywa groźniejszy. Jest źródłem Cells (baterii), więc lata wszędzie, także w strefach radiacji.
- Połowa nowych wrogów to Mosquidrone. Reszta to szczury, a w strefie radiacji zmutowane szczury (zob. [radiation.md](radiation.md)). Zmutowany szczur zdradza więc strefę także graczowi bez licznika Geigera.

### Rój

„Where there's one, there are more”: drony latają rojami.

- Spotkanie Mosquidrone (nowego albo pozostawionego na mapie) zapamiętuje miejsce spotkania, bez względu na wynik walki.
- Następne przeszukanie w promieniu 500 m od tego miejsca ma 60% szansy na wroga zamiast 12%, a jeśli wróg się pojawi, to zawsze Mosquidrone.
- Rój działa tylko przy jednym, następnym przeszukaniu, także gdy wypada ono dalej niż 500 m (wtedy rój po prostu znika). Kolejny dron zapamiętuje nowe miejsce, więc rój może trwać przez kilka przeszukań z rzędu. Średnio rój daje ok. 2,5 drona (symulacja). Wysoka szansa jest w porządku, bo gracz zawsze może wyjść z roju, odchodząc ponad 500 m.
- Gdy przeszukanie z miejsca, w którym stoi użytkownik, wypadłoby w roju, nad przyciskiem przeszukania widać podpowiedź „Something is whining nearby”. Gracz może więc świadomie wejść w rój po baterie albo go ominąć. Podpowiedzi o słabym sygnale i przeszukanym obszarze mają pierwszeństwo, a podpowiedź o landmarku ustępuje tej o roju.
- Miejsce roju jest zapisywane w stanie gry.

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

- Wróg zadaje jedną ranę losowej osobie z drużyny, także użytkownikowi, każdemu z równą szansą (zob. [Rany](#rany)).
- Użytkownik nie traci niczego z plecaka, chyba że po ranie plecak mieści mniej, niż w nim jest. Wtedy nadmiar wypada (zob. [Wypadanie z plecaka](#wypadanie-z-plecaka)).
- Przeszukanie nic nie daje: nie ma zasobów ani podręcznika.
- Wróg zostaje na mapie.

## Wrogowie na mapie

- Wróg, którego użytkownik nie pokonał (ucieczka albo przegrana), zostaje na mapie na zawsze, w miejscu, w którym go spotkał.
- Na mapie wróg to odznaka jego rodzaju na czerwonym tle, żeby odróżniał się od landmarków na papierze (`img/enemy-icons/<rodzaj>.svg`, tak jak odznaki landmarków).
- Znika dopiero po pokonaniu.
- Stuknięcie odznaki wroga otwiera jego kartę: ilustrację, nazwę, opis i siłę w kostkach z zakresem, tak jak przed rzutem w walce, np. 2d3 i (2–6), oraz przycisk **Close**. Dzięki temu można ocenić wroga, zanim się do niego wróci. Wrogowie są rysowani nad landmarkami, więc gdy odznaki się nakładają, stuknięcie trafia we wroga.
- Wróg stoi w środku przeszukanego obszaru, więc walka z nim jest możliwa dopiero, gdy ten obszar wygaśnie (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)).

## Rany

- Ranni mogą być wszyscy: użytkownik i ocaleni. Rany się liczy.
- Rany zadaje wróg po przegranej walce (zob. [Przegrana](#przegrana)). Uratowany ocalały ma też rany, z którymi wzywał pomocy: losowo od 1 do 4 (zob. [landmarks.md](landmarks.md#ratunek)).
- Każda osoba może mieć najwyżej 4 rany:
  - ocalały, który dostaje piątą ranę, ginie. Odchodzi z drużyny i zostaje w historii schronu z powodem „killed”;
  - użytkownik, który dostaje piątą ranę, nadal ma 4 rany. Nie ginie.
- Każda rana:
  - odejmuje 1 od siły rannego w walce (zob. [Siła](#siła)),
  - zmniejsza o 10 jednostek to, co ranny może nieść. Zdrowa osoba niesie 50 jednostek, a z 4 ranami tylko 10 (zob. [party.md](party.md#plecak)). Na przykład użytkownik i ocalały, obaj z 4 ranami, mają razem plecak 10 + 10 = 20.
- Rana nie zmienia jedzenia: ranny je 1 Food jak każdy (zob. [survivors.md](survivors.md)).
- Rana trwa bez względu na to, czy ocalały jest w drużynie, czy w schronie.

### Gojenie

- Rany goją się same, po jednej: każda po 24 godzinach (czasu gry).
- Ocalały goi się tylko wtedy, gdy jest najedzony (Satiated). Gdy jest głodny albo głoduje, gojenie stoi, a po posiłku rusza dalej od miejsca, w którym stanęło.
- Użytkownik nie ma głodu, więc jego rany goją się zawsze.

### Leczenie

- Apteczka (First aid kit) leczy od razu jedną ranę. Gdy ranny jest też chory, jedno użycie leczy najpierw ranę, a dopiero gdy ran już nie ma, chorobę (zob. [radiation.md](radiation.md#choroba-sick)).
- Leczy się ręcznie, przyciskiem **Treat**:
  - użytkownika i ocalałego w drużynie apteczką z plecaka, na karcie osoby na stronie drużyny (zob. [party.md](party.md#interfejs)),
  - ocalałego w schronie apteczką z magazynu, na jego plakietce na zakładce **Shelter**. Tu nie trzeba być w schronie.
- Przycisk jest nieaktywny, gdy pod ręką nie ma apteczki.

### Wypadanie z plecaka

- Plecak mieści tyle, ile niesie cała drużyna. Gdy ta pojemność spadnie poniżej tego, co jest w plecaku, nadmiar wypada od razu. Dzieje się tak po ranie, po śmierci ocalałego i gdy ktoś opuszcza drużynę (zostawiony w schronie, porzucony albo odchodzący z głodu).
- Wypadają najpierw najlżejsze rzeczy, a spośród jednakowo lekkich losowo: najpierw zasoby (po 1 jednostce), potem przedmioty i podręczniki od najmniejszych.
- Na pustkowiu to, co wypadło, przepada. W schronie trafia do magazynu.
- Ucieczka (zob. [Ucieczka](#ucieczka-run)) nadal kosztuje 10% albo 20% zasobów, co najmniej 1 jednostkę.

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
- Po przegranej komunikat mówi, kogo wróg zranił i co wypadło z plecaka, np. „It wounded Ada. 8 Junk fell out of your backpack.”, „It wounded you.” albo „It struck Ada, who didn't make it.”
- Rany oznaczają kropelki krwi przy imieniu, po jednej na ranę, nachodzące na siebie: na liście drużyny, na plakietkach w schronie i na karcie osoby.
- Plakietka rannego mówi, ile ma ran i kiedy zagoi się następna, np. „2 wounds · one heals in 14 h”, a gdy jest głodny, „not healing while hungry”.
