import { describe, it, expect } from "vitest";
import { computeStandings, rankThirdPlaceTeams } from "./StandingsCalculator.ts";
import type { TournamentGroup } from "./TournamentGroup.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";

function makeTeam(id: string, power = 70): WorldCupTeam {
  return { id, name: id, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power, abbreviation: id.slice(0, 3).toUpperCase(), flagSpec: { h: ["red", "white"] as ["red", "white"] } };
}

function makeGroup(teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam]): TournamentGroup {
  return { id: "T", teams, matches: [], standings: [] };
}

describe("computeStandings", () => {
  it("sorts by points descending", () => {
    const [a, b, c, d] = [makeTeam("A"), makeTeam("B"), makeTeam("C"), makeTeam("D")];
    const group = makeGroup([a, b, c, d]);
    group.matches = [
      { id: "1", home: a, away: b, homeGoals: 2, awayGoals: 0, winner: a, phase: "group", isPlayerMatch: false },
      { id: "2", home: c, away: d, homeGoals: 1, awayGoals: 1, winner: null, phase: "group", isPlayerMatch: false },
      { id: "3", home: a, away: c, homeGoals: 1, awayGoals: 0, winner: a, phase: "group", isPlayerMatch: false },
      { id: "4", home: b, away: d, homeGoals: 3, awayGoals: 0, winner: b, phase: "group", isPlayerMatch: false },
      { id: "5", home: a, away: d, homeGoals: 0, awayGoals: 0, winner: null, phase: "group", isPlayerMatch: false },
      { id: "6", home: b, away: c, homeGoals: 1, awayGoals: 2, winner: c, phase: "group", isPlayerMatch: false },
    ];
    const standings = computeStandings(group);
    // A: 2W 1D = 7pts, B: 1W 1L 1L = 3pts, C: 1W 1D 1L = 4pts, D: 1D 2L = 1pt
    // Wait: A beats B(2-0), C(1-0), draws D(0-0) → 7pts gf=3 ga=0
    // B beats D(3-0), loses to A(0-2), loses to C(1-2) → 3pts gf=4 ga=4
    // C beats B(2-1), draws D(1-1), loses A(0-1) → 4pts gf=3 ga=3
    // D draws A(0-0), draws C(1-1), loses B(0-3) → 2pts gf=1 ga=4
    expect(standings[0].team.id).toBe("A");
    expect(standings[0].points).toBe(7);
    expect(standings[1].points).toBe(4); // C
    expect(standings[2].points).toBe(3); // B
    expect(standings[3].points).toBe(2); // D
  });

  it("breaks ties by goal difference then goals for", () => {
    const [a, b, c, d] = [makeTeam("A"), makeTeam("B"), makeTeam("C"), makeTeam("D")];
    const group = makeGroup([a, b, c, d]);
    group.matches = [
      { id: "1", home: a, away: b, homeGoals: 1, awayGoals: 0, winner: a, phase: "group", isPlayerMatch: false },
      { id: "2", home: c, away: d, homeGoals: 1, awayGoals: 0, winner: c, phase: "group", isPlayerMatch: false },
      { id: "3", home: a, away: c, homeGoals: 0, awayGoals: 1, winner: c, phase: "group", isPlayerMatch: false },
      { id: "4", home: b, away: d, homeGoals: 0, awayGoals: 1, winner: d, phase: "group", isPlayerMatch: false },
      { id: "5", home: a, away: d, homeGoals: 2, awayGoals: 0, winner: a, phase: "group", isPlayerMatch: false },
      { id: "6", home: b, away: c, homeGoals: 0, awayGoals: 1, winner: c, phase: "group", isPlayerMatch: false },
    ];
    // A: beats B(1-0), loses C(0-1), beats D(2-0) → 6pts gf=3 ga=1 gd=+2
    // C: beats D(1-0), beats A(1-0), beats B(1-0) → 9pts
    // D: beats B(1-0), loses A(0-2), loses C(0-1) → 3pts gf=1 ga=3 gd=-2
    // B: loses A, D, C → 0pts
    const standings = computeStandings(group);
    expect(standings[0].team.id).toBe("C"); // 9pts
    expect(standings[1].team.id).toBe("A"); // 6pts
  });

  it("counts played, won, drawn, lost correctly", () => {
    const [a, b, c, d] = [makeTeam("A"), makeTeam("B"), makeTeam("C"), makeTeam("D")];
    const group = makeGroup([a, b, c, d]);
    group.matches = [
      { id: "1", home: a, away: b, homeGoals: 1, awayGoals: 1, winner: null, phase: "group", isPlayerMatch: false },
      { id: "2", home: c, away: d, homeGoals: 0, awayGoals: 0, winner: null, phase: "group", isPlayerMatch: false },
      { id: "3", home: a, away: c, homeGoals: 2, awayGoals: 0, winner: a, phase: "group", isPlayerMatch: false },
      { id: "4", home: b, away: d, homeGoals: 1, awayGoals: 0, winner: b, phase: "group", isPlayerMatch: false },
      { id: "5", home: a, away: d, homeGoals: 0, awayGoals: 1, winner: d, phase: "group", isPlayerMatch: false },
      { id: "6", home: b, away: c, homeGoals: 2, awayGoals: 1, winner: b, phase: "group", isPlayerMatch: false },
    ];
    const standings = computeStandings(group);
    const rowA = standings.find((s) => s.team.id === "A")!;
    expect(rowA.played).toBe(3);
    expect(rowA.won).toBe(1);
    expect(rowA.drawn).toBe(1);
    expect(rowA.lost).toBe(1);
    expect(rowA.points).toBe(4);
  });
});

