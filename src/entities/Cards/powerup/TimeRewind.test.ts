import { describe, it, expect } from "vitest";
import { ShootCard } from "../passive/ShootCard.ts";
import { TimeRewind } from "./TimeRewind.ts";

describe("TimeRewind", () => {
  // SCEN-TIMEREWIND-1
  it("equipTo makes a blocked Special card playable by rewinding 2 shots", () => {
    // Special tier: cooldown=3
    const target = new ShootCard(1, "Target", "desc", "", "Special");
    const rewind = new TimeRewind(2, "Time Rewind", "desc", "");

    target.play(); // marks unready, shotsSinceUse=0
    target.tickShot(); // shotsSinceUse=1
    target.tickShot(); // shotsSinceUse=2 — not ready yet

    expect(target.canPlay()).toBe(false);

    rewind.equipTo(target); // shotsSinceUse advances to 4 >= 3 — ready

    expect(target.canPlay()).toBe(true);
  });

  // SCEN-TIMEREWIND-2
  it("equipTo is a no-op when target timer is already ready", () => {
    // Normal tier: cooldown=0, always ready
    const target = new ShootCard(1, "Target", "desc", "", "Normal");
    const rewind = new TimeRewind(2, "Time Rewind", "desc", "");

    expect(target.canPlay()).toBe(true);

    rewind.equipTo(target); // no-op — timer already ready

    expect(target.canPlay()).toBe(true);
  });

  // SCEN-POWERUP-USED-1
  it("used is true after equipTo and canEquip() returns false", () => {
    const target = new ShootCard(1, "Target", "desc", "", "Normal");
    const rewind = new TimeRewind(2, "Time Rewind", "desc", "");

    expect(rewind.canEquip()).toBe(true);

    rewind.equipTo(target);

    expect(rewind.used).toBe(true);
    expect(rewind.canEquip()).toBe(false);
  });
});
