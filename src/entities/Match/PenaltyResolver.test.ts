import { describe, it, expect, vi } from "vitest";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { IRng } from "./IRng.ts";
import { PlayerDecision } from "../Players/PlayerDecision.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { ResolutionOutcome } from "./ResolutionOutcome.ts";
import { Side } from "../Players/Side.ts";

// ─── Stub helpers ────────────────────────────────────────────────────────────

function makeRng(value: number): IRng {
  return { next: vi.fn().mockReturnValue(value) };
}

function makeShootCard(
  tier: "Normal" | "Special" | "Epic" = "Normal",
): ShootCard {
  return new ShootCard(1, "Shoot", "desc", "", tier);
}

function makeSaveCard(
  tier: "Normal" | "Special" | "Epic" = "Normal",
): SaveCard {
  return new SaveCard(2, "Save", "desc", "", tier);
}

function makeNullifyCard(id = 10): NullifyCard {
  return new NullifyCard(id, "Nullify", "desc", "");
}

function makeCheatingCard(id = 20): CheatingCard {
  return new CheatingCard(id, "Cheating", "desc", "");
}

function makeIntimidateCard(id = 30): IntimidateCard {
  return new IntimidateCard(id, "Intimidate", "desc", "");
}

// ─── Batch 2 — Resolution logic tests ───────────────────────────────────────

describe("PenaltyResolver — match path, no actives (deterministic)", () => {
  it("strikerPower > keeperPower → goal=true, no RNG, finalPGoal=null, roll=null", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Epic"), side: "left" },   // power=10
      { chosenCard: makeSaveCard("Normal"), side: "left" },  // power=0
    );

    expect(outcome.goal).toBe(true);
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(rng.next).not.toHaveBeenCalled();
  });

  it("strikerPower < keeperPower → goal=false, no RNG", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },  // power=0
      { chosenCard: makeSaveCard("Epic"), side: "left" },     // power=10
    );

    expect(outcome.goal).toBe(false);
    expect(rng.next).not.toHaveBeenCalled();
  });

  it("equal power → goal=false (goalkeeper wins on tie), no RNG", () => {
    const rng = makeRng(0.0);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), side: "left" },
    );

    expect(outcome.goal).toBe(false);
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(rng.next).not.toHaveBeenCalled();
  });

  it("same inputs produce identical outcomes (pure service)", () => {
    const resolver = new PenaltyResolver({ next: () => 0.3 });

    const make = (): PlayerDecision => ({
      chosenCard: makeShootCard("Special"),
      side: "left",
    });
    const gk = (): PlayerDecision => ({
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    });

    const first = resolver.resolve(make(), gk());
    const second = resolver.resolve(make(), gk());

    expect(first.goal).toBe(second.goal);
    expect(first.evidence.finalPGoal).toBe(second.evidence.finalPGoal);
    expect(first.evidence.roll).toBe(second.evidence.roll);
  });
});

describe("PenaltyResolver — match path, Intimidate only (random)", () => {
  // Normal striker (tier=Normal) → missChance=70, finalPGoal=30
  it("Intimidate vs Normal striker: finalPGoal=30, roll stored, used=true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: intimidate, side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(30); // 100 - 70
    expect(outcome.evidence.roll).toBe(0.5);
    expect(intimidate.used).toBe(true);
    expect(rng.next).toHaveBeenCalledTimes(1);
  });

  it("Intimidate: roll < missChance/100 → goal=false (missed)", () => {
    // missChance vs Normal = 70; roll=0.1 < 0.70 → missed
    const rng = makeRng(0.1);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.goal).toBe(false);
  });

  it("Intimidate: roll >= missChance/100 → goal=true", () => {
    // missChance vs Normal = 70; roll=0.8 >= 0.70 → goal
    const rng = makeRng(0.8);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.goal).toBe(true);
  });

  it("Intimidate boundary: roll exactly at missChance/100 → goal=true (not strictly less than)", () => {
    // missChance vs Normal = 70; roll=0.70 → NOT missed (>= threshold)
    const rng = makeRng(0.7);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.goal).toBe(true);
  });

  it("Intimidate vs Special striker: missChance=50, finalPGoal=50", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Special"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(50); // 100 - 50
  });

  it("Intimidate vs Epic striker: missChance=40, finalPGoal=60", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Epic"), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(60); // 100 - 40
  });
});

