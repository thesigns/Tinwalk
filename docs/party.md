# Drużyna (Party)

Użytkownik nie musi chodzić sam: ocaleni mogą iść z nim w drużynie. Drużyna zostaje razem między spacerami, dopóki użytkownik kogoś nie zostawi. Skąd biorą się ocaleni, opisuje [landmarks.md](landmarks.md), a ich życie w schronie [survivors.md](survivors.md).

## Skład

- Drużyna to użytkownik i ocaleni, którzy z nim idą.
- Na razie drużyna liczy najwyżej 2 osoby: użytkownika i jednego towarzysza. W przyszłości limit będzie rósł razem z rozwojem postaci użytkownika. Interfejs jest gotowy na drużynę do 4 osób (użytkownik i 3 towarzyszy).
- Do drużyny trafia ocalały uratowany w misji ratunkowej (**Take with you**) albo zabrany ze schronu (**Take**).
- Rozładunek (**Unload**) nie zmienia składu drużyny. Ocalały trafia do schronu tylko wtedy, gdy użytkownik go tam zostawi.

## Siła

- Każdy członek drużyny dodaje w walce swoją siłę do siły użytkownika (zob. [combat.md](combat.md#siła)).
- Na razie siła ocalałego wynosi 1d6, a użytkownika 2d6.
- Jednakowe kości się sumują: użytkownik z jednym towarzyszem ma 3d6, a z nożem 3d6+1d3.
- Każda rana odejmuje 1 od siły rannego, więc ciężko ranni zmniejszają siłę drużyny, np. użytkownik z ocalałym z 4 ranami ma 3d6-4 (zob. [combat.md](combat.md#rany)).

## Plecak

- Plecak mieści tyle, ile niesie cała drużyna. Każdy, użytkownik i każdy towarzysz, niesie 50 jednostek, mniej o 10 za każdą ranę (zob. [combat.md](combat.md#rany)). Zdrowa dwójka ma więc plecak 100.
- Gdy pojemność spadnie poniżej tego, co jest w plecaku, nadmiar wypada (zob. [combat.md](combat.md#wypadanie-z-plecaka)).

## Jedzenie

- Członkowie drużyny jedzą tak samo jak ocaleni w schronie: 1 Food raz na 24 godziny, chory 2 Food, z tymi samymi etapami głodu (zob. [survivors.md](survivors.md)). Głodny ranny się nie goi (zob. [combat.md](combat.md#gojenie)).
- Na pustkowiu jedzą Food z plecaka, a gdy użytkownik jest w schronie, z magazynu, razem z mieszkańcami schronu.
- Skażone jedzenie z plecaka może ich zarazić, tak samo jak jedzenie z magazynu (zob. [radiation.md](radiation.md#skażone-jedzenie)).
- Gdy minie ostatni etap głodu, członek drużyny odchodzi i przepada. Aplikacja pokazuje okno, np. „Ada left your party: there was no food.” Odchodzący zostaje w historii schronu.
- Uratowany ocalały jest najedzony w chwili ratunku.

## Zostawianie i zabieranie

- **Leave** (w schronie): ocalały zostaje w schronie i od tej chwili jest jednym z jego mieszkańców na zakładce **Shelter**. Jeśli nigdy wcześniej nie był w schronie, to jest data jego przybycia. To, co niósł i co już się nie mieści w plecaku, trafia do magazynu.
- **Abandon** (na pustkowiu): po potwierdzeniu w okienku, np. „Abandon Ada?”, ocalały zostaje sam na pustkowiu i przepada. Zostaje w historii schronu z powodem „abandoned”. To, co niósł i co już się nie mieści w plecaku, przepada.
- **Take** (w schronie): zabiera ocalałego ze schronu do drużyny, jeśli jest w niej miejsce.

## Ratunek przy pełnej drużynie

- Radio działa bez względu na to, ile osób jest w drużynie. Przed wyjściem na ratunek można kogoś zostawić w schronie.
- Gdy przeszukanie dociera do ocalałego z misji, a drużyna jest pełna, nie da się go zabrać. Okno „Survivor found!” mówi, że drużyna jest pełna, więc ocalały poczeka, ile czasu zostało i że można go zabrać ze strony drużyny. Misja trwa dalej.
- Od tej chwili ocalały jest znaleziony: gdy użytkownik stoi w promieniu 200 m od landmarku, strona drużyny pokazuje go pod nazwą landmarku z jego ikoną, z przyciskiem **Take**. Przycisk jest nieaktywny, dopóki drużyna jest pełna.
- Użytkownik może więc od razu kogoś porzucić i zabrać ocalałego, bez ponownego przeszukiwania. Może też odejść i wrócić później, póki trwa misja (48 godzin, zob. [landmarks.md](landmarks.md#misje-ratunkowe)). Zabranie ocalałego kończy misję tak samo jak **Take with you**: ocalały ma rany, z którymi wzywał pomocy, i jest najedzony.
- Kolejne przeszukanie przy landmarku, gdy w drużynie jest miejsce, też go znajduje i pokazuje zwykłe okno z **Take with you** i **Leave**.

## Interfejs

- Drużyna ma własną zakładkę. Zamiast nazwy pokazuje ikonę drużyny i liczbę osób w drużynie razem z użytkownikiem oraz limit, np. „1/2”. Bez imion, bo przy większych drużynach by się nie zmieściły.
- Zakładka otwiera stronę drużyny na całym obszarze pod paskami, zawsze na liście (nie na karcie osoby).
- Na górze strony jest nagłówek **Party** z liczbą osób i limitem, np. „2/2”, a pod nim lista: **You**, a dalej towarzysze z przyciskiem **Leave** w schronie albo **Abandon** na pustkowiu.
- Przy imieniu każda rana to kropelka krwi; kropelki na siebie nachodzą. Pod imieniem drobny druk mówi, co ważne: siłę już z ranami, a gdy trzeba, etap głodu i chorobę, np. „Strength 1d6-2 · Hungry · Sick”.
- Niżej są osoby z miejsca, w którym stoi użytkownik, z przyciskiem **Take**, nieaktywnym, gdy drużyna jest pełna:
  - w schronie: pod nazwą schronu z ikoną schronu jego mieszkańcy,
  - przy landmarku, przy którym czeka znaleziony ocalały z misji (zob. wyżej): pod nazwą landmarku z jego ikoną ten ocalały,
  - w przyszłości np. osady zakładane przez gracza.
- Każda osoba ma przycisk **Info**, który otwiera jej kartę na tej samej stronie, z powrotem przez „‹ Party”. Karta pokazuje, gdzie osoba jest (np. „In your party.”, „Waiting at the Windmill.”), i siłę w kościach z ranami i zakresem, np. 1d6-2 (od −1 do 4). U ocalałych z drużyny i ze schronu jest też plakietka z etapem głodu, ranami albo chorobą i przyciskiem **Treat**. Użytkownik ma plakietkę tylko z ranami, gdy je ma. Apteczka dla użytkownika i drużyny pochodzi z plecaka, a dla mieszkańców schronu z magazynu.
- W oknie walki kolumna użytkownika jest podpisana „Party”, gdy idzie z nim ktoś jeszcze, i pokazuje siłę całej drużyny.
- Zakładka **Backpack** mówi, kto idzie z użytkownikiem i ile miejsca dodaje, np. „Ada is with you: +30 space.”
