import type { TournamentGroup, GroupStanding } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";

export function computeStandings(group: TournamentGroup): GroupStanding[] {
  const map = new Map<string, GroupStanding>();

  for (const team of group.teams) {
    map.set(team.id, {
      team,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    });
  }

  for (const match of group.matches) {
    if (match.homeGoals === null || match.awayGoals === null) continue;

    const home = map.get(match.home.id)!;
    const away = map.get(match.away.id)!;

    home.played++;
    away.played++;
    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;

    if (match.homeGoals > match.awayGoals) {
      home.won++;  home.points += 3;
      away.lost++;
    } else if (match.homeGoals < match.awayGoals) {
      away.won++;  away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points += 1;
      away.drawn++; away.points += 1;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

// Returns which position (0=1st, 1=2nd, 2=3rd, 3=4th) a team finished.
export function positionOf(team: WorldCupTeam, standings: GroupStanding[]): number {
  return standings.findIndex((s) => s.team.id === team.id);
}

// Returns the best N third-place teams across all groups, sorted by points → GD → GF.
// In a 48-team World Cup (12 groups), the best 8 third-place teams advance.
export function rankThirdPlaceTeams(groups: TournamentGroup[], count = 8): GroupStanding[] {
  const thirds = groups
    .map((g) => computeStandings(g)[2])
    .filter(Boolean) as GroupStanding[];
  return thirds
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    })
    .slice(0, count);
}