describe("PenaltyResolver — match path, CheatingCard only (random)", () => {
  // Normal keeper (tier=Normal) → goalChance=70, finalPGoal=70
  it("CheatingCard vs Normal keeper: finalPGoal=70, roll stored, used=true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: cheat, side: "left" },
      { chosenCard: makeSaveCard("Normal"), side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(70);
    expect(outcome.evidence.roll).toBe(0.5);
    expect(cheat.used).toBe(true);
    expect(rng.next).toHaveBeenCalledTimes(1);
  });

  it("CheatingCard: roll < goalChance/100 → goal=true", () => {
    // goalChance vs Normal = 70; roll=0.5 < 0.70 → goal
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Normal"), side: "left" },
    );

    expect(outcome.goal).toBe(true);
  });

  it("CheatingCard: roll >= goalChance/100 → goal=false", () => {
    // goalChance vs Normal = 70; roll=0.8 >= 0.70 → no goal
    const rng = makeRng(0.8);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Normal"), side: "left" },
    );

    expect(outcome.goal).toBe(false);
  });

  it("CheatingCard vs Special keeper: goalChance=50, finalPGoal=50", () => {
    const rng = makeRng(0.3);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Special"), side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(50);
  });

  it("CheatingCard vs Epic keeper: goalChance=40, finalPGoal=40", () => {
    const rng = makeRng(0.3);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Epic"), side: "left" },
    );

    expect(outcome.evidence.finalPGoal).toBe(40);
  });

  it("evidence.roll contains the exact value from rng.next() when CheatingCard fires", () => {
    const rng = makeRng(0.37);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Normal"), side: "left" },
    );

    expect(outcome.evidence.roll).toBe(0.37);
  });
});

describe("PenaltyResolver — match path, Intimidate + CheatingCard cancel", () => {
  it("both fire → cancel, no RNG, goal = power comparison", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const intimidate = makeIntimidateCard(30);

    // Epic striker (10) vs Normal keeper (0) → baseGoal=true
    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Epic"), activePlayed: cheat, side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: intimidate, side: "left" },
    );

    expect(outcome.goal).toBe(true);  // 10 > 0
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(rng.next).not.toHaveBeenCalled();
    // Both cards still consumed
    expect(cheat.used).toBe(true);
    expect(intimidate.used).toBe(true);
  });

  it("both fire, equal power → cancel, goal=false (goalkeeper wins tie)", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: makeCheatingCard(), side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: makeIntimidateCard(), side: "left" },
    );

    expect(outcome.goal).toBe(false);
    expect(rng.next).not.toHaveBeenCalled();
  });

  it("both fire → both appear in activesFired", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const intimidate = makeIntimidateCard(30);

    const outcome = resolver.resolve(
      { chosenCard: makeShootCard("Normal"), activePlayed: cheat, side: "left" },
      { chosenCard: makeSaveCard("Normal"), activePlayed: intimidate, side: "left" },
    );

    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({ cardId: 20, by: "striker" }),
    );
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({ cardId: 30, by: "goalkeeper" }),
    );
  });
});

// ─── Batch 3 — Nullify tests ──────────────────────────────────────────────────

