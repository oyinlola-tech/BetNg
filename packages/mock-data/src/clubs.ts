import type { LeagueId, TeamId } from "@betng/contracts";
import type { Player, TeamColors, TeamDetailView } from "@betng/ui-core";
import { rng, uuidFrom } from "./prng.js";

export interface ClubSeed {
  readonly name: string;
  readonly shortName: string;
  readonly code: string;
  readonly city: string;
  readonly stadium: string;
  readonly strength: number;
  readonly colors: TeamColors;
}

export interface LeagueSeed {
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly country: string;
  readonly offsetSeconds: number;
  readonly clubs: readonly ClubSeed[];
}

const kit = (primary: string, secondary: string, onPrimary = "#FFFFFF"): TeamColors => ({ primary, secondary, onPrimary });
const club = (name: string, shortName: string, code: string, city: string, stadium: string, strength: number, colors: TeamColors): ClubSeed => ({ name, shortName, code, city, stadium, strength, colors });

/* Real league names are simulation categories only; every result here is simulated and no club branding is used. */
export const LEAGUES: readonly LeagueSeed[] = [
  {
    key: "epl", slug: "premier-league", name: "Premier League", code: "EPL", country: "England", offsetSeconds: 0,
    clubs: [
      club("Arsenal", "Arsenal", "ARS", "London", "Emirates Stadium", 88, kit("#EF0107", "#FFFFFF")),
      club("Aston Villa", "Villa", "AVL", "Birmingham", "Villa Park", 78, kit("#670E36", "#95BFE5")),
      club("Bournemouth", "Bournemouth", "BOU", "Bournemouth", "Vitality Stadium", 70, kit("#DA291C", "#000000")),
      club("Brentford", "Brentford", "BRE", "London", "Gtech Community Stadium", 71, kit("#E30613", "#FFFFFF")),
      club("Brighton", "Brighton", "BHA", "Brighton", "Falmer Stadium", 76, kit("#0057B8", "#FFFFFF")),
      club("Chelsea", "Chelsea", "CHE", "London", "Stamford Bridge", 83, kit("#034694", "#FFFFFF")),
      club("Crystal Palace", "Palace", "CRY", "London", "Selhurst Park", 72, kit("#1B458F", "#C4122E")),
      club("Everton", "Everton", "EVE", "Liverpool", "Hill Dickinson Stadium", 69, kit("#003399", "#FFFFFF")),
      club("Fulham", "Fulham", "FUL", "London", "Craven Cottage", 72, kit("#FFFFFF", "#000000", "#111111")),
      club("Leeds United", "Leeds", "LEE", "Leeds", "Elland Road", 68, kit("#FFFFFF", "#1D428A", "#111111")),
      club("Liverpool", "Liverpool", "LIV", "Liverpool", "Anfield", 90, kit("#C8102E", "#00B2A9")),
      club("Manchester City", "Man City", "MCI", "Manchester", "Etihad Stadium", 91, kit("#6CABDD", "#1C2C5B")),
      club("Manchester United", "Man Utd", "MUN", "Manchester", "Old Trafford", 79, kit("#DA291C", "#FBE122")),
      club("Newcastle United", "Newcastle", "NEW", "Newcastle", "St James' Park", 80, kit("#241F20", "#FFFFFF")),
      club("Nottingham Forest", "Forest", "NFO", "Nottingham", "City Ground", 75, kit("#DD0000", "#FFFFFF")),
      club("Sunderland", "Sunderland", "SUN", "Sunderland", "Stadium of Light", 64, kit("#EB172B", "#FFFFFF")),
      club("Tottenham Hotspur", "Spurs", "TOT", "London", "Tottenham Hotspur Stadium", 78, kit("#132257", "#FFFFFF")),
      club("West Ham United", "West Ham", "WHU", "London", "London Stadium", 71, kit("#7A263A", "#1BB1E7")),
      club("Wolverhampton", "Wolves", "WOL", "Wolverhampton", "Molineux", 69, kit("#FDB913", "#231F20", "#111111")),
      club("Burnley", "Burnley", "BUR", "Burnley", "Turf Moor", 65, kit("#6C1D45", "#99D6EA")),
    ],
  },
  {
    key: "laliga", slug: "laliga", name: "LaLiga", code: "LAL", country: "Spain", offsetSeconds: 60,
    clubs: [
      club("Real Madrid", "Real Madrid", "RMA", "Madrid", "Santiago Bernabéu", 91, kit("#FFFFFF", "#FEBE10", "#111111")),
      club("Barcelona", "Barcelona", "BAR", "Barcelona", "Camp Nou", 90, kit("#A50044", "#004D98")),
      club("Atlético Madrid", "Atlético", "ATM", "Madrid", "Metropolitano", 85, kit("#CB3524", "#272E61")),
      club("Athletic Club", "Athletic", "ATH", "Bilbao", "San Mamés", 79, kit("#EE2523", "#FFFFFF")),
      club("Villarreal", "Villarreal", "VIL", "Villarreal", "La Cerámica", 78, kit("#FFE667", "#005187", "#111111")),
      club("Real Betis", "Betis", "BET", "Seville", "Benito Villamarín", 76, kit("#00954C", "#FFFFFF")),
      club("Real Sociedad", "R. Sociedad", "RSO", "San Sebastián", "Anoeta", 77, kit("#0067B1", "#FFFFFF")),
      club("Sevilla", "Sevilla", "SEV", "Seville", "Sánchez-Pizjuán", 73, kit("#FFFFFF", "#D4021D", "#111111")),
      club("Valencia", "Valencia", "VAL", "Valencia", "Mestalla", 72, kit("#FFFFFF", "#F7931E", "#111111")),
      club("Girona", "Girona", "GIR", "Girona", "Montilivi", 72, kit("#CD2534", "#FFFFFF")),
      club("Celta Vigo", "Celta", "CEL", "Vigo", "Balaídos", 71, kit("#8AC3EE", "#FFFFFF", "#111111")),
      club("Osasuna", "Osasuna", "OSA", "Pamplona", "El Sadar", 70, kit("#D91A21", "#0A346F")),
      club("Rayo Vallecano", "Rayo", "RAY", "Madrid", "Vallecas", 69, kit("#FFFFFF", "#E53027", "#111111")),
      club("Mallorca", "Mallorca", "MLL", "Palma", "Son Moix", 68, kit("#E20613", "#000000")),
      club("Getafe", "Getafe", "GET", "Getafe", "Coliseum", 67, kit("#004FA3", "#FFFFFF")),
      club("Alavés", "Alavés", "ALA", "Vitoria", "Mendizorroza", 66, kit("#0761AF", "#FFFFFF")),
      club("Espanyol", "Espanyol", "ESP", "Barcelona", "RCDE Stadium", 67, kit("#007FC8", "#FFFFFF")),
      club("Levante", "Levante", "LEV", "Valencia", "Ciutat de València", 64, kit("#B4053F", "#005999")),
      club("Elche", "Elche", "ELC", "Elche", "Martínez Valero", 63, kit("#FFFFFF", "#006B3F", "#111111")),
      club("Real Oviedo", "Oviedo", "OVI", "Oviedo", "Carlos Tartiere", 62, kit("#0033A0", "#FFFFFF")),
    ],
  },
  {
    key: "seriea", slug: "serie-a", name: "Serie A", code: "SEA", country: "Italy", offsetSeconds: 120,
    clubs: [
      club("Inter", "Inter", "INT", "Milan", "San Siro", 89, kit("#010E80", "#000000")),
      club("Napoli", "Napoli", "NAP", "Naples", "Stadio Maradona", 87, kit("#12A0D7", "#FFFFFF")),
      club("Milan", "Milan", "MIL", "Milan", "San Siro", 84, kit("#FB090B", "#000000")),
      club("Juventus", "Juventus", "JUV", "Turin", "Allianz Stadium", 84, kit("#000000", "#FFFFFF")),
      club("Atalanta", "Atalanta", "ATA", "Bergamo", "Gewiss Stadium", 82, kit("#1E71B8", "#000000")),
      club("Roma", "Roma", "ROM", "Rome", "Stadio Olimpico", 80, kit("#8E1F2F", "#F0BC42")),
      club("Lazio", "Lazio", "LAZ", "Rome", "Stadio Olimpico", 78, kit("#87D8F7", "#FFFFFF", "#111111")),
      club("Fiorentina", "Fiorentina", "FIO", "Florence", "Artemio Franchi", 77, kit("#482E92", "#FFFFFF")),
      club("Bologna", "Bologna", "BOL", "Bologna", "Dall'Ara", 77, kit("#1A2F48", "#A21C26")),
      club("Torino", "Torino", "TOR", "Turin", "Stadio Olimpico Grande Torino", 71, kit("#8B1B1B", "#FFFFFF")),
      club("Udinese", "Udinese", "UDI", "Udine", "Bluenergy Stadium", 70, kit("#000000", "#FFFFFF")),
      club("Genoa", "Genoa", "GEN", "Genoa", "Luigi Ferraris", 69, kit("#AE1C28", "#00213F")),
      club("Como", "Como", "COM", "Como", "Giuseppe Sinigaglia", 70, kit("#0B2D66", "#FFFFFF")),
      club("Cagliari", "Cagliari", "CAG", "Cagliari", "Unipol Domus", 67, kit("#B01E2F", "#0A2C6A")),
      club("Parma", "Parma", "PAR", "Parma", "Ennio Tardini", 66, kit("#FFE500", "#004B87", "#111111")),
      club("Lecce", "Lecce", "LEC", "Lecce", "Via del Mare", 65, kit("#FFD500", "#D3232E", "#111111")),
      club("Hellas Verona", "Verona", "VER", "Verona", "Bentegodi", 66, kit("#002F6C", "#FFE500")),
      club("Sassuolo", "Sassuolo", "SAS", "Sassuolo", "Mapei Stadium", 68, kit("#00A752", "#000000")),
      club("Pisa", "Pisa", "PIS", "Pisa", "Arena Garibaldi", 63, kit("#002F6C", "#000000")),
      club("Cremonese", "Cremonese", "CRE", "Cremona", "Giovanni Zini", 62, kit("#A0A0A0", "#C8102E", "#111111")),
    ],
  },
  {
    key: "ligue1", slug: "ligue-1", name: "Ligue 1", code: "LG1", country: "France", offsetSeconds: 180,
    clubs: [
      club("Paris Saint-Germain", "PSG", "PSG", "Paris", "Parc des Princes", 92, kit("#004170", "#DA291C")),
      club("Marseille", "Marseille", "MAR", "Marseille", "Vélodrome", 82, kit("#2FAEE0", "#FFFFFF")),
      club("Monaco", "Monaco", "MON", "Monaco", "Stade Louis II", 81, kit("#E51B22", "#FFFFFF")),
      club("Lille", "Lille", "LIL", "Lille", "Pierre-Mauroy", 78, kit("#E01E13", "#FFFFFF")),
      club("Lyon", "Lyon", "LYO", "Lyon", "Groupama Stadium", 77, kit("#FFFFFF", "#1E3F8F", "#111111")),
      club("Nice", "Nice", "NIC", "Nice", "Allianz Riviera", 75, kit("#CC0000", "#000000")),
      club("Lens", "Lens", "LEN", "Lens", "Bollaert-Delelis", 74, kit("#FFD100", "#E31B23", "#111111")),
      club("Rennes", "Rennes", "REN", "Rennes", "Roazhon Park", 74, kit("#E13327", "#000000")),
      club("Strasbourg", "Strasbourg", "STR", "Strasbourg", "La Meinau", 72, kit("#1E90FF", "#FFFFFF")),
      club("Toulouse", "Toulouse", "TFC", "Toulouse", "Stadium de Toulouse", 70, kit("#5A2D82", "#FFFFFF")),
      club("Nantes", "Nantes", "NAN", "Nantes", "La Beaujoire", 68, kit("#FCD405", "#00843D", "#111111")),
      club("Brest", "Brest", "BRS", "Brest", "Francis-Le Blé", 70, kit("#E30613", "#FFFFFF")),
      club("Auxerre", "Auxerre", "AUX", "Auxerre", "Abbé-Deschamps", 66, kit("#FFFFFF", "#1B4A9C", "#111111")),
      club("Angers", "Angers", "ANG", "Angers", "Raymond-Kopa", 64, kit("#000000", "#FFFFFF")),
      club("Le Havre", "Le Havre", "HAC", "Le Havre", "Stade Océane", 64, kit("#7BC4E8", "#0A2E6E", "#111111")),
      club("Lorient", "Lorient", "LOR", "Lorient", "Le Moustoir", 65, kit("#F58220", "#000000")),
      club("Metz", "Metz", "MET", "Metz", "Saint-Symphorien", 63, kit("#8B1E3F", "#FFFFFF")),
      club("Paris FC", "Paris FC", "PFC", "Paris", "Stade Jean-Bouin", 65, kit("#1D3B8F", "#FFFFFF")),
      club("Reims", "Reims", "REI", "Reims", "Auguste-Delaune", 66, kit("#E4002B", "#FFFFFF")),
      club("Montpellier", "Montpellier", "MPL", "Montpellier", "La Mosson", 65, kit("#1B2E6B", "#F58220")),
    ],
  },
];

