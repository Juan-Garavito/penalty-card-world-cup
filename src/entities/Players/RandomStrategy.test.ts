import { describe, it, expect, vi } from "vitest";
import { RandomStrategy } from "./RandomStrategy.ts";
import { IAStrategy } from "./IAStrategy.ts";
import { TurnContext } from "./TurnContext.ts";
import { EmptyCardPoolError } from "./errors/EmptyCardPoolError.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";

function makeCard(id: number): ShootCard {
  return new ShootCard(id, `Card${id}`, "desc", "", "Normal");
}

// SCEN-STRAT-01 — IAStrategy structural type compatibility
describe("IAStrategy structural type", () => {
  it("RandomStrategy satisfies IAStrategy interface", () => {
    const strategy: IAStrategy = new RandomStrategy();
    expect(strategy).toBeDefined();
  });
});

// SCEN-STRAT-02 — Deterministic with mocked RNG
describe("RandomStrategy.pick — deterministic RNG", () => {
  it("always picks index 0 when rng returns 0", () => {
    const rng = vi.fn(() => 0);
    const strategy = new RandomStrategy(rng);
    const cardA = makeCard(1);
    const cardB = makeCard(2);
    const ctx: TurnContext = {
      turnNumber: 1,
      role: "shooter",
      availableCards: [cardA, cardB],
    };

    const result1 = strategy.pick(ctx);
    const result2 = strategy.pick(ctx);
    const result3 = strategy.pick(ctx);

    expect(result1).toBe(cardA);
    expect(result2).toBe(cardA);
    expect(result3).toBe(cardA);
  });

  it("picks last card when rng returns 0.99", () => {
    const rng = vi.fn(() => 0.99);
    const strategy = new RandomStrategy(rng);
    const cardA = makeCard(1);
    const cardB = makeCard(2);
    const ctx: TurnContext = {
      turnNumber: 1,
      role: "shooter",
      availableCards: [cardA, cardB],
    };

    const result = strategy.pick(ctx);
    expect(result).toBe(cardB);
  });
});

// SCEN-STRAT-03 — Throws EmptyCardPoolError on empty pool
describe("RandomStrategy.pick — empty pool", () => {
  it("throws EmptyCardPoolError when availableCards is empty", () => {
    const strategy = new RandomStrategy();
    const ctx: TurnContext = {
      turnNumber: 1,
      role: "shooter",
      availableCards: [],
    };

    expect(() => strategy.pick(ctx)).toThrowError(EmptyCardPoolError);
  });
});

// ─── pickActive tests ─────────────────────────────────────────────────────────

import { CheatingCard } from "../Cards/active/CheatingCard.ts";

function makeActiveCard(id: number): CheatingCard {
  return new CheatingCard(id, `Active${id}`, "desc", "");
}

// SCEN-RANDOM-EMPTY — REQ-RANDOMSTRATEGY-EXT-002
describe("RandomStrategy.pickActive — empty pool", () => {
  it("returns undefined immediately without consuming any rng call", () => {
    const rng = vi.fn(() => 0.5);
    const strategy = new RandomStrategy(rng);

    const result = strategy.pickActive("shooter", []);

    expect(result).toBeUndefined();
    expect(rng).not.toHaveBeenCalled();
  });
});

// SCEN-RANDOM-SKIP — first rng < 0.5 → skip, return undefined, exactly 1 rng call
describe("RandomStrategy.pickActive — skip decision (rng < 0.5)", () => {
  it("returns undefined and consumes exactly 1 rng call when first rng value is 0.3", () => {
    const rng = vi.fn(() => 0.3);
    const strategy = new RandomStrategy(rng);
    const pool = [makeActiveCard(1), makeActiveCard(2)];

    const result = strategy.pickActive("shooter", pool);

    expect(result).toBeUndefined();
    expect(rng).toHaveBeenCalledTimes(1);
  });
});

