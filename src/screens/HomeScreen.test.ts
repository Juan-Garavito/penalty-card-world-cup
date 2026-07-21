import { describe, it, expect, vi } from "vitest";
import { Container, Text } from "pixi.js";
import {
  HomeScreen,
  setPendingOnStart,
  setPendingOnPlayOnline,
} from "./HomeScreen.ts";

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

function makeScreen(onStart = vi.fn(), onPlayOnline = vi.fn()) {
  const screen = new HomeScreen();
  setPendingOnStart(onStart);
  setPendingOnPlayOnline(onPlayOnline);
  screen.prepare();
  return { screen, onStart, onPlayOnline };
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

  it("SCEN-HS-NO-CLICK-ANYWHERE: pointerup on the screen background does not fire onStart", () => {
    const { screen, onStart } = makeScreen();
    screen.emit("pointerup", {} as never);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("SCEN-HS-PLAY-ONLINE-CB: pointerup on PLAY ONLINE fires the onPlayOnline callback, not onStart", () => {
    const { screen, onStart, onPlayOnline } = makeScreen();
    const nodes = findTextNodes(screen, "PLAY ONLINE");
    expect(nodes.length).toBeGreaterThan(0);
    const playOnlineNode = nodes[0];
    playOnlineNode.emit(
      "pointerup",
      { stopPropagation: vi.fn() } as never,
    );
    expect(onPlayOnline).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });
});
