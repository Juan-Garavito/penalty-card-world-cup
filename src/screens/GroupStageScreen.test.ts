import { describe, it, expect, vi } from "vitest";
import { Container, Graphics, Text } from "pixi.js";
import {
  GroupStageScreen,
  setPendingTournament,
  setPendingOnPlayMatch,
  setPendingOnGroupComplete,
  setPendingOnGroupEliminated,
} from "./GroupStageScreen.ts";
import { createTournament } from "../entities/Tournament/TournamentFactory.ts";
import type { TournamentGroup } from "../entities/Tournament/TournamentGroup.ts";

function makeScreen() {
  const screen = new GroupStageScreen();
  const tournament = createTournament("argentina");
  setPendingTournament(tournament);
  setPendingOnPlayMatch(vi.fn());
  setPendingOnGroupComplete(vi.fn());
  setPendingOnGroupEliminated(vi.fn());
  screen.prepare();
  return screen;
}

// Pre-populate all 6 matches in the player's group so _buildButtons runs the
// qualification branch. playerWins=true → argentina finishes 1st (qualified).
// playerWins=false → argentina loses all 3 and finishes 4th (eliminated).
function makeScreenAllMatchesDone(playerWins: boolean) {
  const tournament = createTournament("argentina");
  const group = tournament.groups.find((g) =>
    g.teams.some((t) => t.id === "argentina"),
  )! as TournamentGroup;
  const teams = group.teams;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const id = `${group.id}-${teams[i].id}-vs-${teams[j].id}`;
      const isPlayerMatch = teams[i].id === "argentina" || teams[j].id === "argentina";
      let homeGoals: number, awayGoals: number;
      if (isPlayerMatch) {
        const argHome = teams[i].id === "argentina";
        homeGoals = argHome ? (playerWins ? 3 : 0) : playerWins ? 0 : 3;
        awayGoals = argHome ? (playerWins ? 0 : 3) : playerWins ? 3 : 0;
      } else {
        homeGoals = 1; awayGoals = 0;
      }
      group.matches.push({
        id, home: teams[i], away: teams[j],
        homeGoals, awayGoals,
        winner: homeGoals > awayGoals ? teams[i] : homeGoals < awayGoals ? teams[j] : null,
        phase: "group", isPlayerMatch,
      });
    }
  }

  const onComplete = vi.fn();
  const onEliminated = vi.fn();
  setPendingTournament(tournament);
  setPendingOnPlayMatch(vi.fn());
  setPendingOnGroupComplete(onComplete);
  setPendingOnGroupEliminated(onEliminated);
  const screen = new GroupStageScreen();
  screen.prepare();
  return { screen, onComplete, onEliminated };
}

/**
 * Deep search for a button Container (eventMode=static) that has a direct
 * Text child with exact `label` text.
 */
function findButtonByLabel(root: Container, label: string): Container | undefined {
  for (const child of root.children) {
    if (!(child instanceof Container)) continue;
    const c = child as Container;
    if (c.eventMode === "static") {
      for (const gc of c.children) {
        if (gc instanceof Text && gc.text === label) return c;
      }
    }
    const found = findButtonByLabel(c, label);
    if (found) return found;
  }
  return undefined;
}

/** Find container labeled with the given label property. */
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

/** Find a Text node by its text content, depth-first. */
function findTextByContent(root: Container, text: string): Text | undefined {
  for (const child of root.children) {
    if (child instanceof Text && child.text === text) return child as Text;
    if (child instanceof Container) {
      const found = findTextByContent(child as Container, text);
      if (found) return found;
    }
  }
  return undefined;
}

