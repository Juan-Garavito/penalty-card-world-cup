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

  it("resize() does not throw", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    expect(() => screen.resize(1280, 720)).not.toThrow();
    expect(() => screen.resize(800, 600)).not.toThrow();
  });

  it("has children after prepare()", () => {
    const screen = new HomeScreen();
    setPendingOnStart(vi.fn());
    screen.prepare();
    expect(screen.children.length).toBeGreaterThan(0);
  });
});