// SCEN-RANDOM-PICK — first rng >= 0.5 → pick card, exactly 2 rng calls — REQ-RANDOMSTRATEGY-EXT-001
describe("RandomStrategy.pickActive — pick decision (rng >= 0.5)", () => {
  it("returns pool[0] and consumes exactly 2 rng calls when rng returns [0.7, 0.0]", () => {
    const values = [0.7, 0.0];
    let callIndex = 0;
    const rng = vi.fn(() => values[callIndex++]);
    const strategy = new RandomStrategy(rng);
    const pool = [makeActiveCard(1), makeActiveCard(2), makeActiveCard(3)];

    const result = strategy.pickActive("shooter", pool);

    expect(result).toBe(pool[0]); // Math.floor(0.0 * 3) = 0
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("returns pool[2] and consumes exactly 2 rng calls when rng returns [0.9, 0.99] and pool has 3 items", () => {
    const values = [0.9, 0.99];
    let callIndex = 0;
    const rng = vi.fn(() => values[callIndex++]);
    const strategy = new RandomStrategy(rng);
    const pool = [makeActiveCard(1), makeActiveCard(2), makeActiveCard(3)];

    const result = strategy.pickActive("goalkeeper", pool);

    expect(result).toBe(pool[2]); // Math.floor(0.99 * 3) = 2
    expect(rng).toHaveBeenCalledTimes(2);
  });
});

// SCEN-RANDOM-DETERMINISM — REQ-RANDOMSTRATEGY-EXT-003
// Updated: sequence extended to [0.0, 0.7, 0.0, 0.0] (+1 rng call for pickSide)
describe("RandomStrategy.pickActive — determinism: same seed produces identical result", () => {
  it("two strategies with identical rng sequences return the same active card", () => {
    const passiveCard = makeCard(10);
    const poolA = [makeActiveCard(1), makeActiveCard(2)];
    const poolB = [makeActiveCard(1), makeActiveCard(2)];

    // Both strategies share the same rng sequence: [0.0, 0.7, 0.0, 0.0]
    // pick()       → rng call 1: 0.0  → index 0 → passiveCard
    // pickActive() → rng call 2: 0.7  → >= 0.5 → pick active
    //                rng call 3: 0.0  → index 0 → pool[0]
    // pickSide()   → rng call 4: 0.0  → index 0 → "left"
    const rngA = (() => {
      const v = [0.0, 0.7, 0.0, 0.0];
      let i = 0;
      return () => v[i++]!;
    })();
    const rngB = (() => {
      const v = [0.0, 0.7, 0.0, 0.0];
      let i = 0;
      return () => v[i++]!;
    })();
    const stratA = new RandomStrategy(rngA);
    const stratB = new RandomStrategy(rngB);

    const ctxWithCards: TurnContext = {
      turnNumber: 1,
      role: "shooter",
      availableCards: [passiveCard],
    };
    const pickA = stratA.pick(ctxWithCards);
    const activeA = stratA.pickActive("shooter", poolA);
    const pickB = stratB.pick(ctxWithCards);
    const activeB = stratB.pickActive("shooter", poolB);

    expect(pickA.id).toBe(pickB.id);
    expect(activeA?.id).toBe(activeB?.id);
  });
});

// ─── pickSide tests ───────────────────────────────────────────────────────────

import { Side } from "./Side.ts";

// SCEN-RANDOM-SIDE-MAPPING
describe("RandomStrategy.pickSide — side mapping from rng value", () => {
  it("returns 'left' when rng returns 0.0", () => {
    const rng = vi.fn(() => 0.0);
    const strategy = new RandomStrategy(rng);
    const result: Side = strategy.pickSide("shooter");
    expect(result).toBe("left");
  });

  it("returns 'center' when rng returns 0.5 (in [1/3, 2/3))", () => {
    const rng = vi.fn(() => 0.5);
    const strategy = new RandomStrategy(rng);
    expect(strategy.pickSide("shooter")).toBe("center");
  });

  it("returns 'right' when rng returns 0.7 (>= 2/3)", () => {
    const rng = vi.fn(() => 0.7);
    const strategy = new RandomStrategy(rng);
    expect(strategy.pickSide("shooter")).toBe("right");
  });

  it("returns 'right' when rng returns 0.99", () => {
    const rng = vi.fn(() => 0.99);
    const strategy = new RandomStrategy(rng);
    expect(strategy.pickSide("goalkeeper")).toBe("right");
  });

  it("consumes exactly 1 rng call per pickSide invocation", () => {
    const rng = vi.fn(() => 0.0);
    const strategy = new RandomStrategy(rng);
    strategy.pickSide("shooter");
    expect(rng).toHaveBeenCalledTimes(1);
  });
});

// SCEN-RANDOM-SIDE-DETERMINISTIC
describe("RandomStrategy.pickSide — deterministic with fixed seed", () => {
  it("same seeded rng produces same side on two calls", () => {
    // Two strategies with identical sequences produce identical sides
    const makeSeeded = () => {
      const v = [0.5];
      let i = 0;
      return () => v[i++ % v.length]!;
    };
    const stratA = new RandomStrategy(makeSeeded());
    const stratB = new RandomStrategy(makeSeeded());

    expect(stratA.pickSide("shooter")).toBe(stratB.pickSide("shooter"));
  });

  it("role argument does not affect the result (uniform distribution in v1)", () => {
    const rng = vi.fn(() => 0.0);
    const strategy = new RandomStrategy(rng);
    const shooterResult = strategy.pickSide("shooter");

    const rng2 = vi.fn(() => 0.0);
    const strategy2 = new RandomStrategy(rng2);
    const goalkeeperResult = strategy2.pickSide("goalkeeper");

    expect(shooterResult).toBe(goalkeeperResult);
  });
});
