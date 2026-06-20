import type { WorldCupTeam } from "./WorldCupTeam.ts";

export type TournamentPhase =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "3rd"
  | "final";

export interface TournamentMatch {
  readonly id: string;
  readonly home: WorldCupTeam;
  readonly away: WorldCupTeam;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Null means draw (group stage only). Knockout matches always have a winner. */
  winner: WorldCupTeam | null;
  readonly phase: TournamentPhase;
  /** True when the human player is participating in this match. */
  readonly isPlayerMatch: boolean;
}