const FIRST_NAMES = ["Tunde", "Chidi", "Musa", "Emeka", "Ibrahim", "Segun", "Kelechi", "Yusuf", "Femi", "Obinna", "Sadiq", "Uche", "Bello", "Tobi", "Nnamdi", "Aliyu", "Dayo", "Ikenna", "Suleiman", "Kayode", "Marco", "Luca", "Pablo", "Diego", "Hugo", "Léo", "Jules", "Mateo", "Adrián", "Tom", "Harry", "Jack", "Oliver", "Kai", "Noah", "Louis", "Nico", "Sergio", "Andrea", "Giovanni"];
const LAST_NAMES = ["Adeyemi", "Okafor", "Abdullahi", "Nwosu", "Balogun", "Obi", "Adebayo", "Eze", "Lawal", "Okonkwo", "Rossi", "Bianchi", "Romano", "García", "Martínez", "López", "Fernández", "Dubois", "Martin", "Bernard", "Petit", "Smith", "Taylor", "Brown", "Wilson", "Evans", "Hughes", "Moreau", "Conti", "Greco", "Rivera", "Silva", "Costa", "Ferrari", "Laurent", "Walker", "Wright", "Hall", "Sanz", "Ortega"];
const POSITIONS: readonly Player["position"][] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "GK", "DF", "MF", "FW"];

