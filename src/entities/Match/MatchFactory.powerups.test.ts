import { describe, it, expect } from "vitest";
import { MatchFactory } from "./MatchFactory.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";

function makePlayerPowerUps() {
  return [
    new AdrenalineBoost(11, "Adrenaline", "Power boost.", ""),
    new FocusPill(12, "Focus", "Immune to actives.", ""),
    new TimeRewind(13, "Time Rewind", "Rewinds cooldown.", ""),
  ];
}

describe("MatchFactory.build() with playerPowerUps (REQ-PU-FACTORY-001)", () => {
  it("(a) humanStriker.powerUps is same reference as playerPowerUps", () => {
    const playerPowerUps = makePlayerPowerUps();
    const { humanPlayer } = MatchFactory.build(undefined, undefined, playerPowerUps);
    expect(humanPlayer.striker.powerUps).toBe(playerPowerUps);
  });

  it("(a) humanGoalkeeper.powerUps is same reference as playerPowerUps", () => {
    const playerPowerUps = makePlayerPowerUps();
    const { humanPlayer } = MatchFactory.build(undefined, undefined, playerPowerUps);
    expect(humanPlayer.goalkeeper.powerUps).toBe(playerPowerUps);
  });

  it("striker and goalkeeper share the exact same array reference", () => {
    const playerPowerUps = makePlayerPowerUps();
    const { humanPlayer } = MatchFactory.build(undefined, undefined, playerPowerUps);
    expect(humanPlayer.striker.powerUps).toBe(humanPlayer.goalkeeper.powerUps);
  });

  it("(b) without param — both roles contain all 3 power-up types", () => {
    const { humanPlayer } = MatchFactory.build();
    const strikerHasAll =
      humanPlayer.striker.powerUps.some((c) => c instanceof AdrenalineBoost) &&
      humanPlayer.striker.powerUps.some((c) => c instanceof FocusPill) &&
      humanPlayer.striker.powerUps.some((c) => c instanceof TimeRewind);
    const keeperHasAll =
      humanPlayer.goalkeeper.powerUps.some((c) => c instanceof AdrenalineBoost) &&
      humanPlayer.goalkeeper.powerUps.some((c) => c instanceof FocusPill) &&
      humanPlayer.goalkeeper.powerUps.some((c) => c instanceof TimeRewind);
    expect(strikerHasAll).toBe(true);
    expect(keeperHasAll).toBe(true);
  });

  it("(c) cross-match identity: setting card.used=true persists on same ref across build() calls", () => {
    const playerPowerUps = makePlayerPowerUps();
    const { humanPlayer: p1 } = MatchFactory.build(undefined, undefined, playerPowerUps);
    p1.striker.powerUps[0].used = true;

    const { humanPlayer: p2 } = MatchFactory.build(undefined, undefined, playerPowerUps);
    expect(p2.striker.powerUps[0].used).toBe(true);
  });

  it("backward compat: existing build() calls without 3rd arg still work", () => {
    expect(() => MatchFactory.build()).not.toThrow();
    expect(() => MatchFactory.build("group")).not.toThrow();
    expect(() => MatchFactory.build("knockout")).not.toThrow();
  });
});
