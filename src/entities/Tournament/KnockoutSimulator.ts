import type { IRng } from "../Match/IRng.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { TournamentMatch } from "./TournamentMatch.ts";
import type { KnockoutBracket } from "./Tournament.ts";

// Simulates a knockout match. There are no draws — if level after 90 min,
// we simulate a penalty shootout via weighted coin toss.
export function simulateKnockoutMatch(
  home: WorldCupTeam,
  away: WorldCupTeam,
  rng: IRng,
): { homeGoals: number; awayGoals: number; winner: WorldCupTeam } {
  const pHome = home.power / (home.power + away.power);

  let homeGoals = 0;
  let awayGoals = 0;

  // Generate goals (similar to group sim but slightly fewer due to defensive play)
  for (let i = 0; i < 3; i++) {
    if (rng.next() < pHome * 0.6) homeGoals++;
    if (rng.next() < (1 - pHome) * 0.6) awayGoals++;
  }

  if (homeGoals !== awayGoals) {
    return { homeGoals, awayGoals, winner: homeGoals > awayGoals ? home : away };
  }

  // Penalty shootout: simple coin toss weighted by power
  const winner = rng.next() < pHome ? home : away;
  return { homeGoals, awayGoals, winner };
}

// Advances winners from a completed round into the next round's slots.
export function advanceRound(bracket: KnockoutBracket, rng: IRng): KnockoutBracket {
  const rounds = bracket.rounds.map((r) => ({ ...r, matches: [...r.matches] }));

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const current = rounds[ri];
    const next = rounds[ri + 1];

    // Check if current round is fully resolved
    if (current.matches.some((m) => m.winner === null && m.homeGoals === null)) {
      break;
    }

    const winners = current.matches
      .filter((m) => m.winner !== null)
      .map((m) => m.winner as WorldCupTeam);

    // SF fan-out: winners → final, losers → 3rd-place match
    if (current.phase === "sf") {
      const losers = current.matches
        .filter((m) => m.winner)
        .map((m) => (m.winner!.id === m.home.id ? m.away : m.home));
      const finalIdx = rounds.findIndex((r) => r.phase === "final");
      const thirdIdx = rounds.findIndex((r) => r.phase === "3rd");
      // Propagate isPlayerMatch to the final if the player reached the SF.
      const playerInSf = current.matches.some((m) => m.isPlayerMatch);
      if (finalIdx !== -1 && winners.length >= 2)
        rounds[finalIdx].matches[0] = {
          ...rounds[finalIdx].matches[0],
          home: winners[0],
          away: winners[1],
          isPlayerMatch: playerInSf,
        };
      if (thirdIdx !== -1 && losers.length >= 2)
        rounds[thirdIdx].matches[0] = { ...rounds[thirdIdx].matches[0], home: losers[0], away: losers[1] };
      break; // SF fan-out is complete; do not continue linear propagation
    }

    // Pair winners into next round matches
    for (let i = 0; i < next.matches.length; i++) {
      const home = winners[i * 2];
      const away = winners[i * 2 + 1];
      if (!home || !away) continue;

      // Propagate isPlayerMatch from either paired current-round match so the
      // player's future slot is preserved (not simulated) and the cascade stops.
      const isPlayerNextMatch =
        (current.matches[i * 2]?.isPlayerMatch ?? false) ||
        (current.matches[i * 2 + 1]?.isPlayerMatch ?? false);

      if (!isPlayerNextMatch && !next.matches[i].isPlayerMatch) {
        const result = simulateKnockoutMatch(home, away, rng);
        next.matches[i] = {
          ...next.matches[i],
          home,
          away,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          winner: result.winner,
        };
      } else {
        next.matches[i] = { ...next.matches[i], home, away, isPlayerMatch: true };
      }
    }
  }

  return { rounds };
}

// Simulates all unplayed non-player matches in a round.
export function simulateRound(
  matches: TournamentMatch[],
  rng: IRng,
): TournamentMatch[] {
  return matches.map((m) => {
    if (m.isPlayerMatch || m.homeGoals !== null) return m;
    const result = simulateKnockoutMatch(m.home, m.away, rng);
    return { ...m, ...result };
  });
}

// Simulates a complete bracket from start to finish, correctly handling the
// SF→Final and SF→3rd splits. Returns a new bracket; does not mutate the input.
export function simulateFullBracket(bracket: KnockoutBracket, rng: IRng): KnockoutBracket {
  const rounds = bracket.rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  for (let ri = 0; ri < rounds.length; ri++) {
    // Simulate all non-TBD, unplayed matches in this round
    rounds[ri].matches = rounds[ri].matches.map((m) => {
      if (m.homeGoals !== null || m.home.id === "tbd" || m.away.id === "tbd") return m;
      return { ...m, ...simulateKnockoutMatch(m.home, m.away, rng) };
    });

    const winners = rounds[ri].matches.filter((m) => m.winner).map((m) => m.winner!);

    if (rounds[ri].phase === "sf") {
      // SF splits: winners → final, losers → 3rd place
      const losers = rounds[ri].matches
        .filter((m) => m.winner)
        .map((m) => (m.winner!.id === m.home.id ? m.away : m.home));
      const finalIdx = rounds.findIndex((r) => r.phase === "final");
      const thirdIdx = rounds.findIndex((r) => r.phase === "3rd");
      if (finalIdx !== -1 && winners.length >= 2)
        rounds[finalIdx].matches[0] = {
          ...rounds[finalIdx].matches[0],
          home: winners[0],
          away: winners[1],
        };
      if (thirdIdx !== -1 && losers.length >= 2)
        rounds[thirdIdx].matches[0] = {
          ...rounds[thirdIdx].matches[0],
          home: losers[0],
          away: losers[1],
        };
    } else if (rounds[ri].phase !== "3rd" && ri + 1 < rounds.length) {
      // Standard propagation: pair winners into next round
      for (let i = 0; i < rounds[ri + 1].matches.length; i++) {
        const home = winners[i * 2];
        const away = winners[i * 2 + 1];
        if (home && away)
          rounds[ri + 1].matches[i] = { ...rounds[ri + 1].matches[i], home, away };
      }
    }
  }

  return { rounds };
}