// ─── rankThirdPlaceTeams ──────────────────────────────────────────────────────

function makeGroupWithStandings(
  id: string,
  results: [string, string, string, string, number],
): TournamentGroup {
  // results = [1st-id, 2nd-id, 3rd-id, 4th-id, pts-of-3rd]
  const [first, second, third, fourth, thirdPts] = results;
  const t = (tid: string) => makeTeam(tid);
  const teams = [t(first), t(second), t(third), t(fourth)] as [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam];
  const group = makeGroup(teams);
  // Give enough match results to produce the desired standings
  // Simple approach: winner of each match controls points
  const addMatch = (h: WorldCupTeam, a: WorldCupTeam, hg: number, ag: number) =>
    group.matches.push({ id: `${id}-${h.id}-${a.id}`, home: h, away: a, homeGoals: hg, awayGoals: ag, winner: hg > ag ? h : ag > hg ? a : null, phase: "group" as const, isPlayerMatch: false });

  // 1st beats everyone (3 wins = 9 pts)
  addMatch(teams[0], teams[1], 3, 0);
  addMatch(teams[0], teams[2], 3, 0);
  addMatch(teams[0], teams[3], 3, 0);
  // 2nd beats 3rd and 4th
  addMatch(teams[1], teams[2], 2, 0);
  addMatch(teams[1], teams[3], 2, 0);
  // 3rd vs 4th — control 3rd's pts
  if (thirdPts === 3) {
    addMatch(teams[2], teams[3], 1, 0); // 3rd wins → 3pts
  } else if (thirdPts === 1) {
    addMatch(teams[2], teams[3], 0, 0); // draw → 1pt
  } else {
    addMatch(teams[2], teams[3], 0, 1); // 3rd loses → 0pts
  }
  group.id = id;
  return group;
}

describe("rankThirdPlaceTeams", () => {
  it("returns exactly 8 teams from 12 groups", () => {
    const groups = Array.from({ length: 12 }, (_, i) =>
      makeGroupWithStandings(String.fromCharCode(65 + i), [`a${i}`, `b${i}`, `c${i}`, `d${i}`, 3]),
    );
    const result = rankThirdPlaceTeams(groups);
    expect(result).toHaveLength(8);
  });

  it("returns all third-place teams when there are fewer than 8 groups", () => {
    const groups = Array.from({ length: 4 }, (_, i) =>
      makeGroupWithStandings(String.fromCharCode(65 + i), [`a${i}`, `b${i}`, `c${i}`, `d${i}`, 3]),
    );
    const result = rankThirdPlaceTeams(groups);
    expect(result).toHaveLength(4);
  });

  it("sorts by points desc — team with more points ranks higher", () => {
    // 11 groups with 3pts, 1 group whose 3rd has 0pts
    const groups = Array.from({ length: 12 }, (_, i) =>
      makeGroupWithStandings(String.fromCharCode(65 + i), [`a${i}`, `b${i}`, `c${i}`, `d${i}`, i === 0 ? 0 : 3]),
    );
    const result = rankThirdPlaceTeams(groups);
    // The team with 0pts should NOT be in the top 8
    expect(result.some((s) => s.team.id === "c0")).toBe(false);
  });

  it("team with most points is first in result", () => {
    // All groups have 3rd-place teams with 1pt except group A whose 3rd has 3pts
    const groups = Array.from({ length: 12 }, (_, i) =>
      makeGroupWithStandings(String.fromCharCode(65 + i), [`a${i}`, `b${i}`, `c${i}`, `d${i}`, i === 0 ? 3 : 1]),
    );
    const result = rankThirdPlaceTeams(groups);
    expect(result[0].team.id).toBe("c0");
    expect(result[0].points).toBe(3);
  });
});
