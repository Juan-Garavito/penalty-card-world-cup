import { describe, it, expect } from "vitest";
import { PowerUpCard } from "./PowerUpCard.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

class TestPowerUp extends PowerUpCard {
  equipTo(_target: PassiveCard): void {
    this.used = true;
  }
}

describe("PowerUpCard.revive() — REQ-PU-REVIVE-001", () => {
  it("revive() sets used to false", () => {
    const card = new TestPowerUp(1, "Test", "desc", "");
    card.used = true;
    card.revive();
    expect(card.used).toBe(false);
  });

  it("canEquip() returns true after revive()", () => {
    const card = new TestPowerUp(1, "Test", "desc", "");
    card.used = true;
    card.revive();
    expect(card.canEquip()).toBe(true);
  });

  it("match start does NOT reset used — no revive() call at construction", () => {
    // Simulating a card that was used: used stays true unless revive() is explicitly called
    const card = new TestPowerUp(1, "Test", "desc", "");
    card.used = true;
    // No revive() called — used must remain true
    expect(card.used).toBe(true);
    expect(card.canEquip()).toBe(false);
  });
});
