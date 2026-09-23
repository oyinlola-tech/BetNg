"""Player name pools by nationality.

A squad is drawn from the country of its club's league plus a foreign mix,
because European league football is cosmopolitan: a Premier League side is
mostly-but-not-only English. The domestic share is roughly what the real
leagues field, so the names read as plausible rather than uniform.

Names are ordinary and common on purpose. They are generated people, and a
squad should not accidentally field a recognisable professional.
"""

from __future__ import annotations

from typing import Final

NamePool = tuple[tuple[str, ...], tuple[str, ...]]

ENGLAND: Final[NamePool] = (
    (
        "Alfie", "Archie", "Ben", "Callum", "Charlie", "Connor", "Dan", "Dean",
        "Declan", "Elliot", "Finley", "George", "Harry", "Jack", "Jamie",
        "Jordan", "Josh", "Kyle", "Lewis", "Liam", "Luke", "Mason", "Nathan",
        "Oliver", "Ollie", "Owen", "Reece", "Rhys", "Ryan", "Sam", "Scott",
        "Sonny", "Theo", "Toby", "Tom", "Tyler", "Will", "Zac",
    ),
    (
        "Ashworth", "Bailey", "Barlow", "Bennett", "Blackwood", "Bradshaw",
        "Brooks", "Carlisle", "Chambers", "Clarke", "Coleman", "Dawson",
        "Ellery", "Fairbrother", "Fletcher", "Gallagher", "Granger", "Hadley",
        "Hartley", "Hawkins", "Hollis", "Kendrick", "Lambert", "Lockwood",
        "Maddox", "Marsden", "Mercer", "Norris", "Oakley", "Pemberton",
        "Prescott", "Radford", "Rowntree", "Sinclair", "Stoddart", "Thornley",
        "Vickers", "Waddington", "Whitlock", "Yardley",
    ),
)

SPAIN: Final[NamePool] = (
    (
        "Adrián", "Aitor", "Álvaro", "Andrés", "Ángel", "Antonio", "Borja",
        "Bruno", "Carlos", "Daniel", "David", "Diego", "Eduardo", "Fernando",
        "Gonzalo", "Guillermo", "Hugo", "Iker", "Iván", "Javier", "Jorge",
        "José", "Juan", "Luis", "Manuel", "Marcos", "Mario", "Miguel", "Nacho",
        "Óscar", "Pablo", "Pau", "Pedro", "Rafael", "Raúl", "Rubén", "Sergio",
        "Unai", "Víctor", "Xavi",
    ),
    (
        "Aguilar", "Alarcón", "Arrieta", "Ballesteros", "Barreda", "Bermúdez",
        "Cabrera", "Campos", "Carrasco", "Cazorla", "Delgado", "Escudero",
        "Fuentes", "Gallardo", "Garrido", "Gutiérrez", "Herrera", "Iglesias",
        "Jiménez", "Lorente", "Maldonado", "Marchena", "Mendieta", "Montero",
        "Navarro", "Nieto", "Olmedo", "Ortega", "Pardo", "Peñalver", "Quintana",
        "Redondo", "Reyes", "Salinas", "Sanchís", "Sarabia", "Trujillo",
        "Valverde", "Vidal", "Zamorano",
    ),
)

ITALY: Final[NamePool] = (
    (
        "Alessandro", "Andrea", "Antonio", "Christian", "Claudio", "Daniele",
        "Davide", "Diego", "Edoardo", "Emanuele", "Enrico", "Fabio",
        "Federico", "Filippo", "Francesco", "Gabriele", "Giacomo", "Gianluca",
        "Giovanni", "Giulio", "Leonardo", "Lorenzo", "Luca", "Marco", "Mattia",
        "Michele", "Nicolò", "Paolo", "Pietro", "Riccardo", "Roberto",
        "Salvatore", "Samuele", "Simone", "Stefano", "Tommaso", "Valerio",
        "Vincenzo",
    ),
    (
        "Amoruso", "Balzaretti", "Bernardeschi", "Bonucci", "Calabria",
        "Candreva", "Caputo", "Cassano", "Colombo", "Conti", "Cristante",
        "D'Ambrosio", "Del Piero", "Esposito", "Ferrara", "Fiorentino",
        "Gagliardini", "Gattuso", "Grimaldo", "Lazzari", "Lombardi", "Mancini",
        "Marchetti", "Marchisio", "Meret", "Montolivo", "Nainggolan",
        "Orsolini", "Pellegrini", "Peruzzi", "Pinamonti", "Ranocchia",
        "Rosati", "Scamacca", "Sorrentino", "Tonali", "Vanoli", "Verratti",
        "Zaccagni", "Zappacosta",
    ),
)

