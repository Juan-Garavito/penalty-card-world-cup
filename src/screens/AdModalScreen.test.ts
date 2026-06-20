import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Container } from "pixi.js";
import { AdModalScreen } from "./AdModalScreen.ts";

describe("AdModalScreen — SCEN-AD-MODAL-CONTAINER", () => {
  it("AdModalScreen is a PixiJS Container", () => {
    const modal = new AdModalScreen();
    expect(modal).toBeInstanceOf(Container);
  });
});

describe("AdModalScreen — SCEN-AD-MODAL-RESOLVES", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("promise resolves after 5000ms via advanceTimersByTime", async () => {
    const modal = new AdModalScreen();
    modal.prepare();

    let resolved = false;
    modal.promise.then(() => { resolved = true; });

    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(resolved).toBe(true);
  });
});

describe("AdModalScreen — SCEN-AD-MODAL-CHILDREN", () => {
  it("has at least 1 child after prepare()", () => {
    const modal = new AdModalScreen();
    modal.prepare();
    expect(modal.children.length).toBeGreaterThanOrEqual(1);
  });
});
