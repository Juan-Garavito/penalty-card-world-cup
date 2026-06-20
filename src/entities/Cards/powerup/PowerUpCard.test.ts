import { describe, it, expect } from "vitest";
import { ShootCard } from "../passive/ShootCard.ts";
import { CheatingCard } from "../active/CheatingCard.ts";
import { PowerUpCard } from "./PowerUpCard.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

// Minimal concrete stub to test the abstract base.
// Intentionally does NOT call target methods — the stub only verifies the lifecycle contract.
class TestPowerUp extends PowerUpCard {
  equipTo(_target: PassiveCard): void {
    this.used = true;
  }
}

describe("PowerUpCard abstract base", () => {
  it("used is false on init", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    expect(powerUp.used).toBe(false);
  });

  it("canEquip() returns true before equip", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    expect(powerUp.canEquip()).toBe(true);
  });

  it("canEquip() returns false after equipTo is called — SCEN-POWERUP-USED-1", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    const target = new ShootCard(2, "Target", "desc", "", "Special");

    powerUp.equipTo(target);

    expect(powerUp.used).toBe(true);
    expect(powerUp.canEquip()).toBe(false);
  });

  it("equipTo accepts a PassiveCard target without TypeScript error", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    const target = new ShootCard(2, "Target", "desc", "", "Normal");
    // This must compile — no @ts-expect-error needed
    powerUp.equipTo(target);
    expect(powerUp.used).toBe(true);
  });

  // SCEN-TYPESAFETY-1: passing an ActiveCard must be a compile error.
  // The @ts-expect-error directive IS the assertion — if TypeScript ever allows this call,
  // the directive becomes "unused" and tsc strict mode fails the build.
  // The stub's equipTo ignores the target parameter at runtime, so no TypeError thrown.
  it("equipTo rejects an ActiveCard at compile time — SCEN-TYPESAFETY-1", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    const active = new CheatingCard(99, "Cheat", "desc", "");
    // @ts-expect-error — ActiveCard is not assignable to PassiveCard (SCEN-TYPESAFETY-1)
    powerUp.equipTo(active);
    expect(true).toBe(true);
  });

  // SCEN-TYPESAFETY-2: passing another PowerUpCard must be a compile error.
  // Same pattern as above.
  it("equipTo rejects a PowerUpCard target at compile time — SCEN-TYPESAFETY-2", () => {
    const powerUp = new TestPowerUp(1, "Test", "desc", "");
    const other = new TestPowerUp(2, "Other", "desc", "");
    // @ts-expect-error — PowerUpCard is not assignable to PassiveCard (SCEN-TYPESAFETY-2)
    powerUp.equipTo(other);
    expect(true).toBe(true);
  });
});
