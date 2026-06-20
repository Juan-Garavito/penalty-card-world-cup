import { describe, it, expect } from "vitest";
import { shouldShowRotateOverlay, watchOrientation } from "./orientationGuard.ts";

describe("shouldShowRotateOverlay", () => {
  it("returns true when the media query matches", () => {
    expect(shouldShowRotateOverlay(true)).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    expect(shouldShowRotateOverlay(false)).toBe(false);
  });
});

describe("watchOrientation", () => {
  it("is a no-op when window.matchMedia is unavailable (Node/test env)", () => {
    expect(() => watchOrientation()).not.toThrow();
  });
});
