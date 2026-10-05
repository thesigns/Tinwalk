# Landmarki i misje ratunkowe (Landmarks)

Przy przeszukiwaniu można czasem odkryć landmark, np. opuszczoną kopalnię albo wieżę obserwacyjną. Landmark zostaje na mapie na zawsze. Gdy w schronie stoi radio i są baterie (Cells), można nasłuchiwać wezwań o pomoc od rannych ocalałych, którzy czekają przy landmarkach. To jedyny sposób na zdobycie ocalałych.

## Landmarki

### Odkrywanie

- Landmarki czekają w wierzchołkach siatki heksagonalnej o boku 700 m, w miejscach, gdzie stykają się trzy heksy. Siatka jest rozłożona wokół schronu tak, że jeden wierzchołek wypada w środku schronu. W tym wierzchołku landmarku nie ma, więc najbliższe trzy są ok. 700 m od schronu.
- Siatka jest obrócona o kąt wyliczony z położenia schronu, żeby rzędy wierzchołków nie układały się wzdłuż ulic biegnących z północy na południe. Inaczej idąc prosto taką ulicą, można by przejść między rzędami i nic nie znaleźć.
- Przeszukanie zawsze odkrywa landmark, gdy w promieniu 200 m od miejsca przeszukania jest wierzchołek, w którym nikt jeszcze nie znalazł landmarku. Wierzchołki są 700 m od siebie, więc jedno przeszukanie odkrywa najwyżej jeden landmark.
- Landmark nie powstaje, gdy:
  - użytkownik porusza się szybciej niż 10 km/h,
  - przeszukanie zakończyło się ucieczką albo przegraną walką (zob. [combat.md](combat.md)).
- Wierzchołek czeka wtedy na kolejne przeszukanie.
- Landmark stoi dokładnie w miejscu, w którym użytkownik przeszukał obszar (tam, gdzie przeszukanie zostawia swój punkt), a nie w samym wierzchołku. Dzięki temu wiadomo, że da się tam bezpiecznie dojść pieszo, więc można wysyłać tam użytkownika na misje.
- Z tego samego powodu landmark nie powstaje przy szybszym ruchu. Inaczej przeszukanie z okna autobusu albo pociągu postawiłoby landmark na jezdni albo na torach. To zasada bezpieczeństwa, a nie ochrona przed oszukiwaniem.
- Prędkość pochodzi z pomiaru GPS. Gdy przeglądarka jej nie podaje, aplikacja liczy ją z pomiarów z ostatnich ok. 30 s. Gdy nie da się jej ustalić (np. jest tylko jeden pomiar), aplikacja przyjmuje, że użytkownik idzie.
- Skutki:
  - Godzinny spacer (ok. 4,5 km) w nowy teren daje zwykle 2–3 landmarki, a bez żadnego kończy się ok. 3% takich spacerów (symulacja). Spacer tam i z powrotem daje mniej, bo droga powrotna leży w przeszukanym obszarze.
  - Na trasie przebytej wcześniej nie ma już nic do znalezienia. Landmark jest nagrodą za odkrywanie nowych kierunków.
  - W promieniu 2 km od schronu jest 18 wierzchołków, a w promieniu 3 km 39.
- Landmarki odkryte przed wprowadzeniem siatki zajmują najbliższy wierzchołek, jeśli są od niego najwyżej 350 m. Pozostałe zostają na mapie jako dodatkowe.

### Rodzaje

Rodzaj landmarku jest losowany z listy dla biomu w miejscu odkrycia, z równymi wagami. Nazwy są ogólne, więc kilka landmarków może się nazywać tak samo.

| Plains          | Forest         | Ruins          |
|-----------------|----------------|----------------|
| Abandoned Mine  | Watchtower     | Pharmacy       |
| Farmstead       | Lean-to        | Gas Station    |
| Windmill        | Hunting Stand  | Police Station |
| Grain Silo      | Ranger Station | School         |
| Bus Wreck       | Bunker         | Water Tower    |
| Roadside Shrine | Plane Wreck    | Church         |

Każdy rodzaj ma własną ikonę.

### Na mapie

- Landmark jest na mapie małą ikoną swojego rodzaju, bez nazwy, żeby nie zaśmiecać mapy.
- Po odkryciu, za komunikatem o zasobach, aplikacja pokazuje komunikat, np. „You've discovered an Abandoned Mine”, a ikona zostaje wbita w mapę krótką animacją.
- Sam landmark nic nie daje. Odkrycie jest nagrodą samą w sobie, a landmark jest celem misji ratunkowych.

### Przeszukany landmark

- Landmark to punkt. Jest przeszukany, gdy leży wewnątrz aktywnego przeszukanego obszaru (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)).
- Tuż po odkryciu landmark jest przeszukany, bo leży w środku przeszukania, które go odkryło. Przestaje być przeszukany po 6 godzinach, razem z tym obszarem.

