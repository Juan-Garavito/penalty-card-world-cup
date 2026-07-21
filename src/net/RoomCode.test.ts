import { describe, it, expect } from "vitest";
import { generateRoomCode } from "./RoomCode.ts";

const ALLOWED_CHARS = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");

describe("generateRoomCode", () => {
  it("returns a 6-character code", () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it("every character is in the allowed alphabet (no 0/O/1/I)", () => {
    const code = generateRoomCode();
    for (const char of code) {
      expect(ALLOWED_CHARS.has(char)).toBe(true);
    }
  });

  it("generating many codes does not always produce the same value", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode());
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
