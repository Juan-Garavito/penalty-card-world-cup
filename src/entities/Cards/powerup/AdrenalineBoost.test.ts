import { describe, it, expect } from "vitest";
import { ShootCard } from "../passive/ShootCard.ts";
import { AdrenalineBoost } from "./AdrenalineBoost.ts";

describe("AdrenalineBoost", () => {
  // SCEN-ADRENALINE-1
  it("equipTo adds +3 to bonusPower and getCurrentPower returns power + bonusPower", () => {
    const target = new ShootCard(1, "Target", "desc", "", "Special"); // power=5, bonusPower=0
    const boost = new AdrenalineBoost(2, "Adrenaline Boost", "desc", "");

    expect(target.bonusPower).toBe(0);
    expect(target.getCurrentPower()).toBe(5);

    boost.equipTo(target);

    expect(target.bonusPower).toBe(3);
    expect(target.getCurrentPower()).toBe(8);
  });

  it("bonusPower resets to 0 after resetTurn()", () => {
    const target = new ShootCard(1, "Target", "desc", "", "Special"); // power=5
    const boost = new AdrenalineBoost(2, "Adrenaline Boost", "desc", "");

    boost.equipTo(target);
    expect(target.getCurrentPower()).toBe(8);

    target.resetTurn();

    expect(target.bonusPower).toBe(0);
    expect(target.getCurrentPower()).toBe(5);
  });

  it("used is true after equipTo", () => {
    const target = new ShootCard(1, "Target", "desc", "", "Normal");
    const boost = new AdrenalineBoost(2, "Adrenaline Boost", "desc", "");

    boost.equipTo(target);

    expect(boost.used).toBe(true);
    expect(boost.canEquip()).toBe(false);
  });
});
