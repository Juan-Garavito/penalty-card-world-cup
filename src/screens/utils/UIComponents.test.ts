import { describe, it, expect } from "vitest";
import { Graphics, Text } from "pixi.js";
import { confColor, makeText, drawPixelBorder } from "./UIComponents.ts";

describe("confColor", () => {
  it("returns 0x2F6FE0 for UEFA", () => {
    expect(confColor("UEFA")).toBe(0x2F6FE0);
  });

  it("returns 0xF5C531 for CONMEBOL", () => {
    expect(confColor("CONMEBOL")).toBe(0xF5C531);
  });

  it("returns 0x18A04A for CAF", () => {
    expect(confColor("CAF")).toBe(0x18A04A);
  });

  it("returns 0xE23B3B for AFC", () => {
    expect(confColor("AFC")).toBe(0xE23B3B);
  });

  it("returns 0xE8702A for CONCACAF", () => {
    expect(confColor("CONCACAF")).toBe(0xE8702A);
  });

  it("returns 0x84BDEC for OFC", () => {
    expect(confColor("OFC")).toBe(0x84BDEC);
  });

  it("returns 0x2C4A82 for ALL", () => {
    expect(confColor("ALL")).toBe(0x2C4A82);
  });
});

describe("makeText", () => {
  it("returns a Text instance for title variant", () => {
    const t = makeText("Hello", "title", 24, 0xffffff);
    expect(t).toBeInstanceOf(Text);
  });

  it("returns a Text instance for body variant", () => {
    const t = makeText("Hello", "body", 18, 0xaaaaaa);
    expect(t).toBeInstanceOf(Text);
  });

  it("title variant uses Minecraft font", () => {
    const t = makeText("Title", "title", 24, 0xffffff);
    const family = (t.style as { fontFamily?: string }).fontFamily;
    expect(family).toBe("Minecraft");
  });

  it("body variant uses Minecraft font", () => {
    const t = makeText("Body", "body", 18, 0xffffff);
    const family = (t.style as { fontFamily?: string }).fontFamily;
    expect(family).toBe("Minecraft");
  });
});

describe("drawPixelBorder", () => {
  it("does not throw", () => {
    const g = new Graphics();
    expect(() => drawPixelBorder(g, 10, 10, 200, 60, 0x18A04A)).not.toThrow();
  });
});
