import { describe, it, expect } from "vitest";
import { simulateMatch, simulateGroup, getMatchdayForIndices, getMatchday, simulateGroupMatchday } from "./GroupSimulator.ts";
import type { WorldCupTeam } from "./WorldCupTeam.ts";
import type { TournamentGroup } from "./TournamentGroup.ts";

function makeTeam(id: string, power: number): WorldCupTeam {
  return { id, name: id, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, power, abbreviation: id.slice(0, 3).toUpperCase(), flagSpec: { h: ["red", "white"] as ["red", "white"] } };
}

// Deterministic RNG for testing
function makeRng(values: number[]) {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}

describe("simulateMatch", () => {
  it("always produces non-negative goal counts", () => {
    const a = makeTeam("A", 80);
    const b = makeTeam("B", 60);
    const rng = { next: () => Math.random() };
    for (let i = 0; i < 50; i++) {
      const result = simulateMatch(a, b, rng);
      expect(result.homeGoals).toBeGreaterThanOrEqual(0);
      expect(result.awayGoals).toBeGreaterThanOrEqual(0);
    }
  });

  it("a dominant team wins more often than a weak team over many samples", () => {
    const strong = makeTeam("strong", 95);
    const weak = makeTeam("weak", 30);
    let strongWins = 0;
    const rng = { next: () => Math.random() };
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch(strong, weak, rng);
      if ((r.winner?.id ?? null) === "strong") strongWins++;
    }
    expect(strongWins).toBeGreaterThan(120); // > 60% of 200
  });

  it("sets winner null on draw", () => {
    // Force draw: home=0 away=0 by controlling RNG to produce low goal counts
    // We just verify winner is null when goals are equal
    const a = makeTeam("A", 50);
    const b = makeTeam("B", 50);
    // rng sequence that produces a 0-0: very low probabilities for each goal
    const rng = makeRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    const result = simulateMatch(a, b, rng);
    // 0-0 draw → winner null
    expect(result.homeGoals).toBe(0);
    expect(result.awayGoals).toBe(0);
    expect(result.winner).toBeNull();
  });
});

describe("simulateGroup", () => {
  it("fills goals for all 6 matches and updates standings", () => {
    const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
      makeTeam("A", 80), makeTeam("B", 70), makeTeam("C", 60), makeTeam("D", 50),
    ];
    const group: TournamentGroup = { id: "X", teams, matches: [], standings: [] };
    const rng = { next: () => Math.random() };
    const result = simulateGroup(group, rng);
    expect(result.matches).toHaveLength(6);
    for (const m of result.matches) {
      expect(m.homeGoals).not.toBeNull();
      expect(m.awayGoals).not.toBeNull();
    }
    expect(result.standings).toHaveLength(4);
    // standings should sum to 6 played matches worth of data
    const totalPlayed = result.standings.reduce((s, r) => s + r.played, 0);
    expect(totalPlayed).toBe(12); // 6 matches × 2 teams each
  });

  it("skips player matches (isPlayerMatch=true)", () => {
    const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
      makeTeam("A", 80), makeTeam("B", 70), makeTeam("C", 60), makeTeam("D", 50),
    ];
    const playerMatch = {
      id: "X-A-vs-B",
      home: teams[0], away: teams[1],
      homeGoals: null, awayGoals: null,
      winner: null,
      phase: "group" as const,
      isPlayerMatch: true,
    };
    const group: TournamentGroup = { id: "X", teams, matches: [playerMatch], standings: [] };
    const rng = { next: () => Math.random() };
    const result = simulateGroup(group, rng);
    const pm = result.matches.find(m => m.id === "X-A-vs-B");
    // Player match must stay unplayed
    expect(pm?.homeGoals).toBeNull();
  });

  it("skips matches already played (isPlayerMatch=false, goals set)", () => {
    const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
      makeTeam("A", 80), makeTeam("B", 70), makeTeam("C", 60), makeTeam("D", 50),
    ];
    const presetMatch = {
      id: "pre",
      home: teams[0], away: teams[1],
      homeGoals: 3, awayGoals: 0,
      winner: teams[0],
      phase: "group" as const,
      isPlayerMatch: false,
    };
    const group: TournamentGroup = { id: "X", teams, matches: [presetMatch], standings: [] };
    const rng = { next: () => Math.random() };
    const result = simulateGroup(group, rng);
    // The preset match should still show 3-0
    const pre = result.matches.find((m) => m.id === "pre");
    expect(pre?.homeGoals).toBe(3);
    expect(pre?.awayGoals).toBe(0);
  });
});

