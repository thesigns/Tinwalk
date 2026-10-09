# Landmarki i misje ratunkowe (Landmarks)

Przy przeszukiwaniu można czasem odkryć landmark, np. opuszczoną kopalnię albo wieżę obserwacyjną. Landmark zostaje na mapie na zawsze. Gdy w schronie stoi radio i są baterie (Cells), można nasłuchiwać wezwań o pomoc od rannych ocalałych, którzy czekają przy landmarkach. To jedyny sposób na zdobycie ocalałych.

## Landmarki

### Odkrywanie

- Landmark może się pojawić przy co czwartym przeszukanym obszarze: gdy po przeszukaniu liczba aktywnych przeszukanych obszarów (razem z tym właśnie przeszukanym) dzieli się przez 4. Liczą się tylko obszary, które jeszcze nie wygasły (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)), więc spacer po ponad 6 godzinach przerwy zaczyna liczenie od nowa.
- Przy takim przeszukaniu landmark powstaje zawsze, chyba że:
  - w promieniu 600 m od miejsca przeszukania stoi już inny landmark albo schron,
  - użytkownik porusza się szybciej niż 12 km/h.
- Wtedy szansa przepada i następna przychodzi dopiero przy kolejnej wielokrotności 4.
- Wynik walki przy tym przeszukaniu nie ma znaczenia: landmark powstaje także po ucieczce albo przegranej, a jego karta pokazuje się przed oknem walki (zob. [combat.md](combat.md#interfejs)).
- Landmark stoi dokładnie w miejscu, w którym użytkownik przeszukał obszar (tam, gdzie przeszukanie zostawia swój punkt). Dzięki temu wiadomo, że da się tam bezpiecznie dojść pieszo, więc można wysyłać tam użytkownika na misje.
- Z tego samego powodu landmark nie powstaje przy szybszym ruchu. Inaczej przeszukanie z okna autobusu albo pociągu postawiłoby landmark na jezdni albo na torach. To zasada bezpieczeństwa, a nie ochrona przed oszukiwaniem.
- Prędkość pochodzi z pomiaru GPS. Gdy przeglądarka jej nie podaje, aplikacja liczy ją z pomiarów z ostatnich ok. 30 s. Gdy nie da się jej ustalić (np. jest tylko jeden pomiar), aplikacja przyjmuje, że użytkownik idzie.
- Skutki:
  - Przeszukania na trasie wypadają co ok. 200 m, więc szansa na landmark przychodzi mniej więcej co 800 m. Spacer 3 km w nowy teren daje zwykle 3 landmarki, a godzinny (ok. 4,5 km) 5 (symulacja). Spacer tam i z powrotem daje mniej, bo droga powrotna leży w przeszukanym obszarze.
  - Kto na spacerze przeszukuje mniej niż 4 obszary, nie znajdzie landmarku.
  - Landmarki stoją co najmniej 600 m od siebie, więc na trasie przebytej wcześniej z czasem nie ma już nic do znalezienia. Landmark jest nagrodą za odkrywanie nowych kierunków.

### Rodzaje

Rodzaj landmarku zależy od biomu w miejscu odkrycia i jest losowany „z worka”:

- Każdy biom ma własny worek ze wszystkimi swoimi rodzajami (zob. tabela). Odkrycie wyciąga z worka losowy rodzaj, więc dany rodzaj wraca dopiero po znalezieniu wszystkich pozostałych rodzajów tego biomu. Np. po Water Tower następna Water Tower trafi się dopiero po pięciu pozostałych landmarkach ruin.
- Pusty worek napełnia się od nowa. Pierwszy rodzaj z nowego worka nie może być tym, który był ostatni w poprzednim, więc ten sam rodzaj nigdy nie trafia się dwa razy pod rząd.
- Worki są zapisywane w stanie gry. Zapisy sprzed tej zasady zaczynają z pustymi workami.
- Nazwy są ogólne, więc kilka landmarków może się nazywać tak samo.

| Barrens         | Forest         | Ruins          |
|-----------------|----------------|----------------|
| Abandoned Mine  | Watchtower     | Pharmacy       |
| Farmstead       | Lean-to        | Gas Station    |
| Windmill        | Hunting Stand  | Police Station |
| Grain Silo      | Ranger Station | School         |
| Bus Wreck       | Bunker         | Water Tower    |
| Roadside Shrine | Plane Wreck    | Church         |
| Radio Mast      | Summer Camp    | Fairground     |
| Drive-in Cinema | Sawmill        | Supermarket    |
| Junkyard        | Cave           | Statue         |
| Lone Oak        | Giant Boulder  | Train Station  |

Każdy rodzaj ma własną ikonę w interfejsie, własną odznakę na mapie i własną dużą ilustrację na ekranie landmarku.

### Na mapie

- Landmark jest na mapie okrągłą odznaką swojego rodzaju (uproszczony, czytelny rysunek na papierowym krążku, z paskiem gruntu w kolorze biomu), bez nazwy, żeby nie zaśmiecać mapy. Odznaka ma stały rozmiar przy każdym zbliżeniu.
- Po odkryciu, jeszcze przed oknem walki i oknem ze znaleziskiem, odznaka zostaje wbita w mapę krótką animacją i otwiera się ekran landmarku (zob. niżej) z napisem „You've found a landmark!” zamiast daty ostatniej wizyty. Ten ekran zamyka się sam, gdy użytkownik odejdzie ponad 50 m od landmarku.
- Landmark pamięta, kiedy był ostatnio odwiedzony: przy odkryciu i przy każdym przeszukaniu, którego obszar go obejmuje (ten sam zasięg, który kończy misję ratunkową).
- Gdy przeszukanie z miejsca, w którym stoi użytkownik, objęłoby landmark, nad przyciskiem przeszukania widać podpowiedź, np. „Near the Police Station”. Ważniejsze podpowiedzi (słaby sygnał GPS, obszar już przeszukany) mają pierwszeństwo.
- Przeszukanie, którego obszar obejmuje landmark, daje około trzy razy więcej łupu, po trochu z każdego biomu (zob. [loot.md](loot.md#landmarki)). Dotyczy to także przeszukania, które landmark odkrywa. Landmark jest też celem misji ratunkowych.

### Ekran landmarku

- Tapnięcie w landmark na mapie otwiera jego ekran: dużą ilustrację, nazwę (np. „Gas Station”), drobnym drukiem, kiedy był ostatnio odwiedzony (np. „Last visited: 1d 23h ago”), i jedno zdanie o landmarku (flavor text, np. „Someone made a last stand here. The sandbags are still in place.”). Każdy rodzaj ma własne zdanie.
- Przycisk „Remove” trwale usuwa landmark z mapy, po potwierdzeniu w osobnym okienku. Miejsce zwalnia się dla nowych landmarków (zob. odstęp 600 m wyżej).
- Landmarku, przy którym czeka ocalały z trwającej misji, nie da się usunąć; ekran mówi wtedy, że ktoś tam czeka.
- „Close” zamyka ekran.

### Przeszukany landmark

- Landmark to punkt. Jest przeszukany, gdy leży wewnątrz aktywnego przeszukanego obszaru (zob. [bootstrap.md](bootstrap.md#przeszukiwanie-search-area)).
- Tuż po odkryciu landmark jest przeszukany, bo leży w środku przeszukania, które go odkryło. Przestaje być przeszukany po 6 godzinach, razem z tym obszarem.
- Przeszukany landmark nie daje potrójnego łupu, bo w przeszukanym obszarze nie da się przeszukiwać. Kto wraca do landmarku co 6 godzin, za każdym razem dostaje go od nowa.

## Radio

Radio wytwarza się w schronie z Radio Manual (zob. [crafting.md](crafting.md)). Zostaje w schronie na zawsze.

Radio działa na baterie (Cells, zob. [loot.md](loot.md)). Zbudowanie radia nie daje baterii: trzeba je zdobyć na pustkowiu i rozładować w schronie.

### Nasłuch

- Gdy radio jest zbudowane, zakładka **Shelter** ma sekcję **Radio** z przyciskiem **Listen**.
- Przycisk jest aktywny, gdy jednocześnie:
  - użytkownik jest w schronie,
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
- Wezwanie pochodzi od ocalałego o losowym imieniu, rannego: ma losowo od 1 do 4 ran (zob. [combat.md](combat.md#rany)). Wezwanie podaje nazwę landmarku oraz jego odległość i kierunek od schronu (jeden z 8 kierunków), np. „This is Ada… I'm hurt… Abandoned Mine… 2.4 km north-east of your shelter… please hurry…”.
- Kierunek i odległość odróżniają landmarki o tej samej nazwie.
- Naraz trwa najwyżej jedna misja.

### W trakcie

- Na misję jest 48 godzin od wezwania (czasu gry). Tyle, żeby przy pełnej drużynie zdążyć zrobić w niej miejsce i wrócić (zob. niżej).
- Cel misji jest na mapie zakreślony czerwonym ołówkiem. Gdy cel jest poza ekranem, czerwona strzałka przy krawędzi mapy wskazuje kierunek.
- Pod podziałką mapy (w lewym górnym rogu) leży notka z misją: kto czeka, przy jakim landmarku, jak daleko i w którą stronę od użytkownika oraz ile czasu zostało, np. „Ada · Abandoned Mine / 1.2 km NE · 18 h left”.

### Ratunek

- Misja się udaje, gdy po przeszukaniu cel leży w przeszukanym obszarze. Wystarczy więc przeszukać obszar w promieniu ok. 200 m od landmarku. Zlane obszary mogą sięgnąć nawet dalej.
- Takie przeszukanie nigdy nie spotyka nowego wroga: ranny nie przetrwałby w otoczeniu wrogów.
- Wróg pozostawiony na mapie w promieniu 200 m od celu przytrzymuje ocalałego: misja nie uda się, dopóki ten wróg nie zostanie pokonany (zob. [combat.md](combat.md#wrogowie-na-mapie)). Przeszukanie przy celu zaczyna się wtedy walką z nim. Wygrana kończy ratunek w tym samym przeszukaniu, a ucieczka albo przegrana nie. Przeszukany obszar wygasa po 6 godzinach, więc na kolejną próbę zostaje zwykle dość czasu z 48 godzin misji.
- Poza tym przeszukanie daje to co zwykle: zasoby i może dać podręcznik.
- Po zamknięciu okna ze znaleziskiem użytkownik wybiera: **Take with you** albo **Leave**. Ocalały dołącza do drużyny (zob. [party.md](party.md)). Pozostawiony ocalały przepada. Misja kończy się w obu przypadkach.
- Gdy drużyna jest pełna, ocalałego nie da się zabrać. Okno mówi, że ocalały poczeka, a misja trwa dalej. Ocalały jest już znaleziony: można go zabrać ze strony drużyny, stojąc przy landmarku, gdy w drużynie zrobi się miejsce, póki nie minie czas misji (zob. [party.md](party.md#ratunek-przy-pełnej-drużynie)).
- Uratowany ocalały ma rany, z którymi wzywał pomocy. Okno ratunku mówi ile i co to znaczy, np. „2 wounds: strength 1d6-2, carries 30.” Rany goją się po jednej co 24 godziny, gdy ocalały jest najedzony, albo od apteczki (zob. [combat.md](combat.md#rany)).

### Porażka

- Gdy minie 48 godzin, misja się kończy, a ocalały przepada. Aplikacja pokazuje komunikat, np. „The signal from the Abandoned Mine went silent”.
- Czas mija także przy zamkniętej aplikacji. Komunikat pojawia się po jej otwarciu.
- Landmark zostaje na mapie i może być celem kolejnych wezwań.
