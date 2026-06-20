import { describe, it, expect, vi } from "vitest";
import { Container, Text } from "pixi.js";
import { HomeScreen, setPendingOnStart } from "./HomeScreen.ts";

/** Walk the display tree depth-first and return every Text whose text matches. */
function findTextNodes(root: Container, label: string): Text[] {
  const found: Text[] = [];
  for (const child of root.children) {
    if (child instanceof Text && child.text === label) {
      found.push(child);
    }
    if (child instanceof Container) {
      found.push(...findTextNodes(child, label));
    }
  }
  return found;
}

function makeScreen(onStart = vi.fn()) {
  const screen = new HomeScreen();
  setPendingOnStart(onStart);
  screen.prepare();
  return { screen, onStart };
}

describe("HomeScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new HomeScreen()).toBeInstanceOf(Container);
  });

  it("SCEN-HS-PREPARE: prepare() does not throw", () => {
    expect(() => makeScreen()).not.toThrow();
  });

  it("SCEN-HS-CHILDREN: has children after prepare", () => {
    const { screen } = makeScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-HS-FILTERS: filters property exists after prepare (WebGL optional)", () => {
    const { screen } = makeScreen();
    // filters may be null, undefined, or an array in test environments without WebGL
    expect(screen.filters === null || screen.filters === undefined || Array.isArray(screen.filters)).toBe(true);
  });

  it("SCEN-HS-RESET: reset() removes all children and filters", () => {
    const { screen } = makeScreen();
    screen.reset();
    expect(screen.children.length).toBe(0);
    expect((screen.filters as unknown[]).length).toBe(0);
  });

  it("SCEN-HS-RESIZE: resize() does not throw", () => {
    const { screen } = makeScreen();
    expect(() => screen.resize(1280, 720)).not.toThrow();
    expect(() => screen.resize(1920, 1080)).not.toThrow();
  });

  it("SCEN-HS-SHOW: show() resolves without throwing", async () => {
    const { screen } = makeScreen();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("SCEN-HS-START-CB: pointerup on START TOURNAMENT fires the onStart callback", () => {
    const { screen, onStart } = makeScreen();
    const nodes = findTextNodes(screen, "START TOURNAMENT");
    expect(nodes.length).toBeGreaterThan(0);
    const startNode = nodes[0];
    startNode.emit(
      "pointerup",
      { stopPropagation: vi.fn() } as never,
    );
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("SCEN-HS-CLICK-ANYWHERE: pointerup anywhere on the screen fires the onStart callback", () => {
    const { screen, onStart } = makeScreen();
    expect(screen.eventMode).toBe("static");
    screen.emit("pointerup", {} as never);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
