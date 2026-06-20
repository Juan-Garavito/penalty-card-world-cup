import { describe, it, expect } from "vitest";
import { ShootCard } from "./ShootCard.ts";
import { SaveCard } from "./SaveCard.ts";

// PassiveCard is abstract — we test through its concrete subtypes.

describe("PassiveCard extensions", () => {
  // REQ-PASSIVE-EXT-001
  it("bonusPower defaults to 0", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special");
    expect(card.bonusPower).toBe(0);
  });

  it("immuneToActives defaults to false", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special");
    expect(card.immuneToActives).toBe(false);
  });

  // REQ-PASSIVE-EXT-002
  it("boost(3) adds 3 to bonusPower", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special");
    card.boost(3);
    expect(card.bonusPower).toBe(3);
  });

  it("boost is additive — calling twice accumulates", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special");
    card.boost(3);
    card.boost(2);
    expect(card.bonusPower).toBe(5);
  });

  // REQ-PASSIVE-EXT-003
  it("makeImmune() sets immuneToActives to true", () => {
    const card = new SaveCard(1, "Test", "desc", "", "Special");
    card.makeImmune();
    expect(card.immuneToActives).toBe(true);
  });

  // REQ-PASSIVE-EXT-004 — tested via canPlay() state change
  it("rewindCooldown(2) delegates to timer, enabling canPlay() for a blocked Special card", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special"); // cooldown=3
    card.play(); // marks unready
    card.tickShot();
    card.tickShot(); // shotsSinceUse=2, still not ready

    expect(card.canPlay()).toBe(false);

    card.rewindCooldown(2); // shotsSinceUse becomes 4 >= 3

    expect(card.canPlay()).toBe(true);
  });

  // REQ-PASSIVE-EXT-005
  it("getCurrentPower() returns power + bonusPower", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special"); // power=5
    expect(card.getCurrentPower()).toBe(5);

    card.boost(3);
    expect(card.getCurrentPower()).toBe(8);
  });

  // REQ-PASSIVE-EXT-006 — SCEN-RESETTURN-1
  it("resetTurn() restores effectivePower, clears bonusPower and immuneToActives", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special"); // power=5
    card.nullify(); // effectivePower=0
    card.boost(3); // bonusPower=3
    card.makeImmune(); // immuneToActives=true

    card.resetTurn();

    expect(card.effectivePower).toBe(5); // restored to power
    expect(card.bonusPower).toBe(0);
    expect(card.immuneToActives).toBe(false);
  });

  it("resetTurn() is idempotent when no power-up was applied", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Normal"); // power=0
    card.resetTurn();
    expect(card.effectivePower).toBe(0);
    expect(card.bonusPower).toBe(0);
    expect(card.immuneToActives).toBe(false);
  });

  // REQ-PASSIVE-EXT-007 — runtime assertion: resetEffect must NOT exist on PassiveCard.
  // If resetEffect ever reappears, tsc will catch it via noUnusedLocals + strict mode
  // and this test will fail at runtime.
  it("resetEffect does not exist on PassiveCard (runtime assertion)", () => {
    const card = new ShootCard(1, "Test", "desc", "", "Special");
    expect(
      (card as unknown as Record<string, unknown>)["resetEffect"],
    ).toBeUndefined();
  });
});
