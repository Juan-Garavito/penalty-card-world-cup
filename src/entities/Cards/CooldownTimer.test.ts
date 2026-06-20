import { describe, it, expect } from "vitest";
import { CooldownTimer } from "./CooldownTimer.ts";

describe("CooldownTimer.rewind()", () => {
  it("advances shotsSinceUse and makes isReady() true when threshold is crossed", () => {
    // Special tier: cooldown=3
    const timer = new CooldownTimer(3);
    timer.play(); // marks unready, shotsSinceUse=0
    timer.tick(); // shotsSinceUse=1
    timer.tick(); // shotsSinceUse=2 — still not ready

    expect(timer.isReady()).toBe(false);

    timer.rewind(2); // shotsSinceUse becomes 4 >= 3 — should be ready

    expect(timer.isReady()).toBe(true);
  });

  it("is a no-op when isReady() is already true", () => {
    // Normal tier: cooldown=0, always ready
    const timer = new CooldownTimer(0);

    expect(timer.isReady()).toBe(true);

    timer.rewind(5); // should be a no-op

    expect(timer.isReady()).toBe(true);
  });

  it("keeps reporting isReady() true after no-op rewind on a ready timer", () => {
    const timer = new CooldownTimer(3);
    timer.play();
    timer.tick();
    timer.tick();
    timer.tick(); // shotsSinceUse=3 >= 3 — ready now via tick

    expect(timer.isReady()).toBe(true);

    timer.rewind(2); // already ready — must be no-op

    expect(timer.isReady()).toBe(true);
  });
});
