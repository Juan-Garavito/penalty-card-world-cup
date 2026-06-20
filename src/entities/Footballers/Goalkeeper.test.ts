import { describe, it, expect } from "vitest";
import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";
import { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";
import { Goalkeeper } from "./Goalkeeper.ts";

describe("Goalkeeper.powerUps", () => {
  it("powerUps defaults to [] when not passed — backward-compatible", () => {
    const saveCard = new SaveCard(1, "Save", "desc", "", "Normal");
    const intimidate = new IntimidateCard(2, "Intimidate", "desc", "");

    const goalkeeper = new Goalkeeper([saveCard], [intimidate]);

    expect(goalkeeper.powerUps).toEqual([]);
  });

  // SCEN-FOOTBALLER-1: all three subtypes assignable to powerUps
  it("powerUps accepts AdrenalineBoost, FocusPill, and TimeRewind without TypeScript error", () => {
    const saveCard = new SaveCard(1, "Save", "desc", "", "Normal");
    const adrenaline = new AdrenalineBoost(10, "Adrenaline Boost", "desc", "");
    const focus = new FocusPill(11, "Focus Pill", "desc", "");
    const rewind = new TimeRewind(12, "Time Rewind", "desc", "");

    const goalkeeper = new Goalkeeper(
      [saveCard],
      [],
      [adrenaline, focus, rewind],
    );

    expect(goalkeeper.powerUps).toHaveLength(3);
    expect(goalkeeper.powerUps[0]).toBeInstanceOf(AdrenalineBoost);
    expect(goalkeeper.powerUps[1]).toBeInstanceOf(FocusPill);
    expect(goalkeeper.powerUps[2]).toBeInstanceOf(TimeRewind);
  });

  it("powerUps is typed as PowerUpCard[] — structural assignability check", () => {
    const saveCard = new SaveCard(1, "Save", "desc", "", "Normal");
    const adrenaline = new AdrenalineBoost(10, "Adrenaline Boost", "desc", "");

    const goalkeeper = new Goalkeeper([saveCard], [], [adrenaline]);

    // TypeScript structural check — must compile without error
    const powerUps: PowerUpCard[] = goalkeeper.powerUps;
    expect(powerUps).toHaveLength(1);
  });
});
