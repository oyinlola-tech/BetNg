/** The competitions and clubs of the virtual season. */

import type { LeagueId, TeamId } from "@betng/contracts";
import type { Player, TeamColors, TeamDetailView } from "@betng/ui-core";
import { rng, uuidFrom } from "./prng.js";

export interface ClubSeed {
  readonly name: string;
  readonly shortName: string;
  readonly code: string;
  readonly city: string;
  readonly stadium: string;
  readonly manager: string;
  readonly founded: number;
  readonly strength: number;
  readonly colors: TeamColors;
}

export interface LeagueSeed {
  readonly key: string;
  readonly name: string;
  readonly code: string;
  readonly country: string;
  readonly offsetSeconds: number;
  readonly clubs: readonly ClubSeed[];
}

const kit = (
  primary: string,
  secondary: string,
  onPrimary = "#FFFFFF",
): TeamColors => ({
  primary,
  secondary,
  onPrimary,
});

export const LEAGUES: readonly LeagueSeed[] = [
  {
    key: "bvpl",
    name: "BetNG Virtual Premier League",
    code: "BVPL",
    country: "Nigeria",
    offsetSeconds: 0,
    clubs: [
      {
        name: "Lagos FC",
        shortName: "Lagos",
        code: "LAG",
        city: "Lagos",
        stadium: "Lekki Arena",
        manager: "Bayo Oshinowo",
        founded: 1998,
        strength: 84,
        colors: kit("#1F3A93", "#F2C744"),
      },
      {
        name: "Port Harcourt City",
        shortName: "PH City",
        code: "PHC",
        city: "Port Harcourt",
        stadium: "Garden City Ground",
        manager: "Tamuno Briggs",
        founded: 2001,
        strength: 80,
        colors: kit("#0B7A4B", "#FFFFFF"),
      },
      {
        name: "Abuja FC",
        shortName: "Abuja",
        code: "ABJ",
        city: "Abuja",
        stadium: "Capital Park",
        manager: "Ifeanyi Ugo",
        founded: 1994,
        strength: 78,
        colors: kit("#8B1E3F", "#F5F5F5"),
      },
      {
        name: "Kano United",
        shortName: "Kano Utd",
        code: "KAN",
        city: "Kano",
        stadium: "Sabon Gari Stadium",
        manager: "Abdulrahman Sani",
        founded: 1987,
        strength: 76,
        colors: kit("#B7410E", "#1A1A1A"),
      },
      {
        name: "Ibadan FC",
        shortName: "Ibadan",
        code: "IBD",
        city: "Ibadan",
        stadium: "Oke-Ado Field",
        manager: "Kunle Akinwande",
        founded: 1990,
        strength: 72,
        colors: kit("#6D2E8C", "#F7E7B4"),
      },
      {
        name: "Benin City FC",
        shortName: "Benin",
        code: "BEN",
        city: "Benin City",
        stadium: "Bronze Stadium",
        manager: "Osaze Igbinedion",
        founded: 1996,
        strength: 70,
        colors: kit("#B8860B", "#1A1A1A", "#111111"),
      },
      {
        name: "Enugu FC",
        shortName: "Enugu",
        code: "ENU",
        city: "Enugu",
        stadium: "Coal City Arena",
        manager: "Chukwuemeka Nnaji",
        founded: 1985,
        strength: 74,
        colors: kit("#1B1B1B", "#E63946"),
      },
      {
        name: "Kaduna FC",
        shortName: "Kaduna",
        code: "KAD",
        city: "Kaduna",
        stadium: "Crocodile Park",
        manager: "Yakubu Danjuma",
        founded: 1992,
        strength: 66,
        colors: kit("#2E7D32", "#FFD54F"),
      },
      {
        name: "Calabar Rovers",
        shortName: "Calabar",
        code: "CAL",
        city: "Calabar",
        stadium: "Marina Stadium",
        manager: "Effiong Bassey",
        founded: 2004,
        strength: 64,
        colors: kit("#0D5C75", "#F4A261"),
      },
      {
        name: "Jos Highlanders",
        shortName: "Jos",
        code: "JOS",
        city: "Jos",
        stadium: "Plateau Heights",
        manager: "Dung Pam",
        founded: 1999,
        strength: 68,
        colors: kit("#4A4A4A", "#9ED8DB"),
      },
      {
        name: "Owerri Athletic",
        shortName: "Owerri",
        code: "OWE",
        city: "Owerri",
        stadium: "Heartland Bowl",
        manager: "Obiora Nwachukwu",
        founded: 2003,
        strength: 62,
        colors: kit("#C62828", "#FFFFFF"),
      },
      {
        name: "Warri Mariners",
        shortName: "Warri",
        code: "WAR",
        city: "Warri",
        stadium: "Delta Dock Stadium",
        manager: "Ovie Omo-Agege",
        founded: 1997,
        strength: 60,
        colors: kit("#00838F", "#FFFFFF"),
      },
    ],
  },
  {
    key: "bvc",
    name: "BetNG Virtual Championship",
    code: "BVC",
    country: "Nigeria",
    offsetSeconds: 120,
    clubs: [
      {
        name: "Uyo FC",
        shortName: "Uyo",
        code: "UYO",
        city: "Uyo",
        stadium: "Ibom Field",
        manager: "Aniekan Udoh",
        founded: 2006,
        strength: 72,
        colors: kit("#E65100", "#1A1A1A"),
      },
      {
        name: "Ilorin Royals",
        shortName: "Ilorin",
        code: "ILR",
        city: "Ilorin",
        stadium: "Emirate Park",
        manager: "Saka Olayinka",
        founded: 2002,
        strength: 70,
        colors: kit("#4527A0", "#FFD700"),
      },
      {
        name: "Maiduguri FC",
        shortName: "Maiduguri",
        code: "MAI",
        city: "Maiduguri",
        stadium: "Sahel Arena",
        manager: "Bukar Modu",
        founded: 1995,
        strength: 63,
        colors: kit("#37474F", "#FFAB00"),
      },
      {
        name: "Abeokuta Rocks",
        shortName: "Abeokuta",
        code: "ABK",
        city: "Abeokuta",
        stadium: "Olumo Ground",
        manager: "Dapo Sowunmi",
        founded: 2000,
        strength: 68,
        colors: kit("#5D4037", "#E0E0E0"),
      },
      {
        name: "Makurdi FC",
        shortName: "Makurdi",
        code: "MAK",
        city: "Makurdi",
        stadium: "Benue Riverside",
        manager: "Terver Akaa",
        founded: 1998,
        strength: 61,
        colors: kit("#00695C", "#FFFFFF"),
      },
      {
        name: "Zaria Knights",
        shortName: "Zaria",
        code: "ZAR",
        city: "Zaria",
        stadium: "Kongo Stadium",
        manager: "Ibrahim Shehu",
        founded: 1991,
        strength: 65,
        colors: kit("#283593", "#FFFFFF"),
      },
      {
        name: "Asaba Delta",
        shortName: "Asaba",
        code: "ASA",
        city: "Asaba",
        stadium: "Riverbank Park",
        manager: "Nkem Okonkwo",
        founded: 2005,
        strength: 66,
        colors: kit("#AD1457", "#FFFFFF"),
      },
      {
        name: "Yenagoa Tide",
        shortName: "Yenagoa",
        code: "YEN",
        city: "Yenagoa",
        stadium: "Creek Stadium",
        manager: "Ebipade Diri",
        founded: 2008,
        strength: 58,
        colors: kit("#01579B", "#B3E5FC"),
      },
      {
        name: "Lokoja Confluence",
        shortName: "Lokoja",
        code: "LOK",
        city: "Lokoja",
        stadium: "Confluence Ground",
        manager: "Idris Ajanah",
        founded: 2001,
        strength: 60,
        colors: kit("#33691E", "#F0F4C3"),
      },
      {
        name: "Onitsha City",
        shortName: "Onitsha",
        code: "ONI",
        city: "Onitsha",
        stadium: "Main Market Arena",
        manager: "Chidubem Okoye",
        founded: 1993,
        strength: 64,
        colors: kit("#BF360C", "#FFFFFF"),
      },
    ],
  },
];