FRANCE: Final[NamePool] = (
    (
        "Alexandre", "Antoine", "Baptiste", "Benjamin", "Clément", "Corentin",
        "Cyril", "Damien", "Dimitri", "Enzo", "Étienne", "Florian", "Gaël",
        "Guillaume", "Hugo", "Jonathan", "Jules", "Julien", "Kévin", "Léo",
        "Loïc", "Lucas", "Ludovic", "Mathias", "Matteo", "Maxime", "Nicolas",
        "Olivier", "Quentin", "Raphaël", "Rémi", "Romain", "Sébastien",
        "Théo", "Thibaut", "Thomas", "Valentin", "Vincent", "Yoann",
    ),
    (
        "Anselin", "Barthez", "Baptiste", "Bellaigue", "Caillard", "Charbonnier",
        "Chevalier", "Clichy", "Coulibaly", "Delacroix", "Delaunay", "Dubois",
        "Dumont", "Faivre", "Fontaine", "Gourcuff", "Grenier", "Guillaume",
        "Hernandez", "Jacquet", "Lacombe", "Laporte", "Lemoine", "Lestienne",
        "Maignan", "Marchand", "Mathieu", "Mendy", "Payet", "Perrin",
        "Rabiot", "Rémy", "Rousseau", "Sagnol", "Thauvin", "Tolisso",
        "Varane", "Vercoutre", "Villeneuve", "Zimmermann",
    ),
)

BRAZIL: Final[NamePool] = (
    (
        "Alisson", "Bruno", "Caio", "Carlos", "Danilo", "Douglas", "Éder",
        "Emerson", "Everton", "Fabinho", "Felipe", "Gabriel", "Gustavo",
        "Hélder", "Igor", "João", "Lucas", "Luiz", "Marcelo", "Mateus",
        "Matheus", "Murilo", "Otávio", "Paulo", "Pedro", "Rafael", "Raphael",
        "Renan", "Ricardo", "Rodrigo", "Thiago", "Vinícius", "Wesley",
    ),
    (
        "Alves", "Andrade", "Araújo", "Barbosa", "Cardoso", "Carvalho",
        "Correia", "Costa", "Ferreira", "Fonseca", "Gomes", "Guedes",
        "Lima", "Macedo", "Marinho", "Martins", "Mendes", "Moraes", "Nascimento",
        "Nunes", "Oliveira", "Pereira", "Pinto", "Ramos", "Ribeiro", "Rocha",
        "Rodrigues", "Santos", "Silva", "Soares", "Souza", "Teixeira", "Vieira",
    ),
)

ARGENTINA: Final[NamePool] = (
    (
        "Agustín", "Alejandro", "Cristian", "Emiliano", "Enzo", "Ezequiel",
        "Facundo", "Federico", "Franco", "Gastón", "Gonzalo", "Ignacio",
        "Joaquín", "Julián", "Leandro", "Lisandro", "Lucas", "Marcos", "Martín",
        "Matías", "Maximiliano", "Nahuel", "Nicolás", "Rodrigo", "Santiago",
        "Sebastián", "Thiago", "Tomás", "Valentín",
    ),
    (
        "Acuña", "Álvarez", "Benedetto", "Cardona", "Correa", "Domínguez",
        "Echeverría", "Fernández", "Gaitán", "Giménez", "Godoy", "Ibarra",
        "Lanzini", "Lucero", "Medina", "Molina", "Montiel", "Ocampos",
        "Otamendi", "Palacios", "Paredes", "Pezzella", "Quarta", "Rojo",
        "Romero", "Sosa", "Tagliafico", "Vega", "Zárate",
    ),
)

PORTUGAL: Final[NamePool] = (
    (
        "André", "Bernardo", "Bruno", "Diogo", "Domingos", "Fábio", "Gonçalo",
        "Hélder", "Hugo", "Ivo", "João", "Jorge", "José", "Luís", "Miguel",
        "Nélson", "Nuno", "Paulo", "Pedro", "Rafael", "Renato", "Ricardo",
        "Rúben", "Rui", "Sérgio", "Tiago", "Vítor",
    ),
    (
        "Almeida", "Amorim", "Azevedo", "Baptista", "Cancelo", "Carmo",
        "Coentrão", "Dias", "Esteves", "Faria", "Fernandes", "Figueiredo",
        "Gaspar", "Guerreiro", "Leal", "Lopes", "Machado", "Matias", "Meireles",
        "Neves", "Palhinha", "Pinho", "Queirós", "Resende", "Sanches",
        "Semedo", "Tavares", "Trincão", "Veloso",
    ),
)

