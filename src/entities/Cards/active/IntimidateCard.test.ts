import { describe, it, expect, vi } from "vitest";
import {
  IntimidateCard,
  INTIMIDATE_MISMATCH_PENALTY,
} from "./IntimidateCard.ts";

// REQ-INTIMIDATE-DUAL, SCEN-INTIMIDATE-LOW-CHANCE, SCEN-INTIMIDATE-LOW-CLAMP, NF-LINT-001

describe("IntimidateCard — lowMissChanceVs (REQ-INTIMIDATE-DUAL)", () => {
  // SCEN-INTIMIDATE-LOW-CHANCE: Normal tier → counterChance=70, penalty=10 → 60
  it("lowMissChanceVs('Normal') returns 60 (70 - 10)", () => {
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    expect(card.lowMissChanceVs("Normal")).toBe(60);
  });

  // SCEN-INTIMIDATE-LOW-CHANCE: Special tier → counterChance=50, penalty=10 → 40
  it("lowMissChanceVs('Special') returns 40 (50 - 10)", () => {
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    expect(card.lowMissChanceVs("Special")).toBe(40);
  });

  // SCEN-INTIMIDATE-LOW-CHANCE: Epic tier → counterChance=40, penalty=10 → 30
  it("lowMissChanceVs('Epic') returns 30 (40 - 10)", () => {
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    expect(card.lowMissChanceVs("Epic")).toBe(30);
  });

  // SCEN-INTIMIDATE-LOW-CLAMP: result is never negative
  it("lowMissChanceVs clamps to 0 when missChanceVs < INTIMIDATE_MISMATCH_PENALTY", () => {
    // We can't easily create a custom tier, but we can verify that missChanceVs - penalty >= 0
    // for all known tiers. The clamp is testable via existing tiers (all result >= 0).
    // For a direct clamp test we rely on the fact that Math.max(0, x) is correct.
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    // All known tiers produce positive results, but clamp must still exist:
    // Normal: 70-10=60, Special: 50-10=40, Epic: 40-10=30 — all positive.
    // To test the clamp branch, we can call with each and verify none is negative.
    expect(card.lowMissChanceVs("Normal")).toBeGreaterThanOrEqual(0);
    expect(card.lowMissChanceVs("Special")).toBeGreaterThanOrEqual(0);
    expect(card.lowMissChanceVs("Epic")).toBeGreaterThanOrEqual(0);
  });

  // SCEN-INTIMIDATE-LOW-CLAMP (negative branch): Math.max(0,...) clamp actually fires
  it("lowMissChanceVs returns 0 when missChanceVs returns less than INTIMIDATE_MISMATCH_PENALTY", () => {
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    // Force missChanceVs to return 5 (below penalty of 10) — exercises the Math.max(0,...) branch
    vi.spyOn(card, "missChanceVs").mockReturnValue(5);
    expect(card.lowMissChanceVs("Normal")).toBe(0);
  });

  // NF-LINT-001: INTIMIDATE_MISMATCH_PENALTY exported from IntimidateCard.ts
  it("INTIMIDATE_MISMATCH_PENALTY is exported and equals 10", () => {
    expect(INTIMIDATE_MISMATCH_PENALTY).toBe(10);
  });

  // missChanceVs must remain unchanged
  it("missChanceVs('Normal') still returns 70 (unchanged)", () => {
    const card = new IntimidateCard(1, "Intimidate", "desc", "");
    expect(card.missChanceVs("Normal")).toBe(70);
  });
});