## Radio

Radio wytwarza się w schronie z Radio Manual (zob. [crafting.md](crafting.md)). Zostaje w schronie na zawsze.

Radio działa na baterie (Cells, zob. [loot.md](loot.md)). Zbudowanie radia nie daje baterii: trzeba je znaleźć na pustkowiu i rozładować w schronie.

### Nasłuch

- Gdy radio jest zbudowane, panel schronu ma sekcję **Radio** z przyciskiem **Listen**.
- Przycisk jest aktywny, gdy jednocześnie:
  - użytkownik jest w schronie,
  - z użytkownikiem nie idzie żaden ocalały,
  - nie trwa żadna misja ratunkowa,
  - od poprzedniego nasłuchu minęły co najmniej 4 godziny,
  - w magazynie schronu jest co najmniej 1 Cell (baterie w plecaku trzeba najpierw rozładować),
  - użytkownik zna co najmniej jeden landmark, który nie jest przeszukany.
- Gdy przycisk jest nieaktywny, aplikacja krótko mówi dlaczego, np. „Try again in 2 h”, „The radio is dead. Bring Cells to the shelter to power it.” albo „You know no landmarks to hear from”.
- Każdy nasłuch zużywa 1 Cell z magazynu, także ten, który kończy się „Only static”. To zamierzone: gra ma być wymagająca.
- Nasłuch trwa kilka sekund. Słychać szum, a potem przychodzi wynik: wezwanie albo „Only static”.

### Szansa na wezwanie

Szansa zależy od czasu, który minął od końca poprzedniej misji ratunkowej (udanej albo nie), a przed pierwszą misją od zbudowania radia:

| Czas         | Szansa |
|--------------|--------|
| 0–4 h        | 25%    |
| 4–8 h        | 50%    |
| 8–12 h       | 75%    |
| 12 h i więcej | 100%   |

- Kto po misji nasłuchuje uparcie co 4 godziny, dostaje kolejne wezwanie najpóźniej po 12 godzinach. Kto zagląda do radia raz dziennie, dostaje je za każdym razem.
- Szansa jest liczona od końca misji, a nie od wezwania. Inaczej po długiej misji następne wezwanie byłoby od razu pewne.
- Nieudany nasłuch nie zmienia szansy. Rośnie ona tylko z czasem.

## Misje ratunkowe

### Wezwanie

- Landmark jest losowany z równymi wagami spośród landmarków, które nie są przeszukane.
- Wezwanie pochodzi od ocalałego o losowym imieniu i podaje nazwę landmarku oraz jego odległość i kierunek od schronu (jeden z 8 kierunków), np. „This is Ada… I'm hurt… Abandoned Mine… 2.4 km north-east of your shelter… please hurry…”.
- Kierunek i odległość odróżniają landmarki o tej samej nazwie.
- Naraz trwa najwyżej jedna misja.

### W trakcie

- Na misję jest 24 godziny od wezwania (czasu gry).
- Cel misji jest na mapie zakreślony czerwonym ołówkiem. Mapy nie da się przesuwać, więc gdy cel jest poza ekranem, czerwona strzałka przy krawędzi mapy wskazuje kierunek.
- Pod kompasem leży notka z misją: kto czeka, przy jakim landmarku, jak daleko i w którą stronę od użytkownika oraz ile czasu zostało, np. „Ada · Abandoned Mine / 1.2 km NE · 18 h left”.

### Ratunek

- Misja się udaje, gdy po przeszukaniu cel leży w przeszukanym obszarze. Wystarczy więc przeszukać obszar w promieniu ok. 200 m od landmarku. Zlane obszary mogą sięgnąć nawet dalej.
- Takie przeszukanie nigdy nie kończy się spotkaniem z wrogiem: ranny nie przetrwałby w otoczeniu wrogów.
- Poza tym przeszukanie daje to co zwykle: zasoby i może dać podręcznik.
- Po komunikacie o zasobach użytkownik wybiera: **Take with you** albo **Leave**. Pozostawiony ocalały przepada. Misja kończy się w obu przypadkach.
- Uratowany ocalały jest ranny od chwili ratunku (zob. [combat.md](combat.md#rany)). Rana goi się po 72 godzinach albo od apteczki. Do tego czasu ocalały zwiększa pojemność plecaka tylko o 10 jednostek, a w schronie je 2 Food.

### Porażka

- Gdy minie 24 godziny, misja się kończy, a ocalały przepada. Aplikacja pokazuje komunikat, np. „The signal from the Abandoned Mine went silent”.
- Czas mija także przy zamkniętej aplikacji. Komunikat pojawia się po jej otwarciu.
- Landmark zostaje na mapie i może być celem kolejnych wezwań.
