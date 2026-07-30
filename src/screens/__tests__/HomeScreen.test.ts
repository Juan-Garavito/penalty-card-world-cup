import { describe, it, expect, vi } from "vitest";
import { Container } from "pixi.js";
import { HomeScreen, setPendingOnStart } from "../HomeScreen.ts";

describe("HomeScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new HomeScreen()).toBeInstanceOf(Container);
  });

  it("constructor is parameterless", () => {
    expect(() => new HomeScreen()).not.toThrow();
  });

  it("prepare() does not throw", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    expect(() => screen.prepare()).not.toThrow();
  });

  it("reset() removes all children", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("show() resolves without throwing", async () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("hide() resolves without throwing", async () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    await expect(screen.hide()).resolves.toBeUndefined();
  });

  it("has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });

  it("has children after prepare()", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    expect(screen.children.length).toBeGreaterThan(0);
  });
});
