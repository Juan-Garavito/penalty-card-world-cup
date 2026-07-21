import { describe, it, expect } from "vitest";
import { normalizeRoomCode } from "./roomCodeInput.ts";

describe("normalizeRoomCode", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeRoomCode("  ABC123  ")).toBe("ABC123");
  });

  it("uppercases lowercase input", () => {
    expect(normalizeRoomCode("abc123")).toBe("ABC123");
  });

  it("leaves an already-normalized code unchanged", () => {
    expect(normalizeRoomCode("XYZ789")).toBe("XYZ789");
  });
});
