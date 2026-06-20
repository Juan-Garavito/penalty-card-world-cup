import { describe, it, expect } from "vitest";
import { buildKnockoutBracket } from "./KnockoutBracketBuilder.ts";
import type { TournamentGroup, GroupStanding } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";

function makeTeam(id: string, power = 70): WorldCupTeam {
  return { id, name: id, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power, abbreviation: id.slice(0, 3).toUpperCase(), flagSpec: { h: ["red", "white"] as ["red", "white"] } };
}

function makeStanding(team: WorldCupTeam, pts: number): GroupStanding {
  return { team, played: 3, won: pts / 3, drawn: 0, lost: 0, goalsFor: pts, goalsAgainst: 0, points: pts };
}

function makeGroup(id: string): TournamentGroup {
  const teams = [makeTeam(`${id}1`), makeTeam(`${id}2`), makeTeam(`${id}3`), makeTeam(`${id}4`)];
  return {
    id,
    teams: teams as [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam],
    matches: [],
    standings: [
      makeStanding(teams[0], 9),
      makeStanding(teams[1], 6),
      makeStanding(teams[2], 3),
      makeStanding(teams[3], 0),
    ],
  };
}

describe("buildKnockoutBracket", () => {
  const groups = "ABCDEFGHIJKL".split("").map(makeGroup);

  it("produces a Round of 32 with 16 matches", () => {
    const bracket = buildKnockoutBracket(groups);
    const r32 = bracket.rounds.find((r) => r.phase === "r32");
    expect(r32).toBeDefined();
    expect(r32!.matches).toHaveLength(16);
  });

  it("has all 6 phases: r32, r16, qf, sf, 3rd, final", () => {
    const bracket = buildKnockoutBracket(groups);
    const phases = bracket.rounds.map((r) => r.phase);
    expect(phases).toContain("r32");
    expect(phases).toContain("r16");
    expect(phases).toContain("qf");
    expect(phases).toContain("sf");
    expect(phases).toContain("3rd");
    expect(phases).toContain("final");
  });

  it("R32 involves exactly 32 unique teams", () => {
    const bracket = buildKnockoutBracket(groups);
    const r32 = bracket.rounds.find((r) => r.phase === "r32")!;
    const ids = new Set<string>();
    for (const m of r32.matches) {
      ids.add(m.home.id);
      ids.add(m.away.id);
    }
    expect(ids.size).toBe(32);
  });
});