function squadFor(clubKey: string): readonly Player[] {
  const r = rng(`squad:${clubKey}`);
  const used = new Set<string>();

  return POSITIONS.map((position, index): Player => {
    let name = "";

    do name = `${r.pick(FIRST_NAMES)} ${r.pick(LAST_NAMES)}`;
    while (used.has(name));

    used.add(name);

    return { id: uuidFrom(`player:${clubKey}:${String(index)}`), name, position, shirt: index + 1 };
  });
}

const MANAGERS = ["A. Okoro", "M. Rinaldi", "J. Serrano", "P. Lefèvre", "D. Whitmore", "K. Adebayo", "S. Moretti", "L. Navarro", "T. Girard", "R. Haddad"];

export interface Club extends TeamDetailView {
  readonly leagueKey: string;
}

export interface Competition {
  readonly id: LeagueId;
  readonly seed: LeagueSeed;
  readonly clubs: readonly Club[];
  readonly matchdays: number;
}

export const COMPETITIONS: readonly Competition[] = LEAGUES.map((seed) => {
  const leagueId = uuidFrom(`league:${seed.key}`) as LeagueId;
  const clubs = seed.clubs.map((c, i): Club => ({
    id: uuidFrom(`team:${seed.key}:${c.code}`) as TeamId,
    leagueId,
    leagueKey: seed.key,
    name: c.name,
    shortName: c.shortName,
    code: c.code,
    city: c.city,
    stadium: c.stadium,
    colors: c.colors,
    strength: c.strength,
    manager: MANAGERS[(i * 7 + seed.key.length) % MANAGERS.length] as string,
    founded: 1880 + ((i * 13 + seed.key.length * 5) % 60),
    squad: squadFor(`${seed.key}:${c.code}`),
  }));

  return { id: leagueId, seed, clubs, matchdays: (clubs.length - 1) * 2 };
});

export function competitionById(leagueId: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === leagueId);
}

export function competitionBySlug(slug: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.seed.slug === slug);
}

export function clubById(teamId: string): Club | undefined {
  for (const c of COMPETITIONS) {
    const found = c.clubs.find((t) => t.id === teamId);

    if (found !== undefined) return found;
  }

  return undefined;
}
