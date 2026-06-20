import type { Tournament } from "./Tournament.ts";
import type { TournamentGroup } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import { getTeamById, GROUP_ASSIGNMENTS } from "./TeamData.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";

export function createTournament(playerTeamId: string): Tournament {
  const playerTeam = getTeamById(playerTeamId); // throws if unknown

  const groups: TournamentGroup[] = GROUP_ASSIGNMENTS.map((g) => {
    const teams = g.teamIds.map(getTeamById) as [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam];
    return {
      id: g.groupId,
      teams,
      matches: [],
      standings: [],
    };
  });

  const playerPowerUps = [
    new AdrenalineBoost(11, "Adrenaline", "Power boost.", ""),
    new FocusPill(12, "Focus", "Immune to actives.", ""),
    new TimeRewind(13, "Time Rewind", "Rewinds cooldown.", ""),
  ];

  return {
    playerTeam,
    groups,
    knockoutBracket: { rounds: [] },
    phase: "group",
    playerPowerUps,
    adRewardUsesLeft: 5,
  };
}