describe("PenaltyResolver — Nullify pipeline (REQ-RESOLVER-004 step 1, REQ-LIFECYCLE-004)", () => {
  // SCEN-RESOLVER-004: striker Nullify zeroes goalkeeper power before read
  it("striker NullifyCard zeroes goalkeeper passive effectivePower", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const goalkeeperCard = makeSaveCard("Epic"); // power=10
    const nullify = makeNullifyCard();

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: nullify,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "left",
    };

    resolver.resolve(strikerDecision, goalkeeperDecision);

    // After nullify, goalkeeper's effectivePower should be 0
    expect(goalkeeperCard.effectivePower).toBe(0);
    // Nullify card should be used
    expect(nullify.used).toBe(true);
  });

  // SCEN-OUTCOME-002: evidence.nullifiedActives contains goalkeeper's active when striker plays Nullify
  it("striker Nullify: nullifiedActives records goalkeeper's active card id when present", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: makeNullifyCard(10),
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "left",
    };

    // Mark intimidate as already used so nullify fires but intimidate doesn't
    intimidate.used = true;

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    // Nullify targets the goalkeeper's PASSIVE (chosenCard), not the active — so the nullifiedActives
    // records the goalkeeper's active played (which was nullified by having its passive zeroed)
    // Actually per spec: nullifiedActives records actives that were CANCELLED by a NullifyCard.
    // The IntimidateCard is cancelled if it cannot fire because passive was nullified.
    // But wait — in SCEN-OUTCOME-002: "striker plays NullifyCard and goalkeeper plays IntimidateCard"
    // → "evidence.nullifiedActives contains the goalkeeper's IntimidateCard id"
    // The NullifyCard zeroes the passive. The Intimidate is then skipped because it fires after Nullify.
    // But Intimidate checks canActivate() and immuneToActives — not whether passive was nullified.
    // Per spec: nullifiedActives = actives cancelled by NullifyCard.
    // This means: if goalkeeper plays Nullify against striker's passive, striker's active is in nullifiedActives.
    // If striker plays Nullify against goalkeeper's passive, goalkeeper's active is in nullifiedActives.
    // We track: when a player's passive is nullified, their active (if any) goes into nullifiedActives.

    // In this test: striker's Nullify targets goalkeeper's passive. Goalkeeper has IntimidateCard (used=true).
    // The IntimidateCard is in nullifiedActives because the goalkeeper's passive was nullified.
    expect(outcome.evidence.nullifiedActives).toContainEqual(
      expect.objectContaining({ cardId: 30, by: "goalkeeper" }),
    );
    // IntimidateCard is used=true so it doesn't fire anyway, but it's still in nullifiedActives
    expect(outcome.evidence.activesFired).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
  });

  // SCEN-RESOLVE-NULLIFY: goalkeeper NullifyCard zeroes striker's passive
  it("goalkeeper NullifyCard zeroes striker's passive effectivePower", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const strikerCard = makeShootCard("Epic"); // power=10
    const nullify = makeNullifyCard(10);

    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: nullify,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(strikerCard.effectivePower).toBe(0);
    expect(nullify.used).toBe(true);
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({ cardId: 10, by: "goalkeeper" }),
    );
  });

  // SCEN-RESOLVE-DOUBLE-NULLIFY: both players play NullifyCard → both passives zeroed → deterministic tie
  it("double NullifyCard: both passives zeroed → goal=false (goalkeeper wins tie), no RNG", () => {
    const rng = makeRng(0.6);
    const resolver = new PenaltyResolver(rng);

    const strikerCard = makeShootCard("Epic"); // power=10
    const goalkeeperCard = makeSaveCard("Epic"); // power=10
    const strikerNullify = makeNullifyCard(11);
    const goalkeeperNullify = makeNullifyCard(12);

    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      activePlayed: strikerNullify,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      activePlayed: goalkeeperNullify,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(strikerCard.effectivePower).toBe(0);
    expect(goalkeeperCard.effectivePower).toBe(0);
    expect(outcome.evidence.finalPGoal).toBeNull(); // no active card → deterministic
    expect(outcome.goal).toBe(false); // 0 not > 0 → goalkeeper saves
    expect(rng.next).not.toHaveBeenCalled();
  });
});

// ─── Batch 3 — Intimidate tests ───────────────────────────────────────────────

describe("PenaltyResolver — Intimidate pipeline (REQ-RESOLVER-004 step 2, REQ-LIFECYCLE-003)", () => {
  // SCEN-RESOLVE-IMMUNE: striker passive immuneToActives=true → IntimidateCard skipped
  it("strikerDecision.chosenCard.immuneToActives=true → Intimidate skipped, used stays false", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const strikerCard = makeShootCard("Normal");
    strikerCard.makeImmune(); // immuneToActives = true

    const intimidate = makeIntimidateCard(30);
    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(intimidate.used).toBe(false); // activate() NOT called
    expect(outcome.evidence.activesFired).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
    // No active fired → deterministic, finalPGoal=null
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(rng.next).not.toHaveBeenCalled();
  });

  // SCEN-LIFECYCLE-001 via Intimidate: activePlayed.used=true after activation
  it("IntimidateCard.used=true after it fires", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "left",
    };

    resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(intimidate.used).toBe(true);
  });

  // Intimidate fires: finalPGoal = 100 - missChanceVs(striker.tier)
  it("IntimidateCard sets finalPGoal = 100 - missChanceVs(striker.tier)", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      side: "left",
    }; // tier=Normal, missChance=70 → finalPGoal=30
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.evidence.finalPGoal).toBe(30); // 100 - 70
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({ cardId: 30, by: "goalkeeper" }),
    );
  });
});

// ─── Batch 3 — Cheating tests ─────────────────────────────────────────────────