describe("GroupStageScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new GroupStageScreen()).toBeInstanceOf(Container);
  });

  it("constructor is parameterless", () => {
    expect(() => new GroupStageScreen()).not.toThrow();
  });

  it("prepare() does not throw with valid tournament", () => {
    const screen = new GroupStageScreen();
    setPendingTournament(createTournament("brazil"));
    setPendingOnPlayMatch(vi.fn());
    setPendingOnGroupComplete(vi.fn());
    expect(() => screen.prepare()).not.toThrow();
  });

  it("has children after prepare", () => {
    const screen = makeScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("reset() removes all children", () => {
    const screen = makeScreen();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("show() resolves without throwing", async () => {
    const screen = makeScreen();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = makeScreen();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });

  it("SCEN-ELIM-QUALIFIED: player wins all 3 → CONTINUE TO KNOCKOUT button present, no VIEW BRACKET", () => {
    const { screen } = makeScreenAllMatchesDone(true);
    expect(findButtonByLabel(screen, "CONTINUE TO KNOCKOUT")).toBeDefined();
    expect(findButtonByLabel(screen, "VIEW BRACKET")).toBeUndefined();
  });

  it("SCEN-ELIM-ELIMINATED: player loses all 3 → VIEW BRACKET button present, no CONTINUE TO KNOCKOUT", () => {
    const { screen } = makeScreenAllMatchesDone(false);
    expect(findButtonByLabel(screen, "VIEW BRACKET")).toBeDefined();
    expect(findButtonByLabel(screen, "CONTINUE TO KNOCKOUT")).toBeUndefined();
  });

  it("SCEN-ELIM-CALLBACK-QUALIFIED: clicking CONTINUE TO KNOCKOUT fires onComplete", () => {
    const { screen, onComplete } = makeScreenAllMatchesDone(true);
    const btn = findButtonByLabel(screen, "CONTINUE TO KNOCKOUT")!;
    btn.emit("pointerdown", {} as never);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("SCEN-ELIM-CALLBACK-ELIMINATED: clicking VIEW BRACKET fires onEliminated", () => {
    const { screen, onEliminated } = makeScreenAllMatchesDone(false);
    const btn = findButtonByLabel(screen, "VIEW BRACKET")!;
    btn.emit("pointerdown", {} as never);
    expect(onEliminated).toHaveBeenCalledTimes(1);
  });

  // ─── Group navigation via tabs ──────────────────────────────────────────────

  it("SCEN-NAV-ARROWS: group navigation tabs A–L exist after prepare", () => {
    const screen = makeScreen();
    // New design uses letter tabs — verify 'A' and 'B' tabs exist
    expect(findButtonByLabel(screen, "A")).toBeDefined();
    expect(findButtonByLabel(screen, "B")).toBeDefined();
  });

  it("SCEN-NAV-NEXT: clicking 'B' tab navigates to next group without crashing", () => {
    const screen = makeScreen();
    const bTab = findButtonByLabel(screen, "B")!;
    expect(() => bTab.emit("pointerdown", {} as never)).not.toThrow();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-NAV-PREV: clicking player group tab navigates back without crashing", () => {
    const screen = makeScreen();
    // Navigate to B then back to player group (argentina is in some group)
    findButtonByLabel(screen, "B")!.emit("pointerdown", {} as never);
    const aTab = findButtonByLabel(screen, "A");
    if (aTab) {
      expect(() => aTab.emit("pointerdown", {} as never)).not.toThrow();
    } else {
      // Argentina may not be in group A; try first available tab
      const firstTab = findButtonByLabel(screen, "A") ??
        findButtonByLabel(screen, "B") ??
        findButtonByLabel(screen, "C");
      expect(firstTab).toBeDefined();
      expect(() => firstTab!.emit("pointerdown", {} as never)).not.toThrow();
    }
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-NAV-NO-BUTTONS-OTHER: action buttons absent when viewing non-player group", () => {
    const screen = makeScreen();
    // Argentina is in some group; navigate to a different group using a tab
    // Try tab 'B' — if argentina is not in B, it's a non-player group
    const tournament = createTournament("argentina");
    const playerGroupId = tournament.groups.find((g) =>
      g.teams.some((t) => t.id === "argentina"),
    )!.id;

    // Find a tab that's not the player's group
    const otherGroupId = tournament.groups.find((g) => g.id !== playerGroupId)!.id;
    const otherTab = findButtonByLabel(screen, otherGroupId);
    expect(otherTab).toBeDefined();
    otherTab!.emit("pointerdown", {} as never);

    // Verify no play/continue/eliminated buttons on other groups
    expect(findButtonByLabel(screen, "PLAY NEXT MATCH")).toBeUndefined();
    expect(findButtonByLabel(screen, "CONTINUE TO KNOCKOUT")).toBeUndefined();
    expect(findButtonByLabel(screen, "VIEW BRACKET")).toBeUndefined();
  });

  it("SCEN-NAV-ROUNDTRIP: navigating away and back restores player group view", () => {
    const { screen } = makeScreenAllMatchesDone(true);
    const tournament = createTournament("argentina");
    const playerGroupId = tournament.groups.find((g) =>
      g.teams.some((t) => t.id === "argentina"),
    )!.id;
    const otherGroupId = tournament.groups.find((g) => g.id !== playerGroupId)!.id;

    findButtonByLabel(screen, otherGroupId)!.emit("pointerdown", {} as never); // leave
    findButtonByLabel(screen, playerGroupId)!.emit("pointerdown", {} as never); // come back
    expect(findButtonByLabel(screen, "CONTINUE TO KNOCKOUT")).toBeDefined();
  });

  // ─── T-15: New visual behavior tests ──────────────────────────────────────

  it("T-15: standings rows count equals 4 (one per team in group)", () => {
    const screen = makeScreen();
    // The standings container should have 4 team rows (Containers with children)
    const standings = findByLabel(screen, "standings-rows");
    expect(standings).toBeDefined();
    // Team rows are Containers with children; dividers are Graphics with no children
    const rows = (standings!.children as Container[]).filter(
      (c) => c instanceof Container && c.children.length > 0,
    );
    expect(rows.length).toBe(4);
  });

  it("T-15: each standings row has a Graphics child (flag)", () => {
    const screen = makeScreen();
    const standings = findByLabel(screen, "standings-rows");
    expect(standings).toBeDefined();
    const rows = (standings!.children as Container[]).filter(
      (c) => c instanceof Container && c.children.length > 0,
    );
    for (const row of rows) {
      const hasGraphics = row.children.some((c) => c instanceof Graphics);
      expect(hasGraphics).toBe(true);
    }
  });

  it("T-15: group tab click rebuilds standings for correct group", () => {
    const screen = makeScreen();
    const tournament = createTournament("argentina");
    const otherGroup = tournament.groups.find(
      (g) => !g.teams.some((t) => t.id === "argentina"),
    )!;

    // Click a tab for a group with a different team count (all groups have 4)
    const otherTab = findButtonByLabel(screen, otherGroup.id);
    expect(otherTab).toBeDefined();
    expect(() => otherTab!.emit("pointerdown", {} as never)).not.toThrow();

    // Standings should still show 4 rows (all groups have 4 teams)
    const standings = findByLabel(screen, "standings-rows");
    expect(standings).toBeDefined();
    const rows = (standings!.children as Container[]).filter(
      (c) => c instanceof Container && c.children.length > 0,
    );
    expect(rows.length).toBe(4);
  });

  it("T-15: play-match callback fires with correct team when PLAY NEXT MATCH clicked", () => {
    const onPlayMatch = vi.fn();
    const tournament = createTournament("argentina");
    setPendingTournament(tournament);
    setPendingOnPlayMatch(onPlayMatch);
    setPendingOnGroupComplete(vi.fn());
    setPendingOnGroupEliminated(vi.fn());
    const screen = new GroupStageScreen();
    screen.prepare();

    const btn = findButtonByLabel(screen, "PLAY NEXT MATCH");
    expect(btn).toBeDefined();
    btn!.emit("pointerdown", {} as never);
    expect(onPlayMatch).toHaveBeenCalledTimes(1);
    // The match should involve argentina
    const match = onPlayMatch.mock.calls[0][0];
    expect(
      match.home.id === "argentina" || match.away.id === "argentina",
    ).toBe(true);
  });

  // ─── T-GSR: New redesign tests ────────────────────────────────────────────

  it("T-GSR-1: GROUP STAGE heading text exists after prepare", () => {
    const screen = makeScreen();
    expect(findTextByContent(screen, "GROUP STAGE")).toBeDefined();
  });

  it("T-GSR-2: standings header has PTS column label", () => {
    const screen = makeScreen();
    expect(findTextByContent(screen, "PTS")).toBeDefined();
  });

  it("T-GSR-3: results panel header contains RESULTS text", () => {
    const screen = makeScreen();
    function hasTextContaining(root: Container, substr: string): boolean {
      for (const child of root.children) {
        if (child instanceof Text && child.text.includes(substr)) return true;
        if (child instanceof Container) {
          if (hasTextContaining(child as Container, substr)) return true;
        }
      }
      return false;
    }
    expect(hasTextContaining(screen, "RESULTS")).toBe(true);
  });

  it("T-GSR-4: standings header has P column label", () => {
    const screen = makeScreen();
    expect(findTextByContent(screen, "P")).toBeDefined();
  });

  it("T-GSR-5: standings header has GD column label", () => {
    const screen = makeScreen();
    expect(findTextByContent(screen, "GD")).toBeDefined();
  });
});
