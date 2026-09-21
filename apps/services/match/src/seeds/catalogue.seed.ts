/**
 * The catalogue a fresh database starts with: four leagues of twenty clubs.
 *
 * League names are simulation categories only; every fixture, result and statistic the platform shows is
 * simulated. `staggerSeconds` is the league's offset within the round cycle.
 */

export interface ClubSeed {
  readonly name: string;
  readonly shortName: string;
  readonly code: string;
  readonly city: string;
  readonly stadium: string;
  readonly strength: number;
  readonly colorPrimary: string;
  readonly colorSecondary: string;
}

export interface LeagueSeed {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly country: string;
  readonly staggerSeconds: number;
  readonly clubs: readonly ClubSeed[];
}

function club(
  name: string,
  shortName: string,
  code: string,
  city: string,
  stadium: string,
  strength: number,
  colorPrimary: string,
  colorSecondary: string,
): ClubSeed {
  return { name, shortName, code, city, stadium, strength, colorPrimary, colorSecondary };
}

export const LEAGUE_SEEDS: readonly LeagueSeed[] = [
  {
    slug: "premier-league",
    name: "Premier League",
    code: "EPL",
    country: "England",
    staggerSeconds: 0,
    clubs: [
      club("Arsenal", "Arsenal", "ARS", "London", "Emirates Stadium", 88, "#EF0107", "#FFFFFF"),
      club("Aston Villa", "Villa", "AVL", "Birmingham", "Villa Park", 78, "#670E36", "#95BFE5"),
      club("Bournemouth", "Bournemouth", "BOU", "Bournemouth", "Vitality Stadium", 70, "#DA291C", "#000000"),
      club("Brentford", "Brentford", "BRE", "London", "Gtech Community Stadium", 71, "#E30613", "#FFFFFF"),
      club("Brighton", "Brighton", "BHA", "Brighton", "Falmer Stadium", 76, "#0057B8", "#FFFFFF"),
      club("Chelsea", "Chelsea", "CHE", "London", "Stamford Bridge", 83, "#034694", "#FFFFFF"),
      club("Crystal Palace", "Palace", "CRY", "London", "Selhurst Park", 72, "#1B458F", "#C4122E"),
      club("Everton", "Everton", "EVE", "Liverpool", "Hill Dickinson Stadium", 69, "#003399", "#FFFFFF"),
      club("Fulham", "Fulham", "FUL", "London", "Craven Cottage", 72, "#FFFFFF", "#000000"),
      club("Leeds United", "Leeds", "LEE", "Leeds", "Elland Road", 68, "#FFFFFF", "#1D428A"),
      club("Liverpool", "Liverpool", "LIV", "Liverpool", "Anfield", 90, "#C8102E", "#00B2A9"),
      club("Manchester City", "Man City", "MCI", "Manchester", "Etihad Stadium", 91, "#6CABDD", "#1C2C5B"),
      club("Manchester United", "Man Utd", "MUN", "Manchester", "Old Trafford", 79, "#DA291C", "#FBE122"),
      club("Newcastle United", "Newcastle", "NEW", "Newcastle", "St James' Park", 80, "#241F20", "#FFFFFF"),
      club("Nottingham Forest", "Forest", "NFO", "Nottingham", "City Ground", 75, "#DD0000", "#FFFFFF"),
      club("Sunderland", "Sunderland", "SUN", "Sunderland", "Stadium of Light", 64, "#EB172B", "#FFFFFF"),
      club("Tottenham Hotspur", "Spurs", "TOT", "London", "Tottenham Hotspur Stadium", 78, "#132257", "#FFFFFF"),
      club("West Ham United", "West Ham", "WHU", "London", "London Stadium", 71, "#7A263A", "#1BB1E7"),
      club("Wolverhampton", "Wolves", "WOL", "Wolverhampton", "Molineux", 69, "#FDB913", "#231F20"),
      club("Burnley", "Burnley", "BUR", "Burnley", "Turf Moor", 65, "#6C1D45", "#99D6EA"),
    ],
  },
  {
    slug: "laliga",
    name: "LaLiga",
    code: "LAL",
    country: "Spain",
    staggerSeconds: 60,
    clubs: [
      club("Real Madrid", "Real Madrid", "RMA", "Madrid", "Santiago Bernabéu", 91, "#FFFFFF", "#FEBE10"),
      club("Barcelona", "Barcelona", "BAR", "Barcelona", "Camp Nou", 90, "#A50044", "#004D98"),
      club("Atlético Madrid", "Atlético", "ATM", "Madrid", "Metropolitano", 85, "#CB3524", "#272E61"),
      club("Athletic Club", "Athletic", "ATH", "Bilbao", "San Mamés", 79, "#EE2523", "#FFFFFF"),
      club("Villarreal", "Villarreal", "VIL", "Villarreal", "La Cerámica", 78, "#FFE667", "#005187"),
      club("Real Betis", "Betis", "BET", "Seville", "Benito Villamarín", 76, "#00954C", "#FFFFFF"),
      club("Real Sociedad", "R. Sociedad", "RSO", "San Sebastián", "Anoeta", 77, "#0067B1", "#FFFFFF"),
      club("Sevilla", "Sevilla", "SEV", "Seville", "Sánchez-Pizjuán", 73, "#FFFFFF", "#D4021D"),
      club("Valencia", "Valencia", "VAL", "Valencia", "Mestalla", 72, "#FFFFFF", "#F7931E"),
      club("Girona", "Girona", "GIR", "Girona", "Montilivi", 72, "#CD2534", "#FFFFFF"),
      club("Celta Vigo", "Celta", "CEL", "Vigo", "Balaídos", 71, "#8AC3EE", "#FFFFFF"),
      club("Osasuna", "Osasuna", "OSA", "Pamplona", "El Sadar", 70, "#D91A21", "#0A346F"),
      club("Rayo Vallecano", "Rayo", "RAY", "Madrid", "Vallecas", 69, "#FFFFFF", "#E53027"),
      club("Mallorca", "Mallorca", "MLL", "Palma", "Son Moix", 68, "#E20613", "#000000"),
      club("Getafe", "Getafe", "GET", "Getafe", "Coliseum", 67, "#004FA3", "#FFFFFF"),
      club("Alavés", "Alavés", "ALA", "Vitoria", "Mendizorroza", 66, "#0761AF", "#FFFFFF"),
      club("Espanyol", "Espanyol", "ESP", "Barcelona", "RCDE Stadium", 67, "#007FC8", "#FFFFFF"),
      club("Levante", "Levante", "LEV", "Valencia", "Ciutat de València", 64, "#B4053F", "#005999"),
      club("Elche", "Elche", "ELC", "Elche", "Martínez Valero", 63, "#FFFFFF", "#006B3F"),
      club("Real Oviedo", "Oviedo", "OVI", "Oviedo", "Carlos Tartiere", 62, "#0033A0", "#FFFFFF"),
    ],
  },
  {
    slug: "serie-a",
    name: "Serie A",
    code: "SEA",
    country: "Italy",
    staggerSeconds: 120,
    clubs: [
      club("Inter", "Inter", "INT", "Milan", "San Siro", 89, "#010E80", "#000000"),
      club("Napoli", "Napoli", "NAP", "Naples", "Stadio Maradona", 87, "#12A0D7", "#FFFFFF"),
      club("Milan", "Milan", "MIL", "Milan", "San Siro", 84, "#FB090B", "#000000"),
      club("Juventus", "Juventus", "JUV", "Turin", "Allianz Stadium", 84, "#000000", "#FFFFFF"),
      club("Atalanta", "Atalanta", "ATA", "Bergamo", "Gewiss Stadium", 82, "#1E71B8", "#000000"),
      club("Roma", "Roma", "ROM", "Rome", "Stadio Olimpico", 80, "#8E1F2F", "#F0BC42"),
      club("Lazio", "Lazio", "LAZ", "Rome", "Stadio Olimpico", 78, "#87D8F7", "#FFFFFF"),
      club("Fiorentina", "Fiorentina", "FIO", "Florence", "Artemio Franchi", 77, "#482E92", "#FFFFFF"),
      club("Bologna", "Bologna", "BOL", "Bologna", "Dall'Ara", 77, "#1A2F48", "#A21C26"),
      club("Torino", "Torino", "TOR", "Turin", "Stadio Olimpico Grande Torino", 71, "#8B1B1B", "#FFFFFF"),
      club("Udinese", "Udinese", "UDI", "Udine", "Bluenergy Stadium", 70, "#000000", "#FFFFFF"),
      club("Genoa", "Genoa", "GEN", "Genoa", "Luigi Ferraris", 69, "#AE1C28", "#00213F"),
      club("Como", "Como", "COM", "Como", "Giuseppe Sinigaglia", 70, "#0B2D66", "#FFFFFF"),
      club("Cagliari", "Cagliari", "CAG", "Cagliari", "Unipol Domus", 67, "#B01E2F", "#0A2C6A"),
      club("Parma", "Parma", "PAR", "Parma", "Ennio Tardini", 66, "#FFE500", "#004B87"),
      club("Lecce", "Lecce", "LEC", "Lecce", "Via del Mare", 65, "#FFD500", "#D3232E"),
      club("Hellas Verona", "Verona", "VER", "Verona", "Bentegodi", 66, "#002F6C", "#FFE500"),
      club("Sassuolo", "Sassuolo", "SAS", "Sassuolo", "Mapei Stadium", 68, "#00A752", "#000000"),
      club("Pisa", "Pisa", "PIS", "Pisa", "Arena Garibaldi", 63, "#002F6C", "#000000"),
      club("Cremonese", "Cremonese", "CRE", "Cremona", "Giovanni Zini", 62, "#A0A0A0", "#C8102E"),
    ],
  },
  {
    slug: "ligue-1",
    name: "Ligue 1",
    code: "LG1",
    country: "France",
    staggerSeconds: 180,
    clubs: [
      club("Paris Saint-Germain", "PSG", "PSG", "Paris", "Parc des Princes", 92, "#004170", "#DA291C"),
      club("Marseille", "Marseille", "MAR", "Marseille", "Vélodrome", 82, "#2FAEE0", "#FFFFFF"),
      club("Monaco", "Monaco", "MON", "Monaco", "Stade Louis II", 81, "#E51B22", "#FFFFFF"),
      club("Lille", "Lille", "LIL", "Lille", "Pierre-Mauroy", 78, "#E01E13", "#FFFFFF"),
      club("Lyon", "Lyon", "LYO", "Lyon", "Groupama Stadium", 77, "#FFFFFF", "#1E3F8F"),
      club("Nice", "Nice", "NIC", "Nice", "Allianz Riviera", 75, "#CC0000", "#000000"),
      club("Lens", "Lens", "LEN", "Lens", "Bollaert-Delelis", 74, "#FFD100", "#E31B23"),
      club("Rennes", "Rennes", "REN", "Rennes", "Roazhon Park", 74, "#E13327", "#000000"),
      club("Strasbourg", "Strasbourg", "STR", "Strasbourg", "La Meinau", 72, "#1E90FF", "#FFFFFF"),
      club("Toulouse", "Toulouse", "TFC", "Toulouse", "Stadium de Toulouse", 70, "#5A2D82", "#FFFFFF"),
      club("Nantes", "Nantes", "NAN", "Nantes", "La Beaujoire", 68, "#FCD405", "#00843D"),
      club("Brest", "Brest", "BRS", "Brest", "Francis-Le Blé", 70, "#E30613", "#FFFFFF"),
      club("Auxerre", "Auxerre", "AUX", "Auxerre", "Abbé-Deschamps", 66, "#FFFFFF", "#1B4A9C"),
      club("Angers", "Angers", "ANG", "Angers", "Raymond-Kopa", 64, "#000000", "#FFFFFF"),
      club("Le Havre", "Le Havre", "HAC", "Le Havre", "Stade Océane", 64, "#7BC4E8", "#0A2E6E"),
      club("Lorient", "Lorient", "LOR", "Lorient", "Le Moustoir", 65, "#F58220", "#000000"),
      club("Metz", "Metz", "MET", "Metz", "Saint-Symphorien", 63, "#8B1E3F", "#FFFFFF"),
      club("Paris FC", "Paris FC", "PFC", "Paris", "Stade Jean-Bouin", 65, "#1D3B8F", "#FFFFFF"),
      club("Reims", "Reims", "REI", "Reims", "Auguste-Delaune", 66, "#E4002B", "#FFFFFF"),
      club("Montpellier", "Montpellier", "MPL", "Montpellier", "La Mosson", 65, "#1B2E6B", "#F58220"),
    ],
  },
];
