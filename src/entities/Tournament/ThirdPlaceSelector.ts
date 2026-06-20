import type { TournamentGroup, GroupStanding } from "./TournamentGroup.ts";

// Returns the 8 best third-place teams across all 12 groups, sorted by the
// same criteria used in official FIFA rules: points → goal difference → goals for.
export function selectBest8Thirds(groups: TournamentGroup[]): GroupStanding[] {
  const thirds: GroupStanding[] = groups
    .filter((g) => g.standings.length >= 3)
    .map((g) => g.standings[2]);

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  return thirds.slice(0, 8);
}