describe("PenaltyResolver — Cheating pipeline (REQ-RESOLVER-004 step 3, REQ-LIFECYCLE-001, REQ-LIFECYCLE-002)", () => {
  // SCEN-PD-EXT-002: CheatingCard fires → used=true, activesFired contains card
  it("CheatingCard fires → used=true and appears in activesFired", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(cheat.used).toBe(true);
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({ cardId: 20, by: "striker" }),
    );
  });

  // SCEN-RESOLVE-USED: CheatingCard with used=true → ignored
  it("CheatingCard with used=true → ignored, activesFired empty, finalPGoal=null (no actives)", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    cheat.used = true; // already activated

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.evidence.activesFired).not.toContainEqual(
      expect.objectContaining({ cardId: 20 }),
    );
    expect(outcome.evidence.finalPGoal).toBeNull(); // no active fired → deterministic
  });

  // SCEN-LIFECYCLE-001: CheatingCard used=true after Cheating phase
  it("CheatingCard.used=true after Cheating phase fires", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    };

    resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(cheat.used).toBe(true);
  });

  // goalkeeperDecision.chosenCard.immuneToActives=true → CheatingCard skipped
  it("goalkeeper passive immuneToActives=true → CheatingCard skipped, finalPGoal=null", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const goalkeeperCard = makeSaveCard("Normal");
    goalkeeperCard.makeImmune(); // immuneToActives = true

    const cheat = makeCheatingCard(20);
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(cheat.used).toBe(false);
    expect(outcome.evidence.finalPGoal).toBeNull(); // no active fired → deterministic
    expect(outcome.evidence.activesFired).not.toContainEqual(
      expect.objectContaining({ cardId: 20 }),
    );
    expect(rng.next).not.toHaveBeenCalled();
  });
});

// ─── Batch 3 — Evidence shape (SCEN-OUTCOME-001, SCEN-RESOLVER-003) ──────────

describe("PenaltyResolver — evidence shape (REQ-OUTCOME-001, REQ-RESOLVER-003)", () => {
  it("resolve() returns goal:boolean and populated evidence with all required fields", () => {
    const rng = makeRng(0.4);
    const resolver = new PenaltyResolver(rng);

    const strikerCard = makeShootCard("Normal");
    const goalkeeperCard = makeSaveCard("Normal");
    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "left",
    };

    const outcome: ResolutionOutcome = resolver.resolve(
      strikerDecision,
      goalkeeperDecision,
    );

    expect(typeof outcome.goal).toBe("boolean");
    expect(typeof outcome.evidence.strikerPassiveId).toBe("number");
    expect(typeof outcome.evidence.goalkeeperPassiveId).toBe("number");
    expect(Array.isArray(outcome.evidence.activesFired)).toBe(true);
    expect(Array.isArray(outcome.evidence.nullifiedActives)).toBe(true);
    // No actives fired → deterministic path: finalPGoal and roll are null
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
  });

  it("strikerPassiveId and goalkeeperPassiveId match the chosen cards' ids", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const strikerCard = new ShootCard(42, "Shoot", "desc", "", "Normal");
    const goalkeeperCard = new SaveCard(99, "Save", "desc", "", "Normal");
    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "left",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.evidence.strikerPassiveId).toBe(42);
    expect(outcome.evidence.goalkeeperPassiveId).toBe(99);
  });

  // SCEN-RESOLVER-003: no forbidden mutations on PlayerDecision, Striker/Goalkeeper
  it("goalkeeper passive effectivePower unchanged when no Nullify played", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const goalkeeperCard = makeSaveCard("Epic"); // effectivePower = 10
    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "left",
    };

    const powerBefore = goalkeeperCard.effectivePower;
    resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(goalkeeperCard.effectivePower).toBe(powerBefore);
  });
});

// ─── Batch 4 — Determinism ────────────────────────────────────────────────────

