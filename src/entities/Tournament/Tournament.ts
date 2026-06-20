import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { TournamentGroup } from "./TournamentGroup.ts";
import type { TournamentMatch, TournamentPhase } from "./TournamentMatch.ts";
import type { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";

export interface KnockoutRound {
  readonly phase: TournamentPhase;
  matches: TournamentMatch[];
}

export interface KnockoutBracket {
  rounds: KnockoutRound[]; // r32, r16, qf, sf, 3rd, final — in order
}

export interface Tournament {
  readonly playerTeam: WorldCupTeam;
  readonly groups: TournamentGroup[];
  knockoutBracket: KnockoutBracket;
  phase: TournamentPhase;
  playerPowerUps: PowerUpCard[];
  adRewardUsesLeft: number;
}
