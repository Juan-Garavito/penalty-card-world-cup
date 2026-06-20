import { describe, it, expect } from "vitest";
import { createTournament } from "./TournamentFactory.ts";
import type { Tournament } from "./Tournament.ts";

describe("Tournament interface — playerPowerUps field (REQ-PU-PERSIST-002)", () => {
  it("Tournament interface has playerPowerUps as a flat array", () => {
    const t = createTournament("argentina");
    expect(t).toHaveProperty("playerPowerUps");
    expect(Array.isArray(t.playerPowerUps)).toBe(true);
  });

  it("Tournament type is compatible with flat playerPowerUps — type narrowing", () => {
    const t: Tournament = createTournament("germany");
    expect(t.playerPowerUps).toBeDefined();
    expect(t.playerPowerUps.length).toBeGreaterThan(0);
  });
});
