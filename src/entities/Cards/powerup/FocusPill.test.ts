import { describe, it, expect } from "vitest";
import { SaveCard } from "../passive/SaveCard.ts";
import { FocusPill } from "./FocusPill.ts";

describe("FocusPill", () => {
  // SCEN-FOCUSPILL-1
  it("equipTo sets immuneToActives to true on target", () => {
    const target = new SaveCard(1, "Target", "desc", "", "Special");
    const pill = new FocusPill(2, "Focus Pill", "desc", "");

    expect(target.immuneToActives).toBe(false);

    pill.equipTo(target);

    expect(target.immuneToActives).toBe(true);
  });

  it("immuneToActives resets to false after resetTurn()", () => {
    const target = new SaveCard(1, "Target", "desc", "", "Special");
    const pill = new FocusPill(2, "Focus Pill", "desc", "");

    pill.equipTo(target);
    expect(target.immuneToActives).toBe(true);

    target.resetTurn();

    expect(target.immuneToActives).toBe(false);
  });

  it("used is true after equipTo", () => {
    const target = new SaveCard(1, "Target", "desc", "", "Normal");
    const pill = new FocusPill(2, "Focus Pill", "desc", "");

    pill.equipTo(target);

    expect(pill.used).toBe(true);
    expect(pill.canEquip()).toBe(false);
  });
});
