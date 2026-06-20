import { describe, it, expect } from "vitest";
import { createTournament } from "./TournamentFactory.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";

describe("TournamentFactory — playerPowerUps (REQ-PU-PERSIST-002)", () => {
  it("playerPowerUps is a flat array of 3 cards", () => {
    const t = createTournament("argentina");
    expect(Array.isArray(t.playerPowerUps)).toBe(true);
    expect(t.playerPowerUps).toHaveLength(3);
  });

  it("first card is AdrenalineBoost with id 11", () => {
    const t = createTournament("argentina");
    expect(t.playerPowerUps[0]).toBeInstanceOf(AdrenalineBoost);
    expect(t.playerPowerUps[0].id).toBe(11);
  });

  it("second card is FocusPill with id 12", () => {
    const t = createTournament("brazil");
    expect(t.playerPowerUps[1]).toBeInstanceOf(FocusPill);
    expect(t.playerPowerUps[1].id).toBe(12);
  });

  it("third card is TimeRewind with id 13", () => {
    const t = createTournament("france");
    expect(t.playerPowerUps[2]).toBeInstanceOf(TimeRewind);
    expect(t.playerPowerUps[2].id).toBe(13);
  });

  it("all power-up cards start with used = false", () => {
    const t = createTournament("spain");
    for (const card of t.playerPowerUps) {
      expect(card.used).toBe(false);
    }
  });

  it("each tournament creates independent instances", () => {
    const t1 = createTournament("germany");
    const t2 = createTournament("england");
    expect(t1.playerPowerUps[0]).not.toBe(t2.playerPowerUps[0]);
  });
});
