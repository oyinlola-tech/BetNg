export interface Pairing {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
}

const BYE = "";

export function matchdaysPerSeason(teamCount: number): number {
  const slots = teamCount % 2 === 0 ? teamCount : teamCount + 1;

  return slots < 2 ? 0 : (slots - 1) * 2;
}

/** Every matchday of one season, in order. `teamIds` must be in a stable order for the season to be stable. */
export function buildSeason(
  teamIds: readonly string[],
): readonly (readonly Pairing[])[] {
  if (teamIds.length < 2) return [];

  const slots = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const count = slots.length;
  const rounds = count - 1;
  const fixed = slots[count - 1] ?? BYE;
  const firstHalf: Pairing[][] = [];

  for (let round = 0; round < rounds; round += 1) {
    const rotating = Array.from(
      { length: rounds },
      (_, index) => slots[(round + index) % rounds] ?? BYE,
    );
    const pairs: Pairing[] = [];
    const lead = rotating[0] ?? BYE;

    pairs.push(
      round % 2 === 0
        ? { homeTeamId: lead, awayTeamId: fixed }
        : { homeTeamId: fixed, awayTeamId: lead },
    );

    for (let index = 1; index <= (rounds - 1) / 2; index += 1) {
      const left = rotating[index] ?? BYE;
      const right = rotating[rounds - index] ?? BYE;

      pairs.push(
        index % 2 === 0
          ? { homeTeamId: left, awayTeamId: right }
          : { homeTeamId: right, awayTeamId: left },
      );
    }

    firstHalf.push(
      pairs.filter(
        (pair) => pair.homeTeamId !== BYE && pair.awayTeamId !== BYE,
      ),
    );
  }

  const secondHalf = firstHalf.map((pairs) =>
    pairs.map((pair) => ({
      homeTeamId: pair.awayTeamId,
      awayTeamId: pair.homeTeamId,
    })),
  );

  return [...firstHalf, ...secondHalf];
}