describe("PenaltyResolver — determinism (REQ-IRNG-003, REQ-RESOLVER-001)", () => {
  // SCEN-RESOLVE-DETERMINISM: same stub RNG + same inputs → identical outcomes across 3 calls
  it("stub IRng produces identical outcomes across 3 resolve() calls", () => {
    const rng: IRng = { next: () => 0.3 }; // pure stub, no vi.fn()
    const resolver = new PenaltyResolver(rng);

    const makeStrikerDecision = (): PlayerDecision => ({
      chosenCard: makeShootCard("Epic"),
      side: "left",
    });
    const makeGoalkeeperDecision = (): PlayerDecision => ({
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    });

    const results = [
      resolver.resolve(makeStrikerDecision(), makeGoalkeeperDecision()),
      resolver.resolve(makeStrikerDecision(), makeGoalkeeperDecision()),
      resolver.resolve(makeStrikerDecision(), makeGoalkeeperDecision()),
    ];

    expect(results[0].goal).toBe(results[1].goal);
    expect(results[1].goal).toBe(results[2].goal);
    expect(results[0].evidence.finalPGoal).toBe(results[1].evidence.finalPGoal);
    expect(results[1].evidence.finalPGoal).toBe(results[2].evidence.finalPGoal);
  });

  // SCEN-IRNG-003: stub { next: () => 0.3 } passed to PenaltyResolver → deterministic outcome
  it("stub IRng { next: () => 0.3 } passed to PenaltyResolver → deterministic across calls", () => {
    const stubRng: IRng = { next: () => 0.3 };
    const resolver = new PenaltyResolver(stubRng);

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      side: "left",
    };

    const first = resolver.resolve(strikerDecision, goalkeeperDecision);
    const second = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(first.goal).toBe(second.goal);
    expect(first.evidence.finalPGoal).toBe(second.evidence.finalPGoal);
  });

  // SCEN-RESOLVER-002: when both actives cancel, no RNG is consumed
  it("Intimidate + CheatingCard cancel → rng.next() NOT called", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const intimidate = makeIntimidateCard(30);

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "left",
    };

    resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(rng.next).not.toHaveBeenCalled();
  });
});

// ─── Batch 8 — Step 0: Side-mismatch scenarios ───────────────────────────────

// Helper that creates a PlayerDecision with an explicit side — used in new side-aware tests
function makeStrikerDecisionWithSide(
  side: Side,
  activePlayed?: CheatingCard | NullifyCard,
): PlayerDecision {
  return {
    chosenCard: makeShootCard("Normal"),
    activePlayed,
    side,
  };
}

function makeGoalkeeperDecisionWithSide(
  side: Side,
  activePlayed?: IntimidateCard | NullifyCard,
): PlayerDecision {
  return {
    chosenCard: makeSaveCard("Normal"),
    activePlayed,
    side,
  };
}

// SCEN-RESOLVER-SIDES-MISMATCH-GOAL
describe("PenaltyResolver — Step 0: sides mismatch → unconditional goal", () => {
  it("striker 'left' vs goalkeeper 'right' → goal=true, directGoal=true, sidesMatched=false", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const strikerDecision = makeStrikerDecisionWithSide("left");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide("right");

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.goal).toBe(true);
    expect(outcome.evidence.directGoal).toBe(true);
    expect(outcome.evidence.sidesMatched).toBe(false);
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
  });

  it("evidence contains kickSide and diveSide matching the decisions", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right"),
    );

    expect(outcome.evidence.kickSide).toBe("left");
    expect(outcome.evidence.diveSide).toBe("right");
  });

  it("evidence.activesFired is empty on mismatch path", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right"),
    );

    expect(outcome.evidence.activesFired).toHaveLength(0);
    expect(outcome.evidence.nullifiedActives).toHaveLength(0);
  });

  it("strikerPassiveId and goalkeeperPassiveId populated even on mismatch", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const striker = makeStrikerDecisionWithSide("left");
    const goalkeeper = makeGoalkeeperDecisionWithSide("center");

    const outcome = resolver.resolve(striker, goalkeeper);

    expect(outcome.evidence.strikerPassiveId).toBe(striker.chosenCard.id);
    expect(outcome.evidence.goalkeeperPassiveId).toBe(goalkeeper.chosenCard.id);
  });
});

