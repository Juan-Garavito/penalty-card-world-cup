import type { TournamentGroup } from "./TournamentGroup.ts";
import type { TournamentMatch, TournamentPhase } from "./TournamentMatch.ts";
import type { KnockoutBracket, KnockoutRound } from "./Tournament.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import { selectBest8Thirds } from "./ThirdPlaceSelector.ts";

// Builds the initial knockout bracket from completed group standings.
// Round of 32 pairings follow the official FIFA 2026 bracket:
// 1st-place teams vs 3rd-place or worst 2nd-place teams to avoid same-group clashes.
// For simplicity we use a seeded snake format: winner(A) vs runner-up(B), etc.
export function buildKnockoutBracket(
  groups: TournamentGroup[],
): KnockoutBracket {
  // Collect qualifiers
  const firsts = groups.map((g) => g.standings[0].team);   // 12 winners
  const seconds = groups.map((g) => g.standings[1].team);  // 12 runners-up
  const best8Thirds = selectBest8Thirds(groups).map((s) => s.team);

  // 32 qualifiers: 12 firsts + 12 seconds + 8 thirds
  const qualifiers: WorldCupTeam[] = [...firsts, ...seconds, ...best8Thirds];

  // Pair them: 1st from group A vs last qualifier, snake-style for balanced bracket
  const r32Matches: TournamentMatch[] = [];
  const top16 = qualifiers.slice(0, 16);   // seeded
  const bottom16 = qualifiers.slice(16).reverse(); // unseeded

  for (let i = 0; i < 16; i++) {
    r32Matches.push({
      id: `r32-${i}`,
      home: top16[i],
      away: bottom16[i],
      homeGoals: null,
      awayGoals: null,
      winner: null,
      phase: "r32",
      isPlayerMatch: false,
    });
  }

  // Subsequent rounds start empty — filled as previous rounds resolve.
  const emptyRound = (phase: TournamentPhase, count: number): KnockoutRound => ({
    phase,
    matches: Array.from({ length: count }, (_, i) => ({
      id: `${phase}-${i}`,
      home: { id: "tbd", name: "TBD", confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power: 0, abbreviation: "TBD", flagSpec: { h: ["red", "white"] as ["red", "white"] } },
      away: { id: "tbd", name: "TBD", confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power: 0, abbreviation: "TBD", flagSpec: { h: ["red", "white"] as ["red", "white"] } },
      homeGoals: null,
      awayGoals: null,
      winner: null,
      phase,
      isPlayerMatch: false,
    })),
  });

  return {
    rounds: [
      { phase: "r32", matches: r32Matches },
      emptyRound("r16", 8),
      emptyRound("qf", 4),
      emptyRound("sf", 2),
      emptyRound("3rd", 1),
      emptyRound("final", 1),
    ],
  };
}