describe("getMatchdayForIndices", () => {
  it("MD1: (0,1) and (2,3)", () => {
    expect(getMatchdayForIndices(0, 1)).toBe(1);
    expect(getMatchdayForIndices(1, 0)).toBe(1);
    expect(getMatchdayForIndices(2, 3)).toBe(1);
    expect(getMatchdayForIndices(3, 2)).toBe(1);
  });
  it("MD2: (0,2) and (1,3)", () => {
    expect(getMatchdayForIndices(0, 2)).toBe(2);
    expect(getMatchdayForIndices(2, 0)).toBe(2);
    expect(getMatchdayForIndices(1, 3)).toBe(2);
    expect(getMatchdayForIndices(3, 1)).toBe(2);
  });
  it("MD3: (0,3) and (1,2)", () => {
    expect(getMatchdayForIndices(0, 3)).toBe(3);
    expect(getMatchdayForIndices(3, 0)).toBe(3);
    expect(getMatchdayForIndices(1, 2)).toBe(3);
    expect(getMatchdayForIndices(2, 1)).toBe(3);
  });
});

describe("getMatchday", () => {
  const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
    makeTeam("T0", 80), makeTeam("T1", 70), makeTeam("T2", 60), makeTeam("T3", 50),
  ];

  function makeGroupMatch(hi: number, ai: number) {
    return {
      id: `G-T${hi}-vs-T${ai}`,
      home: teams[hi], away: teams[ai],
      homeGoals: null, awayGoals: null, winner: null,
      phase: "group" as const, isPlayerMatch: false,
    };
  }

  it("returns correct matchday for each pair", () => {
    const group: TournamentGroup = { id: "G", teams, matches: [], standings: [] };
    expect(getMatchday(group, makeGroupMatch(0, 1))).toBe(1);
    expect(getMatchday(group, makeGroupMatch(2, 3))).toBe(1);
    expect(getMatchday(group, makeGroupMatch(0, 2))).toBe(2);
    expect(getMatchday(group, makeGroupMatch(1, 3))).toBe(2);
    expect(getMatchday(group, makeGroupMatch(0, 3))).toBe(3);
    expect(getMatchday(group, makeGroupMatch(1, 2))).toBe(3);
  });

  it("works regardless of home/away order", () => {
    const group: TournamentGroup = { id: "G", teams, matches: [], standings: [] };
    expect(getMatchday(group, makeGroupMatch(1, 0))).toBe(1);
    expect(getMatchday(group, makeGroupMatch(3, 0))).toBe(3);
  });
});

describe("simulateGroupMatchday", () => {
  function makeGroup(): TournamentGroup {
    const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
      makeTeam("P", 80), makeTeam("A", 70), makeTeam("B", 60), makeTeam("C", 50),
    ];
    // All 6 match slots pre-created (P=player team at index 0)
    const matches = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        matches.push({
          id: `G-${teams[i].id}-vs-${teams[j].id}`,
          home: teams[i], away: teams[j],
          homeGoals: null, awayGoals: null, winner: null,
          phase: "group" as const,
          isPlayerMatch: teams[i].id === "P" || teams[j].id === "P",
        });
      }
    }
    return { id: "G", teams, matches, standings: [] };
  }

  it("simulates only non-player matches for the given matchday", () => {
    const group = makeGroup();
    const rng = { next: () => 0.5 };
    simulateGroupMatchday(group, 1, rng);

    // MD1 non-player: (B vs C) = teams[2] vs teams[3] = indices (2,3)
    const bcMatch = group.matches.find(m => m.home.id === "B" && m.away.id === "C");
    expect(bcMatch?.homeGoals).not.toBeNull();

    // MD1 player: (P vs A) = indices (0,1) → must remain null
    const paMatch = group.matches.find(m => m.home.id === "P" && m.away.id === "A");
    expect(paMatch?.homeGoals).toBeNull();

    // MD2 matches must remain null
    const pbMatch = group.matches.find(m => m.home.id === "P" && m.away.id === "B");
    expect(pbMatch?.homeGoals).toBeNull();
  });

  it("is idempotent: calling twice with same matchday does not re-simulate", () => {
    const group = makeGroup();
    const rng = makeRng([0.5, 0.5, 0.5]);
    simulateGroupMatchday(group, 1, rng);
    const bcFirst = group.matches.find(m => m.home.id === "B" && m.away.id === "C")!.homeGoals;
    simulateGroupMatchday(group, 1, rng); // second call
    const bcSecond = group.matches.find(m => m.home.id === "B" && m.away.id === "C")!.homeGoals;
    expect(bcFirst).toBe(bcSecond);
  });

  it("creates match slot if not already in group.matches", () => {
    const teams: [WorldCupTeam, WorldCupTeam, WorldCupTeam, WorldCupTeam] = [
      makeTeam("X", 80), makeTeam("Y", 70), makeTeam("Z", 60), makeTeam("W", 50),
    ];
    const group: TournamentGroup = { id: "G2", teams, matches: [], standings: [] };
    const rng = { next: () => 0.5 };
    simulateGroupMatchday(group, 1, rng);
    // MD1 = (X,Y) and (Z,W) — both should be created and simulated
    expect(group.matches.length).toBe(2);
    expect(group.matches.every(m => m.homeGoals !== null)).toBe(true);
  });
});