// SCEN-RESOLVER-MISMATCH-CARDS-USED
describe("PenaltyResolver — Step 0: actives consumed on mismatch", () => {
  it("striker active with canActivate()=true → markUsed() called, used=true, in consumedOnMiss", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const strikerDecision = makeStrikerDecisionWithSide("left", cheat);
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide("right");

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(cheat.used).toBe(true);
    expect(outcome.evidence.consumedOnMiss).toContainEqual(
      expect.objectContaining({ cardId: 20, by: "striker" }),
    );
  });

  it("goalkeeper IntimidateCard on mismatch → activate() called, used=true, in activesFired (Branch C), NOT in consumedOnMiss", () => {
    // Phase 9.1 migration: Intimidate fires Branch C, goes to activesFired not consumedOnMiss
    const rng = makeRng(0.9); // 0.9 >= 60/100 → goal=true, Normal tier lowMissChanceVs=60
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerDecision = makeStrikerDecisionWithSide("right");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "left",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(intimidate.used).toBe(true); // activate() sets used=true
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({
        cardId: 30,
        by: "goalkeeper",
        effect: "intimidate-mismatch",
      }),
    );
    expect(outcome.evidence.consumedOnMiss).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
    expect(outcome.evidence.directGoal).toBe(false);
    expect(outcome.evidence.intimidateMismatchRoll).toBeDefined();
  });

  it("already-used active (canActivate()=false) → NOT in consumedOnMiss", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    cheat.used = true; // already used

    const strikerDecision = makeStrikerDecisionWithSide("left", cheat);
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide("right");

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.evidence.consumedOnMiss).toHaveLength(0);
  });

  it("CheatingCard in consumedOnMiss and IntimidateCard in activesFired when both canActivate() and sides differ (Branch C)", () => {
    // Phase 9.2 migration: Intimidate → Branch C (activesFired), CheatingCard → consumedOnMiss
    const rng = makeRng(0.9); // 0.9 >= 60/100 → goal=true, Normal tier lowMissChanceVs=60
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const intimidate = makeIntimidateCard(30);

    const strikerDecision = makeStrikerDecisionWithSide("left", cheat);
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "right",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(cheat.used).toBe(true);
    expect(intimidate.used).toBe(true);
    // CheatingCard consumed without effect → consumedOnMiss (length 1)
    expect(outcome.evidence.consumedOnMiss).toHaveLength(1);
    expect(outcome.evidence.consumedOnMiss).toContainEqual(
      expect.objectContaining({ cardId: 20, by: "striker" }),
    );
    // IntimidateCard fired → activesFired (length 1)
    expect(outcome.evidence.activesFired).toHaveLength(1);
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({
        cardId: 30,
        by: "goalkeeper",
        effect: "intimidate-mismatch",
      }),
    );
    expect(outcome.evidence.directGoal).toBe(false);
    expect(outcome.evidence.intimidateMismatchRoll).toBeDefined();
  });
});

// SCEN-RESOLVER-MISMATCH-NO-EFFECTS
describe("PenaltyResolver — Step 0: no gameplay effects on mismatch", () => {
  it("CheatingCard's effect (applyTo) NOT fired — goalkeeper passive power unchanged", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const cheat = makeCheatingCard(20);
    const goalkeeperCard = makeSaveCard("Normal"); // power = 0
    const powerBefore = goalkeeperCard.getCurrentPower();

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: cheat,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: goalkeeperCard,
      side: "right",
    };

    resolver.resolve(strikerDecision, goalkeeperDecision);

    // Cheating's applyTo would boost goalkeeperCard.bonusPower — it must NOT
    expect(goalkeeperCard.getCurrentPower()).toBe(powerBefore);
  });
});

// SCEN-RESOLVER-MISMATCH-NO-RNG
describe("PenaltyResolver — Step 0: rng.next() never called on mismatch", () => {
  it("rng.next() is NOT called when sides differ", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("center"),
    );

    expect(rng.next).not.toHaveBeenCalled();
  });
});

// ─── Intimidate mismatch branches (Phases 3-9) ───────────────────────────────

// Branch D: Nullify cancels Intimidate
describe("PenaltyResolver — intimidate mismatch: Branch D (Nullify cancels Intimidate)", () => {
  // SCEN-RESOLVER-MISMATCH-NULLIFY-CANCELS
  it("striker NullifyCard cancels goalkeeper IntimidateCard on mismatch: rng NOT called, goal=true, both in consumedOnMiss", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const nullify = makeNullifyCard(10);

    const strikerDecision: PlayerDecision = {
      chosenCard: makeShootCard("Normal"),
      activePlayed: nullify,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "right",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(rng.next).not.toHaveBeenCalled();
    expect(outcome.goal).toBe(true);
    expect(outcome.evidence.directGoal).toBe(true);
    // Branch D pushes gk first then striker — exact order distinguishes Branch D from Branch A
    // (Branch A pushes striker first: [{cardId:10, by:"striker"}, {cardId:30, by:"goalkeeper"}])
    expect(outcome.evidence.consumedOnMiss).toEqual([
      { cardId: 30, by: "goalkeeper" },
      { cardId: 10, by: "striker" },
    ]);
    expect(intimidate.used).toBe(true);
    expect(nullify.used).toBe(true);
    expect(outcome.evidence.intimidateMismatchRoll).toBeUndefined();
  });
});

