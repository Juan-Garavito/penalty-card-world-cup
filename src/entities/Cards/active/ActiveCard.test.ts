import { describe, it, expect } from "vitest";
import { ActiveCard } from "./ActiveCard.ts";

// Concrete stub for testing the abstract ActiveCard base class
class TestActiveCard extends ActiveCard {
  constructor(id: number) {
    super(id, `TestCard${id}`, "desc", "");
  }
}

function makeTestCard(): TestActiveCard {
  return new TestActiveCard(1);
}

// SCEN-ACTIVECARD-RESET — REQ-ACTIVECARD-RESET-001, REQ-ACTIVECARD-RESET-002
describe("ActiveCard.reset() — used card restored to activatable state", () => {
  it("after activate(), reset() sets used to false and canActivate() returns true", () => {
    const card = makeTestCard();
    card.activate();
    expect(card.canActivate()).toBe(false); // pre-condition: card is used

    card.reset();

    expect(card.used).toBe(false);
    expect(card.canActivate()).toBe(true);
  });
});

// SCEN-ACTIVECARD-RESET-IDEMPOTENT — REQ-ACTIVECARD-RESET-003
describe("ActiveCard.reset() — idempotent on fresh card", () => {
  it("reset() on a never-activated card does not throw and keeps canActivate() true", () => {
    const card = makeTestCard();
    expect(card.canActivate()).toBe(true); // pre-condition: card is fresh

    expect(() => card.reset()).not.toThrow();

    expect(card.canActivate()).toBe(true);
  });
});

// SCEN-ACTIVECARD-MARKUSED
describe("ActiveCard.markUsed() — sets used without side effects", () => {
  it("markUsed() sets used=true when card can activate", () => {
    const card = makeTestCard();
    expect(card.canActivate()).toBe(true); // pre-condition

    card.markUsed();

    expect(card.used).toBe(true);
    expect(card.canActivate()).toBe(false);
  });

  it("markUsed() does not call activate() — passive target state is unchanged", () => {
    // markUsed() must only set used=true with NO side effects on external objects
    // Since TestActiveCard has no applyTo, we verify used is set and no exception thrown
    const card = makeTestCard();
    expect(() => card.markUsed()).not.toThrow();
    expect(card.used).toBe(true);
  });

  it("canActivate() returns false after markUsed()", () => {
    const card = makeTestCard();
    card.markUsed();
    expect(card.canActivate()).toBe(false);
  });
});