NETHERLANDS: Final[NamePool] = (
    (
        "Bart", "Bas", "Cody", "Daley", "Denzel", "Dirk", "Frenkie", "Gijs",
        "Jasper", "Jeremie", "Joey", "Jurriën", "Kenneth", "Koen", "Lars",
        "Luuk", "Marten", "Mats", "Micky", "Nathan", "Noa", "Quinten", "Ruud",
        "Sem", "Stefan", "Sven", "Teun", "Thijs", "Tijjani", "Wout",
    ),
    (
        "Aerts", "Bakker", "Berghuis", "Blind", "Bos", "Brobbey", "Dekker",
        "De Jong", "De Vries", "Dijkstra", "Geertruida", "Groot", "Hendriks",
        "Janssen", "Klaassen", "Koopmeiners", "Kuyt", "Maatsen", "Meijer",
        "Mulder", "Peeters", "Reijnders", "Schouten", "Smit", "Timber",
        "Van Dijk", "Veerman", "Visser", "Vos", "Wijnaldum",
    ),
)

GERMANY: Final[NamePool] = (
    (
        "Alexander", "Benedikt", "Christoph", "Dominik", "Fabian", "Felix",
        "Finn", "Florian", "Jannik", "Jonas", "Julian", "Kai", "Karim",
        "Leon", "Lukas", "Malte", "Marcel", "Mario", "Maximilian", "Moritz",
        "Niklas", "Nico", "Pascal", "Philipp", "Robin", "Sebastian", "Simon",
        "Thilo", "Tim", "Tobias",
    ),
    (
        "Baumgartner", "Becker", "Brandt", "Draxler", "Fährmann", "Ginter",
        "Gnabry", "Groß", "Hartmann", "Henrichs", "Hofmann", "Kehrer",
        "Keller", "Kimmich", "Klostermann", "Koch", "Kramer", "Lehmann",
        "Neuhaus", "Raum", "Richter", "Sané", "Schlotterbeck", "Schneider",
        "Stach", "Süle", "Wagner", "Weigl", "Werner", "Wirtz",
    ),
)

BELGIUM: Final[NamePool] = (
    (
        "Amadou", "Arthur", "Charles", "Dodi", "Hans", "Jérémy", "Koen",
        "Leandro", "Lois", "Matz", "Maxim", "Michy", "Orel", "Sebastiaan",
        "Thibaut", "Thomas", "Timothy", "Toby", "Wout", "Yannick", "Zeno",
    ),
    (
        "Bornauw", "Carrasco", "Castagne", "Claeys", "Debast", "De Bruyne",
        "Dendoncker", "De Ketelaere", "Doku", "Faes", "Fofana", "Lukaku",
        "Mangala", "Meunier", "Onana", "Openda", "Praet", "Raskin", "Sels",
        "Theate", "Trossard", "Vanaken", "Vandevoordt", "Vermeeren",
        "Verschaeren", "Witsel",
    ),
)

NIGERIA: Final[NamePool] = (
    (
        "Ademola", "Alex", "Bright", "Calvin", "Chidera", "Chidi", "Chukwuemeka",
        "Cyriel", "Emmanuel", "Frank", "Gift", "Henry", "Ikenna", "Joe",
        "Kelechi", "Kenneth", "Kelvin", "Moses", "Nnamdi", "Obinna", "Ola",
        "Paul", "Samuel", "Sadiq", "Semi", "Taiwo", "Tunde", "Uche", "Victor",
        "Wilfred", "Yusuf",
    ),
    (
        "Adebanjo", "Aina", "Akinlade", "Anyanwu", "Awoniyi", "Balogun",
        "Bassey", "Chukwueze", "Dennis", "Ekong", "Ekpenyong", "Iheanacho",
        "Ikemefuna", "Iwobi", "Lookman", "Musa", "Ndidi", "Nwachukwu",
        "Nwankwo", "Obi", "Okafor", "Okoye", "Olatunde", "Omeruo", "Onyeka",
        "Osimhen", "Simon", "Ugochukwu", "Umeh", "Uzoho", "Yakubu",
    ),
)

