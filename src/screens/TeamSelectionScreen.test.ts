import { describe, it, expect, vi } from "vitest";
import { Container, Graphics, Text } from "pixi.js";
import {
  TeamSelectionScreen,
  setPendingOnSelect,
} from "./TeamSelectionScreen.ts";
import { WORLD_CUP_2026_TEAMS as TEAMS } from "../entities/Tournament/TeamData.ts";

function makeScreen() {
  const screen = new TeamSelectionScreen();
  const cb = vi.fn();
  setPendingOnSelect(cb);
  screen.prepare();
  return { screen, cb };
}

/** Find a Container by its label property, searching the whole tree. */
function findByLabel(root: Container, label: string): Container | undefined {
  for (const child of root.children) {
    if (!(child instanceof Container)) continue;
    const c = child as Container;
    if ((c as Container & { label?: string }).label === label) return c;
    const found = findByLabel(c, label);
    if (found) return found;
  }
  return undefined;
}

/** Count direct children that are interactive Containers with at least one Graphics child. */
function countGridCells(grid: Container): number {
  let count = 0;
  for (const child of grid.children) {
    if (!(child instanceof Container)) continue;
    const c = child as Container;
    if (c.eventMode === "static" && c.children.some((gc) => gc instanceof Graphics)) {
      count++;
    }
  }
  return count;
}

/** Recursively find a Text node whose text contains `substr`. */
function findTextContaining(container: Container, substr: string): Text | undefined {
  for (const child of container.children) {
    if (child instanceof Text && child.text.includes(substr)) return child;
    if (child instanceof Container) {
      const found = findTextContaining(child as Container, substr);
      if (found) return found;
    }
  }
  return undefined;
}

/** Find a button Container that has a Text child containing `label`. */
function findContainerWithText(container: Container, label: string): Container | undefined {
  for (const child of container.children) {
    if (!(child instanceof Container)) continue;
    const c = child as Container;
    for (const gc of c.children) {
      if (gc instanceof Text && gc.text.includes(label)) return c;
    }
    const found = findContainerWithText(c, label);
    if (found) return found;
  }
  return undefined;
}

describe("TeamSelectionScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new TeamSelectionScreen()).toBeInstanceOf(Container);
  });

  it("constructor is parameterless (BigPool constraint)", () => {
    expect(() => new TeamSelectionScreen()).not.toThrow();
  });

  it("prepare() registers the onSelect callback without throwing", () => {
    const screen = new TeamSelectionScreen();
    const cb = vi.fn();
    setPendingOnSelect(cb);
    expect(() => screen.prepare()).not.toThrow();
  });

  it("reset() removes all children", () => {
    const screen = new TeamSelectionScreen();
    const cb = vi.fn();
    setPendingOnSelect(cb);
    screen.prepare();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("show() resolves without throwing", async () => {
    const screen = new TeamSelectionScreen();
    setPendingOnSelect(vi.fn());
    screen.prepare();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = new TeamSelectionScreen();
    setPendingOnSelect(vi.fn());
    screen.prepare();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });

  it("has children after prepare", () => {
    const screen = new TeamSelectionScreen();
    setPendingOnSelect(vi.fn());
    screen.prepare();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  // ─── T-13: New visual behavior tests ──────────────────────────────────────

  it("T-13: grid renders all 48 team flag cells after prepare", () => {
    const { screen } = makeScreen();
    const grid = findByLabel(screen, "flag-grid");
    expect(grid).toBeDefined();
    const cells = countGridCells(grid!);
    expect(cells).toBe(48);
  });

  it("T-13: clicking UEFA tab reduces visible cells to UEFA team count", () => {
    const { screen } = makeScreen();
    const uefaTeamCount = TEAMS.filter((t) => t.confederation === "UEFA").length;

    // Find UEFA tab label text and trigger its tab click
    const uefaTab = findContainerWithText(screen, "UEFA");
    expect(uefaTab).toBeDefined();

    // Find the actual clickable tab label (direct Text child of tabs container)
    function findUefaTabLabel(container: Container): Text | undefined {
      for (const child of container.children) {
        if (child instanceof Text && child.text === "UEFA") return child;
        if (child instanceof Container) {
          const found = findUefaTabLabel(child as Container);
          if (found) return found;
        }
      }
      return undefined;
    }
    const tabLbl = findUefaTabLabel(screen);
    expect(tabLbl).toBeDefined();
    tabLbl!.emit("pointerdown", {} as never);

    const grid = findByLabel(screen, "flag-grid");
    expect(grid).toBeDefined();
    const cells = countGridCells(grid!);
    expect(cells).toBe(uefaTeamCount);
  });

  it("T-13: clicking a team cell does not throw", () => {
    const { screen } = makeScreen();
    const grid = findByLabel(screen, "flag-grid");
    expect(grid).toBeDefined();
    const firstCell = (grid!.children as Container[]).find(
      (c) => c instanceof Container && c.eventMode === "static",
    ) as Container | undefined;
    expect(firstCell).toBeDefined();
    expect(() => firstCell!.emit("pointerdown", {} as never)).not.toThrow();
  });

  it("T-13: CTA button label contains selected team abbreviation after selecting a team", () => {
    const { screen } = makeScreen();
    const firstTeam = TEAMS[0]; // MEX

    // Click the first grid cell
    const grid = findByLabel(screen, "flag-grid");
    const firstCell = (grid!.children as Container[]).find(
      (c) => c instanceof Container && c.eventMode === "static",
    ) as Container;
    firstCell.emit("pointerdown", {} as never);

    const ctaText = findTextContaining(screen, "PLAY AS");
    expect(ctaText).toBeDefined();
    expect(ctaText!.text).toContain(firstTeam.abbreviation);
  });

  it("T-13: clicking CTA after team selection fires onSelect with team id", () => {
    const { screen, cb } = makeScreen();

    // Click first cell to select first team
    const grid = findByLabel(screen, "flag-grid");
    const firstCell = (grid!.children as Container[]).find(
      (c) => c instanceof Container && c.eventMode === "static",
    ) as Container;
    firstCell.emit("pointerdown", {} as never);

    // Find and click the CTA button
    const cta = findContainerWithText(screen, "PLAY AS");
    expect(cta).toBeDefined();
    cta!.emit("pointerdown", {} as never);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(TEAMS[0].id);
  });
});
