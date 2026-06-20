import { describe, it, expect } from "vitest";
import { createTournament } from "./TournamentFactory.ts";

describe("createTournament", () => {
  it("returns a tournament with the chosen player team", () => {
    const t = createTournament("argentina");
    expect(t.playerTeam.id).toBe("argentina");
  });

  it("has 12 groups", () => {
    const t = createTournament("brazil");
    expect(t.groups).toHaveLength(12);
  });

  it("each group has exactly 4 teams and 0 matches initially", () => {
    const t = createTournament("france");
    for (const g of t.groups) {
      expect(g.teams).toHaveLength(4);
      expect(g.matches).toHaveLength(0);
    }
  });

  it("the player team appears in exactly one group", () => {
    const t = createTournament("england");
    const groupsWithPlayer = t.groups.filter((g) =>
      g.teams.some((team) => team.id === "england"),
    );
    expect(groupsWithPlayer).toHaveLength(1);
  });

  it("starts in group phase", () => {
    const t = createTournament("germany");
    expect(t.phase).toBe("group");
  });

  it("throws for unknown team id", () => {
    expect(() => createTournament("wakanda")).toThrow();
  });

  it("group standings are empty until simulated", () => {
    const t = createTournament("spain");
    for (const g of t.groups) {
      expect(g.standings).toHaveLength(0);
    }
  });

  it("SCEN-AD-005-a: adRewardUsesLeft is initialized to 5", () => {
    const t = createTournament("argentina");
    expect(t.adRewardUsesLeft).toBe(5);
  });
});