// Branch E: immune-blocks-Intimidate
describe("PenaltyResolver — intimidate mismatch: Branch E (immune blocks Intimidate)", () => {
  // SCEN-RESOLVER-MISMATCH-IMMUNE-BLOCKS
  it("striker immuneToActives=true: rng NOT called, goal=true, Intimidate NOT consumed, directGoal=true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerCard = makeShootCard("Normal");
    strikerCard.makeImmune(); // immuneToActives = true

    const strikerDecision: PlayerDecision = {
      chosenCard: strikerCard,
      side: "left",
    };
    const goalkeeperDecision: PlayerDecision = {
      chosenCard: makeSaveCard("Normal"),
      activePlayed: intimidate,
      side: "right",
    };

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(rng.next).not.toHaveBeenCalled();
    expect(outcome.goal).toBe(true);
    expect(outcome.evidence.directGoal).toBe(true);
    expect(intimidate.used).toBe(false); // NOT consumed
    expect(outcome.evidence.consumedOnMiss).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
    expect(outcome.evidence.activesFired).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
    expect(outcome.evidence.intimidateMismatchRoll).toBeUndefined();
  });
});

// Branch C: Intimidate fires — miss path (roll < threshold)
describe("PenaltyResolver — intimidate mismatch: Branch C miss path", () => {
  // SCEN-RESOLVER-MISMATCH-INTIMIDATE-MISS
  it("Intimidate fires, RNG=0.1, Normal tier (threshold=0.60): goal=false, missed=true, in activesFired, directGoal=false", () => {
    const rng = makeRng(0.1);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);

    const strikerDecision = makeStrikerDecisionWithSide("left");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "right",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.goal).toBe(false); // roll 0.1 < threshold 0.60 → missed
    expect(outcome.evidence.directGoal).toBe(false);
    expect(outcome.evidence.intimidateMismatchRoll).toBeDefined();
    expect(outcome.evidence.intimidateMismatchRoll!.roll).toBe(0.1);
    expect(outcome.evidence.intimidateMismatchRoll!.threshold).toBe(60);
    expect(outcome.evidence.intimidateMismatchRoll!.missed).toBe(true);
    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({
        cardId: 30,
        by: "goalkeeper",
        effect: "intimidate-mismatch",
      }),
    );
    expect(outcome.evidence.consumedOnMiss).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(rng.next).toHaveBeenCalledTimes(1);
  });
});

// Branch C: Intimidate fires — goal path (roll >= threshold)
describe("PenaltyResolver — intimidate mismatch: Branch C goal path", () => {
  // SCEN-RESOLVER-MISMATCH-INTIMIDATE-GOAL
  it("Intimidate fires, RNG=0.9, Normal tier (threshold=0.60): goal=true, missed=false, directGoal=false", () => {
    const rng = makeRng(0.9);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);

    const strikerDecision = makeStrikerDecisionWithSide("left");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "right",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.goal).toBe(true); // roll 0.9 >= threshold 0.60 → goal
    expect(outcome.evidence.directGoal).toBe(false);
    expect(outcome.evidence.intimidateMismatchRoll).toBeDefined();
    expect(outcome.evidence.intimidateMismatchRoll!.missed).toBe(false);
    expect(rng.next).toHaveBeenCalledTimes(1);
  });
});

// Branch A: already-used Intimidate falls through to default mismatch
describe("PenaltyResolver — intimidate mismatch: Branch A (already-used Intimidate)", () => {
  // SCEN-RESOLVER-MISMATCH-INTIMIDATE-ALREADY-USED
  it("goalkeeper IntimidateCard already used (canActivate=false): rng NOT called, goal=true, directGoal=true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    intimidate.used = true; // pre-used — canActivate() returns false

    const strikerDecision = makeStrikerDecisionWithSide("left");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "right",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(rng.next).not.toHaveBeenCalled();
    expect(outcome.goal).toBe(true);
    expect(outcome.evidence.directGoal).toBe(true);
    expect(outcome.evidence.intimidateMismatchRoll).toBeUndefined();
    // already-used card is NOT added to consumedOnMiss (Branch A skips it since canActivate=false)
    expect(outcome.evidence.consumedOnMiss).not.toContainEqual(
      expect.objectContaining({ cardId: 30 }),
    );
  });
});

