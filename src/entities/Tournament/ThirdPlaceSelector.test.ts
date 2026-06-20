import { describe, it, expect } from "vitest";
import { selectBest8Thirds } from "./ThirdPlaceSelector.ts";
import type { TournamentGroup, GroupStanding } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";

function makeTeam(id: string, power = 70): WorldCupTeam {
  return { id, name: id, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power, abbreviation: id.slice(0, 3).toUpperCase(), flagSpec: { h: ["red", "white"] as ["red", "white"] } };
}

function makeStanding(team: WorldCupTeam, pts: number, gd: number, gf: number): GroupStanding {
  return { team, played: 3, won: 0, drawn: pts, lost: 0, goalsFor: gf, goalsAgainst: gf - gd, points: pts };
}

function makeGroup(id: string, standings: GroupStanding[]): TournamentGroup {
  return {
    id,
    teams: [standings[0].team, standings[1].team, standings[2].team, standings[3].team],
    matches: [],
    standings,
  };
}

describe("selectBest8Thirds", () => {
  it("returns exactly 8 teams from 12 groups", () => {
    const groups: TournamentGroup[] = [];
    for (let g = 0; g < 12; g++) {
      const letter = String.fromCharCode(65 + g);
      const teams = [0, 1, 2, 3].map((i) => makeTeam(`${letter}${i}`));
      const standings = [
        makeStanding(teams[0], 9, 5, 7),
        makeStanding(teams[1], 6, 2, 4),
        makeStanding(teams[2], 3, -1, 2),
        makeStanding(teams[3], 0, -6, 1),
      ];
      groups.push(makeGroup(letter, standings));
    }
    const best8 = selectBest8Thirds(groups);
    expect(best8).toHaveLength(8);
  });

  it("selects the 8 thirds with the most points", () => {
    const groups: TournamentGroup[] = [];
    // Groups where the 3rd-place team has points 1–12 (one per group)
    for (let g = 0; g < 12; g++) {
      const letter = String.fromCharCode(65 + g);
      const pts = g + 1; // group A third = 1pt, group L third = 12pts
      const teams = [0, 1, 2, 3].map((i) => makeTeam(`${letter}${i}`));
      const standings = [
        makeStanding(teams[0], 9, 5, 7),
        makeStanding(teams[1], 6, 2, 4),
        makeStanding(teams[2], pts, 0, 2),
        makeStanding(teams[3], 0, -6, 0),
      ];
      groups.push(makeGroup(letter, standings));
    }
    const best8 = selectBest8Thirds(groups);
    // Groups E–L (index 4–11) have 5–12 pts → should all be selected
    const ids = best8.map((s) => s.team.id);
    for (let g = 4; g < 12; g++) {
      const letter = String.fromCharCode(65 + g);
      expect(ids).toContain(`${letter}2`);
    }
  });
});