SENEGAL: Final[NamePool] = (
    (
        "Abdou", "Abdoulaye", "Aliou", "Amadou", "Assane", "Babacar", "Boulaye",
        "Cheikh", "Demba", "El Hadji", "Formose", "Habib", "Idrissa", "Ismaïla",
        "Kalidou", "Krépin", "Lamine", "Mamadou", "Moussa", "Nicolas", "Ousmane",
        "Pape", "Sadio", "Saliou", "Seydou", "Youssouf",
    ),
    (
        "Ba", "Camara", "Ciss", "Diagne", "Diallo", "Diatta", "Dieng", "Diop",
        "Diouf", "Fall", "Faye", "Gassama", "Gueye", "Jakobs", "Kouyaté",
        "Mbaye", "Mendy", "Ndiaye", "Niang", "Sabaly", "Sarr", "Seck", "Sow",
        "Sylla", "Thiaw", "Touré",
    ),
)

IVORY_COAST: Final[NamePool] = (
    (
        "Amad", "Arthur", "Bakary", "Christian", "Eric", "Evan", "Franck",
        "Ghislain", "Hamed", "Ibrahim", "Jean", "Jonathan", "Karim", "Maxwel",
        "Nicolas", "Odilon", "Oumar", "Seko", "Serge", "Sébastien", "Simon",
        "Willy", "Yacine", "Youssouf",
    ),
    (
        "Aurier", "Bailly", "Boly", "Cornet", "Dao", "Diomandé", "Doumbia",
        "Fofana", "Gbamin", "Gradel", "Guessand", "Haller", "Kessié",
        "Konan", "Koné", "Kossounou", "Ndicka", "Pépé", "Sangaré", "Seri",
        "Singo", "Traoré", "Zaha",
    ),
)

MOROCCO: Final[NamePool] = (
    (
        "Achraf", "Adel", "Amine", "Anass", "Ayoub", "Azzedine", "Bilal",
        "Hakim", "Ilias", "Ismael", "Nayef", "Noussair", "Oussama", "Rachid",
        "Romain", "Samy", "Selim", "Sofiane", "Sofyan", "Tarik", "Walid",
        "Yahya", "Youssef", "Zakaria",
    ),
    (
        "Aguerd", "Amrabat", "Attiat-Allah", "Banoun", "Belhanda", "Benoun",
        "Boufal", "Bounou", "Chair", "Cheddira", "Dari", "El Kaabi", "El Khannouss",
        "Ezzalzouli", "Hakimi", "Harit", "Jabrane", "Mazraoui", "Mmaee",
        "Ounahi", "Saïss", "Sabiri", "Tagnaouti", "Ziyech",
    ),
)

CROATIA: Final[NamePool] = (
    (
        "Ante", "Borna", "Bruno", "Dejan", "Domagoj", "Dominik", "Duje",
        "Filip", "Ivan", "Josip", "Josko", "Lovro", "Luka", "Marcelo",
        "Mario", "Marko", "Mateo", "Mislav", "Nikola", "Petar", "Stipe",
        "Toma", "Tin",
    ),
    (
        "Barisic", "Brozovic", "Budimir", "Caleta-Car", "Erlic", "Gvardiol",
        "Ivanusec", "Juranovic", "Kovacic", "Kramaric", "Livakovic",
        "Majer", "Modric", "Musa", "Orsic", "Pasalic", "Perisic", "Petkovic",
        "Pongracic", "Sosa", "Stanisic", "Sucic", "Sutalo", "Vlasic",
    ),
)

DENMARK: Final[NamePool] = (
    (
        "Alexander", "Anders", "Andreas", "Anton", "Christian", "Emil",
        "Frederik", "Gustav", "Jacob", "Jesper", "Joachim", "Jonas", "Kasper",
        "Magnus", "Mads", "Martin", "Mathias", "Mikkel", "Morten", "Nicolai",
        "Oliver", "Pierre-Emile", "Rasmus", "Simon", "Thomas", "Victor",
    ),
    (
        "Andersen", "Bah", "Christensen", "Damsgaard", "Dolberg", "Dreyer",
        "Eriksen", "Hjulmand", "Højbjerg", "Højlund", "Jensen", "Jørgensen",
        "Kristensen", "Larsen", "Lerager", "Lindstrøm", "Maehle", "Nelsson",
        "Nielsen", "Nørgaard", "Olsen", "Pedersen", "Poulsen", "Rasmussen",
        "Skov", "Sørensen", "Vestergaard", "Wind",
    ),
)

