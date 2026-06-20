import { describe, it, expect } from "vitest";
import { Graphics } from "pixi.js";
import { FlagRenderer, FLAG_COLORS } from "./FlagRenderer.ts";

describe("FLAG_COLORS", () => {
  it("has exactly 15 entries", () => {
    expect(Object.keys(FLAG_COLORS)).toHaveLength(15);
  });

  it("FLAG_COLORS.red equals 0xE23B3B", () => {
    expect(FLAG_COLORS.red).toBe(0xE23B3B);
  });

  it("contains all 15 FlagColor keys", () => {
    const expected = [
      "red", "dred", "white", "blue", "navy",
      "lblue", "sky", "green", "dgreen", "yellow",
      "gold", "black", "orange", "maroon", "brown",
    ];
    for (const key of expected) {
      expect(FLAG_COLORS).toHaveProperty(key);
    }
  });
});

describe("FlagRenderer", () => {
  it("make() returns a Graphics instance", () => {
    const g = FlagRenderer.make({ v: ["red", "white"] }, 90, 60);
    expect(g).toBeInstanceOf(Graphics);
  });

  it("v spec renders without throw for 2+ colors", () => {
    expect(() => FlagRenderer.make({ v: ["red", "white", "red"] }, 90, 60)).not.toThrow();
  });

  it("h spec renders without throw", () => {
    expect(() => FlagRenderer.make({ h: ["black", "red", "gold"] }, 90, 60)).not.toThrow();
  });

  it("bg+cross spec (Nordic) renders without throw", () => {
    expect(() => FlagRenderer.make({ bg: "navy", cross: "white" }, 90, 60)).not.toThrow();
  });

  it("bg+cross+crossInner spec renders without throw", () => {
    expect(() => FlagRenderer.make({ bg: "red", cross: "navy", crossInner: "white" }, 90, 60)).not.toThrow();
  });

  it("bg+disc spec renders without throw", () => {
    expect(() => FlagRenderer.make({ bg: "white", disc: "red" }, 90, 60)).not.toThrow();
  });

  it("bg+emblem spec renders without throw", () => {
    expect(() => FlagRenderer.make({ bg: "red", emblem: "white" }, 90, 60)).not.toThrow();
  });

  it("special spec renders without throw", () => {
    expect(() => FlagRenderer.make({ special: "usa" }, 90, 60)).not.toThrow();
    expect(() => FlagRenderer.make({ special: "rsa" }, 90, 60)).not.toThrow();
    expect(() => FlagRenderer.make({ special: "cze" }, 90, 60)).not.toThrow();
    expect(() => FlagRenderer.make({ special: "pan" }, 90, 60)).not.toThrow();
  });

  it("unknown special does not throw", () => {
    expect(() => FlagRenderer.make({ special: "nonexistent" }, 90, 60)).not.toThrow();
  });

  it("draw() operates on a passed Graphics without throw", () => {
    const g = new Graphics();
    expect(() => FlagRenderer.draw(g, { h: ["red", "white", "blue"] }, 90, 60)).not.toThrow();
  });
});
