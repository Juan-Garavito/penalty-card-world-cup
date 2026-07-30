import { describe, it, expect } from "vitest";
import { Container } from "pixi.js";
import { SettingsScreen } from "./SettingsScreen.ts";

function makeScreen() {
  const screen = new SettingsScreen();
  screen.prepare();
  return screen;
}

describe("SettingsScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new SettingsScreen()).toBeInstanceOf(Container);
  });

  it("SCEN-SET-PREPARE: prepare() does not throw and produces children", () => {
    const screen = makeScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-SET-RESET: reset() removes all children", () => {
    const screen = makeScreen();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("SCEN-SET-RESIZE: screen has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = makeScreen();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });
});