SWEDEN: Final[NamePool] = (
    (
        "Albin", "Alexander", "Anthony", "Dejan", "Elias", "Emil", "Erik",
        "Gustav", "Hugo", "Isak", "Jesper", "Joakim", "Johan", "Jonas",
        "Karl", "Kristoffer", "Ludwig", "Mattias", "Nils", "Oscar", "Robin",
        "Sebastian", "Viktor", "Yasin",
    ),
    (
        "Ahlberg", "Andersson", "Ayari", "Bengtsson", "Berg", "Bergström",
        "Claesson", "Ekdal", "Ekholm", "Elanga", "Eriksson", "Forsberg",
        "Gudmundsson", "Gyökeres", "Hansson", "Holm", "Johansson", "Karlsson",
        "Larsson", "Lindelöf", "Nilsson", "Nyström", "Olsson", "Persson",
        "Svanberg", "Svensson",
    ),
)

POLAND: Final[NamePool] = (
    (
        "Adam", "Arkadiusz", "Bartosz", "Damian", "Dawid", "Grzegorz", "Jakub",
        "Jan", "Kacper", "Kamil", "Karol", "Krystian", "Krzysztof", "Łukasz",
        "Maciej", "Mateusz", "Michał", "Nicola", "Paweł", "Piotr", "Przemysław",
        "Robert", "Sebastian", "Szymon", "Tomasz", "Wojciech",
    ),
    (
        "Bednarek", "Bereszyński", "Bielik", "Buksa", "Cash", "Drągowski",
        "Frankowski", "Glik", "Grosicki", "Jóźwiak", "Kamiński", "Kiwior",
        "Kowalski", "Krychowiak", "Lewandowski", "Linetty", "Milik",
        "Moder", "Piątek", "Piotrowski", "Skorupski", "Szczęsny", "Szymański",
        "Świderski", "Wieteska", "Zalewski", "Zieliński",
    ),
)

SERBIA: Final[NamePool] = (
    (
        "Aleksandar", "Andrija", "Bogdan", "Darko", "Dušan", "Filip", "Ivan",
        "Luka", "Marko", "Miloš", "Mihailo", "Nemanja", "Nikola", "Petar",
        "Predrag", "Sasa", "Sergej", "Srdjan", "Stefan", "Strahinja", "Uroš",
        "Vanja", "Veljko",
    ),
    (
        "Babić", "Gudelj", "Ilić", "Jović", "Kostić", "Lukić", "Lazović",
        "Maksimović", "Milenković", "Milinković", "Mitrović", "Nedeljković",
        "Pavlović", "Petrović", "Radonjić", "Rajković", "Ristić", "Samardžić",
        "Simić", "Stojković", "Tadić", "Todorović", "Veljković", "Vlahović",
        "Živković",
    ),
)

JAPAN: Final[NamePool] = (
    (
        "Ao", "Daichi", "Daizen", "Genki", "Hidemasa", "Hiroki", "Junya",
        "Kaoru", "Kaishu", "Keito", "Ko", "Koki", "Kyogo", "Maya", "Reo",
        "Ritsu", "Ryotaro", "Shogo", "Shuto", "Takefusa", "Takehiro",
        "Takumi", "Wataru", "Yukinari", "Yuki", "Yuta", "Zion",
    ),
    (
        "Abe", "Doan", "Endo", "Furuhashi", "Hashioka", "Hatate", "Hayashi",
        "Ideguchi", "Inoue", "Ito", "Kamada", "Kubo", "Machida", "Maeda",
        "Mitoma", "Morita", "Nakamura", "Nakano", "Nishimura", "Ogawa",
        "Osako", "Sakai", "Sano", "Suzuki", "Tanaka", "Tomiyasu", "Ueda",
        "Watanabe", "Yamada", "Yoshida",
    ),
)

URUGUAY: Final[NamePool] = (
    (
        "Agustín", "Brian", "Cristian", "Darwin", "Diego", "Facundo",
        "Federico", "Fernando", "Giorgian", "Guillermo", "Ignacio", "Joaquín",
        "Jonathan", "José", "Luis", "Manuel", "Martín", "Matías", "Maximiliano",
        "Nicolás", "Rodrigo", "Santiago", "Sebastián", "Sergio",
    ),
    (
        "Araújo", "Bentancur", "Cáceres", "Caicedo", "Coates", "De Arrascaeta",
        "De la Cruz", "Giménez", "Gómez", "Núñez", "Olivera", "Pellistri",
        "Piquerez", "Rochet", "Rodríguez", "Sánchez", "Suárez", "Torreira",
        "Ugarte", "Valverde", "Varela", "Vecino", "Viña", "Zalazar",
    ),
)

