import type { IRng } from "../Match/IRng.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { TournamentGroup } from "./TournamentGroup.ts";
import type { TournamentMatch } from "./TournamentMatch.ts";
import { computeStandings } from "./StandingsCalculator.ts";

// Standard FIFA group-stage matchday pairing for a 4-team group.
// MD1: (0,1) and (2,3) — sums 1 and 5
// MD2: (0,2) and (1,3) — sums 2 and 4
// MD3: (0,3) and (1,2) — sum 3
export function getMatchdayForIndices(i: number, j: number): 1 | 2 | 3 {
  const sum = Math.min(i, j) + Math.max(i, j);
  if (sum === 1 || sum === 5) return 1;
  if (sum === 2 || sum === 4) return 2;
  return 3;
}

export function getMatchday(group: TournamentGroup, match: TournamentMatch): 1 | 2 | 3 {
  const teams = group.teams;
  const hi = teams.findIndex((t) => t.id === match.home.id);
  const ai = teams.findIndex((t) => t.id === match.away.id);
  return getMatchdayForIndices(hi, ai);
}

// Simulates (or creates + simulates) all non-player matches for the given matchday.
// Mutates group.matches in place so changes persist in the tournament object graph.
export function simulateGroupMatchday(
  group: TournamentGroup,
  matchday: 1 | 2 | 3,
  rng: IRng,
): void {
  const teams = group.teams;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      if (getMatchdayForIndices(i, j) !== matchday) continue;
      const id = `${group.id}-${teams[i].id}-vs-${teams[j].id}`;
      const existing = group.matches.find((m) => m.id === id);
      if (existing) {
        if (existing.homeGoals !== null || existing.isPlayerMatch) continue;
        const result = simulateMatch(teams[i], teams[j], rng);
        existing.homeGoals = result.homeGoals;
        existing.awayGoals = result.awayGoals;
        existing.winner = result.winner;
      } else {
        const result = simulateMatch(teams[i], teams[j], rng);
        group.matches.push({
          id,
          home: teams[i],
          away: teams[j],
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          winner: result.winner,
          phase: "group",
          isPlayerMatch: false,
        });
      }
    }
  }
}

interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  winner: WorldCupTeam | null;
}

// Simplified Poisson goal generation: lambda derived from team powers and an
// average of ~1.3 goals per team per match (historical group-stage average).
function sampleGoals(attackPower: number, defensePower: number, rng: IRng): number {
  const base = 1.3;
  const lambda = base * (attackPower / (attackPower + defensePower)) * 2;
  // Poisson via multiplication of uniforms: P(X=k) ~ e^-λ λ^k / k!
  let goals = 0;
  let p = Math.exp(-lambda);
  let cumulative = p;
  const u = rng.next();
  while (u > cumulative) {
    goals++;
    p *= lambda / goals;
    cumulative += p;
    if (goals > 10) break; // safety cap
  }
  return goals;
}

export function simulateMatch(
  home: WorldCupTeam,
  away: WorldCupTeam,
  rng: IRng,
): MatchResult {
  const homeGoals = sampleGoals(home.power, away.power, rng);
  const awayGoals = sampleGoals(away.power, home.power, rng);
  const winner =
    homeGoals > awayGoals ? home : awayGoals > homeGoals ? away : null;
  return { homeGoals, awayGoals, winner };
}

// Generates all 6 round-robin matches for a group (skips already-played ones)
// and recomputes standings.
export function simulateGroup(group: TournamentGroup, rng: IRng): TournamentGroup {
  const teams = group.teams;
  const existingIds = new Set(group.matches.map((m) => m.id));
  const newMatches: TournamentMatch[] = [...group.matches];

  // Generate round-robin pairs not yet played
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const id = `${group.id}-${teams[i].id}-vs-${teams[j].id}`;
      if (existingIds.has(id)) continue;

      const existing = group.matches.find(
        (m) =>
          (m.home.id === teams[i].id && m.away.id === teams[j].id) ||
          (m.home.id === teams[j].id && m.away.id === teams[i].id),
      );
      if (existing && existing.homeGoals !== null) continue;

      const result = simulateMatch(teams[i], teams[j], rng);
      newMatches.push({
        id,
        home: teams[i],
        away: teams[j],
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        winner: result.winner,
        phase: "group",
        isPlayerMatch: false,
      });
    }
  }

  const updated: TournamentGroup = {
    ...group,
    matches: newMatches,
    standings: [],
  };
  updated.standings = computeStandings(updated);
  return updated;
}