// Phase 8: Evidence + directGoal semantics
describe("PenaltyResolver — intimidate mismatch: evidence shape & directGoal semantics (Phase 8)", () => {
  // SCEN-EVIDENCE-INTIMIDATE-MISMATCH-PRESENT
  it("Intimidate fires: activesFired populated, finalPGoal=null, roll=null, intimidateMismatchRoll defined", () => {
    const rng = makeRng(0.9);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const strikerDecision = makeStrikerDecisionWithSide("left");
    const goalkeeperDecision = makeGoalkeeperDecisionWithSide(
      "right",
      intimidate,
    );

    const outcome = resolver.resolve(strikerDecision, goalkeeperDecision);

    expect(outcome.evidence.activesFired).toContainEqual(
      expect.objectContaining({
        cardId: 30,
        by: "goalkeeper",
        effect: "intimidate-mismatch",
      }),
    );
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(outcome.evidence.intimidateMismatchRoll).toBeDefined();
  });

  // SCEN-EVIDENCE-INTIMIDATE-MISMATCH-ABSENT
  it("no Intimidate on mismatch: intimidateMismatchRoll is undefined", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right"),
    );

    expect(outcome.evidence.intimidateMismatchRoll).toBeUndefined();
  });

  // SCEN-DIRECTGOAL-FIRED-INTIMIDATE: directGoal=false on both miss and goal when Intimidate fires
  it("Intimidate fires (miss case): evidence.directGoal === false", () => {
    const rng = makeRng(0.1);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right", intimidate),
    );

    expect(outcome.evidence.directGoal).toBe(false);
  });

  it("Intimidate fires (goal case): evidence.directGoal === false", () => {
    const rng = makeRng(0.9);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right", intimidate),
    );

    expect(outcome.evidence.directGoal).toBe(false);
  });

  // SCEN-DIRECTGOAL-NOT-FIRED: directGoal=true when Intimidate did NOT fire
  it("no Intimidate on mismatch: evidence.directGoal === true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right"),
    );

    expect(outcome.evidence.directGoal).toBe(true);
  });

  it("already-used Intimidate on mismatch: evidence.directGoal === true", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const intimidate = makeIntimidateCard(30);
    intimidate.used = true;

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("right", intimidate),
    );

    expect(outcome.evidence.directGoal).toBe(true);
  });
});

// SCEN-RESOLVER-SIDES-MATCH
describe("PenaltyResolver — Step 0: sides match → existing pipeline runs", () => {
  it("both 'center' → sidesMatched=true, directGoal=false, finalPGoal=null (no actives), roll=null", () => {
    const rng = makeRng(0.4);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("center"),
      makeGoalkeeperDecisionWithSide("center"),
    );

    expect(outcome.evidence.sidesMatched).toBe(true);
    expect(outcome.evidence.directGoal).toBe(false);
    expect(outcome.evidence.finalPGoal).toBeNull();
    expect(outcome.evidence.roll).toBeNull();
    expect(outcome.evidence.consumedOnMiss).toHaveLength(0);
  });

  it("matched sides: kickSide and diveSide populated in evidence", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("right"),
      makeGoalkeeperDecisionWithSide("right"),
    );

    expect(outcome.evidence.kickSide).toBe("right");
    expect(outcome.evidence.diveSide).toBe("right");
    expect(outcome.evidence.sidesMatched).toBe(true);
  });

  it("matched sides, no actives: rng.next() NOT called", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    resolver.resolve(
      makeStrikerDecisionWithSide("left"),
      makeGoalkeeperDecisionWithSide("left"),
    );

    expect(rng.next).not.toHaveBeenCalled();
  });

  it("matched sides with CheatingCard: rng.next() called exactly once", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    resolver.resolve(
      makeStrikerDecisionWithSide("left", makeCheatingCard()),
      makeGoalkeeperDecisionWithSide("left"),
    );

    expect(rng.next).toHaveBeenCalledTimes(1);
  });

  it("matched sides with CheatingCard: finalPGoal is a number in valid range", () => {
    const rng = makeRng(0.5);
    const resolver = new PenaltyResolver(rng);

    const outcome = resolver.resolve(
      makeStrikerDecisionWithSide("center", makeCheatingCard()),
      makeGoalkeeperDecisionWithSide("center"),
    );

    const pGoal = outcome.evidence.finalPGoal as number;
    expect(pGoal).toBeGreaterThan(0);
    expect(pGoal).toBeLessThanOrEqual(100);
  });
});
