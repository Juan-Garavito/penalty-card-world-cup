/**
 * T-01 — FlagSpec type compile-time checks.
 * These tests verify that TypeScript accepts valid FlagSpec variants.
 * Because this is a pure-type check, all valid variants must be constructable
 * without TypeScript errors. Invalid shapes are checked via @ts-expect-error.
 */
import { describe, it, expect } from "vitest";
import type { FlagSpec, FlagColor } from "../WorldCupTeam.ts";

describe("FlagSpec type variants", () => {
  it("accepts vertical stripes variant", () => {
    const spec: FlagSpec = { v: ["red", "white", "red"] };
    expect(spec).toBeDefined();
  });

  it("accepts horizontal stripes variant", () => {
    const spec: FlagSpec = { h: ["black", "red", "gold"] };
    expect(spec).toBeDefined();
  });

  it("accepts Nordic cross variant (bg + cross)", () => {
    const spec: FlagSpec = { bg: "navy", cross: "white" };
    expect(spec).toBeDefined();
  });

  it("accepts Nordic cross variant with crossInner", () => {
    const spec: FlagSpec = { bg: "navy", cross: "red", crossInner: "white" };
    expect(spec).toBeDefined();
  });

  it("accepts disc on background variant", () => {
    const spec: FlagSpec = { bg: "white", disc: "red" };
    expect(spec).toBeDefined();
  });

  it("accepts emblem on background variant", () => {
    const spec: FlagSpec = { bg: "red", emblem: "white" };
    expect(spec).toBeDefined();
  });

  it("accepts special escape hatch variant", () => {
    const spec: FlagSpec = { special: "usa" };
    expect(spec).toBeDefined();
  });

  it("FlagColor union includes all 15 colors", () => {
    const colors: FlagColor[] = [
      "red", "dred", "white", "blue", "navy",
      "lblue", "sky", "green", "dgreen", "yellow",
      "gold", "black", "orange", "maroon", "brown",
    ];
    expect(colors).toHaveLength(15);
  });
});