#: Nationalities a squad's foreign contingent is drawn from, with the relative
#: weight of each. Weighted to the routes European clubs actually recruit along.
FOREIGN_MIX: Final[tuple[tuple[str, int], ...]] = (
    ("BRAZIL", 12),
    ("ARGENTINA", 9),
    ("FRANCE", 9),
    ("SPAIN", 7),
    ("PORTUGAL", 7),
    ("NETHERLANDS", 6),
    ("GERMANY", 6),
    ("ITALY", 5),
    ("ENGLAND", 5),
    ("BELGIUM", 5),
    ("NIGERIA", 5),
    ("SENEGAL", 4),
    ("IVORY_COAST", 4),
    ("MOROCCO", 4),
    ("CROATIA", 3),
    ("SERBIA", 3),
    ("DENMARK", 3),
    ("SWEDEN", 3),
    ("POLAND", 3),
    ("URUGUAY", 3),
    ("JAPAN", 2),
)

POOLS: Final[dict[str, NamePool]] = {
    "ENGLAND": ENGLAND,
    "SPAIN": SPAIN,
    "ITALY": ITALY,
    "FRANCE": FRANCE,
    "BRAZIL": BRAZIL,
    "ARGENTINA": ARGENTINA,
    "PORTUGAL": PORTUGAL,
    "NETHERLANDS": NETHERLANDS,
    "GERMANY": GERMANY,
    "BELGIUM": BELGIUM,
    "NIGERIA": NIGERIA,
    "SENEGAL": SENEGAL,
    "IVORY_COAST": IVORY_COAST,
    "MOROCCO": MOROCCO,
    "CROATIA": CROATIA,
    "SERBIA": SERBIA,
    "DENMARK": DENMARK,
    "SWEDEN": SWEDEN,
    "POLAND": POLAND,
    "URUGUAY": URUGUAY,
    "JAPAN": JAPAN,
}

#: Share of a squad born in the league's own country, by country, in percent.
#: Roughly what the real leagues field; the rest comes from ``FOREIGN_MIX``.
DOMESTIC_SHARE: Final[dict[str, int]] = {
    "ENGLAND": 40,
    "SPAIN": 60,
    "ITALY": 55,
    "FRANCE": 55,
}

DEFAULT_DOMESTIC_SHARE: Final = 50

#: Added to the domestic share for the goalkeeper. Clubs import outfielders far
#: more readily than keepers, and a lone foreign keeper in an otherwise domestic
#: side reads as a mistake even when it is drawn fairly.
GOALKEEPER_DOMESTIC_BONUS: Final = 20

#: Used when a club's country has no pool of its own: the squad is then drawn
#: from the foreign mix alone rather than from one arbitrary nationality.
COUNTRY_ALIASES: Final[dict[str, str]] = {
    "ENGLAND": "ENGLAND",
    "UNITED KINGDOM": "ENGLAND",
    "GREAT BRITAIN": "ENGLAND",
    "SPAIN": "SPAIN",
    "ESPAÑA": "SPAIN",
    "ITALY": "ITALY",
    "ITALIA": "ITALY",
    "FRANCE": "FRANCE",
    "GERMANY": "GERMANY",
    "DEUTSCHLAND": "GERMANY",
    "PORTUGAL": "PORTUGAL",
    "NETHERLANDS": "NETHERLANDS",
    "HOLLAND": "NETHERLANDS",
    "BELGIUM": "BELGIUM",
    "BRAZIL": "BRAZIL",
    "ARGENTINA": "ARGENTINA",
    "NIGERIA": "NIGERIA",
    "SENEGAL": "SENEGAL",
    "IVORY COAST": "IVORY_COAST",
    "CÔTE D'IVOIRE": "IVORY_COAST",
    "MOROCCO": "MOROCCO",
    "CROATIA": "CROATIA",
    "SERBIA": "SERBIA",
    "DENMARK": "DENMARK",
    "SWEDEN": "SWEDEN",
    "POLAND": "POLAND",
    "URUGUAY": "URUGUAY",
    "JAPAN": "JAPAN",
}


def resolve_country(country: str | None) -> str | None:
    """Return the pool key for a league's country, or None if it has no pool."""
    if country is None:
        return None

    return COUNTRY_ALIASES.get(country.strip().upper())
