# Walka (Combat)

Przy przeszukaniu można natknąć się na wroga. Użytkownik wybiera, czy walczyć, czy uciekać. Broń, z którą się walczy, i apteczki, którymi leczy się rany, opisuje [crafting.md](crafting.md).

Zasada ogólna: kara nigdy nie blokuje chodzenia ani przeszukiwania. Użytkownik nie ma punktów życia. Skutki porażki dotyczą zasobów w plecaku i towarzyszącego ocalałego.

## Wrogowie

| Wróg       | Atak | Obrona | Strata przy ucieczce | Strata przy przegranej |
|------------|------|--------|----------------------|------------------------|
| Giant Rat  | 1    | 1      | 10%                  | 30%                    |

## Spotkanie

- Każde przeszukanie ma 5% szansy na spotkanie z wrogiem. Spotkanie jest losowane przed zasobami.
- Wyjątek: przeszukanie, które kończy misję ratunkową, nigdy nie kończy się spotkaniem (zob. [landmarks.md](landmarks.md#ratunek)).
- Spotkanie może się zdarzyć także przy pełnym albo pustym plecaku.
- Aplikacja pokazuje okno z wrogiem, szansą na wygraną (w procentach), bronią, której użytkownik użyje, i dwoma przyciskami: **Fight** i **Run**.
- Obszar jest przeszukany bez względu na wynik spotkania.

## Ucieczka (Run)

- Ucieczka zawsze się udaje.
- Użytkownik gubi część zasobów z plecaka (procent zależy od wroga, zob. tabelę), zaokrągloną w dół, ale co najmniej 1 jednostkę. Przy pustym plecaku nic nie gubi.
- Gubione jednostki są losowane spośród wszystkich jednostek zasobów w plecaku. Przedmioty i podręczniki nigdy się nie gubią.
- Przeszukanie nic nie daje: nie ma zasobów, podręcznika ani landmarku.
- Ucieczka nie zużywa broni i nie rani ocalałego.

## Walka (Fight)

- Atak użytkownika zależy od broni:

| Broń          | Atak | Szansa z Giant Rat |
|---------------|------|--------------------|
| Bez broni     | 1    | 50%                |
| Knife         | 3    | 75%                |
| Combat knife  | 9    | 90%                |

- Szansa na wygraną = atak użytkownika / (atak użytkownika + obrona wroga).
- Użytkownik walczy najsilniejszą bronią w plecaku. Spośród kilku takich samych wybierana jest ta z najmniejszą liczbą użyć, żeby zużywać je po kolei.
- Każda walka zużywa jedno użycie broni, bez względu na wynik.
- Obrona użytkownika wynosi na razie 1.

### Wygrana

- Przeszukanie daje dwa razy więcej zasobów niż zwykle. Jeśli łup się nie mieści, obowiązuje zwykła zasada: reszta przepada.
- Podręcznik i landmark można znaleźć tak samo jak zwykle.

### Przegrana

- Użytkownik gubi część zasobów z plecaka, tak jak przy ucieczce, ale większą (procent zależy od wroga, zob. tabelę).
- Przeszukanie nic nie daje: nie ma zasobów, podręcznika ani landmarku.
- Jeśli z użytkownikiem idzie ocalały, może zostać zraniony. Szansa = atak wroga / (atak wroga + obrona użytkownika), dla Giant Rat 50%.

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

- Ranny ocalały ma na plakietce oznaczenie „Wounded” i czas do zagojenia, np. „heals in 50 h”.
- Pasek stanu pokazuje, że towarzyszący ocalały jest ranny.
- Po walce komunikat podsumowuje wynik, np. „You fought off the Giant Rat”, „The Giant Rat got the better of you. You lost 4 Junk and 2 Food” albo „You ran, dropping 1 Food”.
