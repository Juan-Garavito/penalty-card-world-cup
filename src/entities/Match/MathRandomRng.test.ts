import { describe, it, expect } from "vitest";
import { MathRandomRng } from "./MathRandomRng.ts";
import { IRng } from "./IRng.ts";

// REQ-IRNG-001, REQ-IRNG-002

describe("MathRandomRng", () => {
  // SCEN-IRNG-001 — MathRandomRng satisfies IRng (structural check via type assignment)
  it("is assignable to IRng", () => {
    const rng: IRng = new MathRandomRng();
    expect(rng).toBeDefined();
  });

  // SCEN-IRNG-002 — Returns values in [0, 1) across 1000 calls
  it("next() returns values in [0, 1) for 1000 calls", () => {
    const rng = new MathRandomRng();
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
