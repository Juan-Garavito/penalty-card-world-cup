import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { TournamentMatch } from "./TournamentMatch.ts";

export interface GroupStanding {
  team: WorldCupTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TournamentGroup {
  readonly id: string; // "A"–"L"
  readonly teams: readonly [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam];
  matches: TournamentMatch[]; // 6 matches per group
  standings: GroupStanding[];
}