const FIRST_NAMES = [
  "Tunde",
  "Chidi",
  "Musa",
  "Emeka",
  "Ibrahim",
  "Segun",
  "Kelechi",
  "Yusuf",
  "Femi",
  "Obinna",
  "Sadiq",
  "Uche",
  "Bello",
  "Tobi",
  "Nnamdi",
  "Aliyu",
  "Dayo",
  "Ikenna",
  "Suleiman",
  "Kayode",
  "Chinedu",
  "Abdullahi",
  "Olamide",
  "Ifeanyi",
  "Umar",
  "Bolaji",
  "Ekene",
  "Hassan",
  "Wale",
  "Chuka",
];

const LAST_NAMES = [
  "Adeyemi",
  "Okafor",
  "Abdullahi",
  "Nwosu",
  "Danladi",
  "Balogun",
  "Obi",
  "Bello",
  "Adebayo",
  "Eze",
  "Lawal",
  "Okonkwo",
  "Garba",
  "Afolabi",
  "Chukwu",
  "Mohammed",
  "Olawale",
  "Nnaji",
  "Sani",
  "Ogunleye",
  "Okoro",
  "Yusuf",
  "Bankole",
  "Igwe",
  "Musa",
  "Adesina",
  "Nwankwo",
  "Umar",
  "Fashola",
  "Onyeka",
];

const POSITIONS: readonly Player["position"][] = [
  "GK",
  "DF",
  "DF",
  "DF",
  "DF",
  "MF",
  "MF",
  "MF",
  "MF",
  "FW",
  "FW",
  "FW",
  "GK",
  "DF",
  "MF",
  "FW",
];

function squadFor(clubKey: string): readonly Player[] {
  const r = rng(`squad:${clubKey}`);
  const used = new Set<string>();

  return POSITIONS.map((position, index): Player => {
    let name = "";

    do {
      name = `${r.pick(FIRST_NAMES)} ${r.pick(LAST_NAMES)}`;
    } while (used.has(name));

    used.add(name);

    return {
      id: uuidFrom(`player:${clubKey}:${String(index)}`),
      name,
      position,
      shirt: index + 1,
    };
  });
}

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

  const clubs = seed.clubs.map((c): Club => ({
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
    manager: c.manager,
    founded: c.founded,
    squad: squadFor(`${seed.key}:${c.code}`),
  }));

  return { id: leagueId, seed, clubs, matchdays: (clubs.length - 1) * 2 };
});

export function competitionById(leagueId: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === leagueId);
}

export function clubById(teamId: string): Club | undefined {
  for (const c of COMPETITIONS) {
    const club = c.clubs.find((t) => t.id === teamId);

    if (club !== undefined) return club;
  }

  return undefined;
}
