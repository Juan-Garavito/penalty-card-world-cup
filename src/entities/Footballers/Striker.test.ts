import { describe, it, expect } from "vitest";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";
import { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";
import { Striker } from "./Striker.ts";

describe("Striker.powerUps", () => {
  it("powerUps defaults to [] when not passed — backward-compatible", () => {
    const shootCard = new ShootCard(1, "Shoot", "desc", "", "Normal");
    const cheat = new CheatingCard(2, "Cheating", "desc", "");

    const striker = new Striker([shootCard], [cheat]);

    expect(striker.powerUps).toEqual([]);
  });

  // SCEN-FOOTBALLER-2: all three subtypes assignable to powerUps
  it("powerUps accepts AdrenalineBoost, FocusPill, and TimeRewind without TypeScript error", () => {
    const shootCard = new ShootCard(1, "Shoot", "desc", "", "Normal");
    const adrenaline = new AdrenalineBoost(10, "Adrenaline Boost", "desc", "");
    const focus = new FocusPill(11, "Focus Pill", "desc", "");
    const rewind = new TimeRewind(12, "Time Rewind", "desc", "");

    const striker = new Striker([shootCard], [], [adrenaline, focus, rewind]);

    expect(striker.powerUps).toHaveLength(3);
    expect(striker.powerUps[0]).toBeInstanceOf(AdrenalineBoost);
    expect(striker.powerUps[1]).toBeInstanceOf(FocusPill);
    expect(striker.powerUps[2]).toBeInstanceOf(TimeRewind);
  });

  it("powerUps is typed as PowerUpCard[] — structural assignability check", () => {
    const shootCard = new ShootCard(1, "Shoot", "desc", "", "Normal");
    const focus = new FocusPill(11, "Focus Pill", "desc", "");

    const striker = new Striker([shootCard], [], [focus]);

    // TypeScript structural check — must compile without error
    const powerUps: PowerUpCard[] = striker.powerUps;
    expect(powerUps).toHaveLength(1);
  });
});
