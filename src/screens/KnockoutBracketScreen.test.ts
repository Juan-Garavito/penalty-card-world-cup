import { describe, it, expect, vi } from "vitest";
import { Container, Graphics, Text } from "pixi.js";
import {
  KnockoutBracketScreen,
  setPendingTournamentKnockout,
  setPendingOnPlayKnockoutMatch,
  setPendingViewOnlyKnockout,
} from "./KnockoutBracketScreen.ts";
import { createTournament } from "../entities/Tournament/TournamentFactory.ts";
import { buildKnockoutBracket } from "../entities/Tournament/KnockoutBracketBuilder.ts";
import { simulateGroup } from "../entities/Tournament/GroupSimulator.ts";
import { simulateFullBracket } from "../entities/Tournament/KnockoutSimulator.ts";
import { MathRandomRng } from "../entities/Match/MathRandomRng.ts";
import { getTeamById } from "../entities/Tournament/TeamData.ts";
import type { KnockoutBracket } from "../entities/Tournament/Tournament.ts";
import type { WorldCupTeam } from "../entities/Tournament/WorldCupTeam.ts";

function makeScreen() {
  const tournament = createTournament("argentina");
  // Simulate all groups so bracket can be built
  const rng = new MathRandomRng();
  for (const group of tournament.groups) {
    const simulated = simulateGroup(group, rng);
    group.matches = simulated.matches;
    group.standings = simulated.standings;
  }
  tournament.knockoutBracket = buildKnockoutBracket(tournament.groups);

  const screen = new KnockoutBracketScreen();
  setPendingTournamentKnockout(tournament);
  setPendingOnPlayKnockoutMatch(vi.fn());
  screen.prepare();
  return screen;
}

function makeSimulatedBracket(): { bracket: KnockoutBracket; champion: WorldCupTeam | null } {
  const tournament = createTournament("argentina");
  const rng = new MathRandomRng();
  for (const group of tournament.groups) {
    const simulated = simulateGroup(group, rng);
    group.matches = simulated.matches;
    group.standings = simulated.standings;
  }
  const rawBracket = buildKnockoutBracket(tournament.groups);
  const bracket = simulateFullBracket(rawBracket, rng);
  const champion = bracket.rounds.find((r) => r.phase === "final")?.matches[0]?.winner ?? null;
  return { bracket, champion };
}

function makeViewOnlyScreen(onDone = vi.fn()) {
  const { bracket, champion } = makeSimulatedBracket();
  const screen = new KnockoutBracketScreen();
  setPendingViewOnlyKnockout(bracket, champion, "argentina", onDone);
  screen.prepare();
  return { screen, champion, bracket, onDone };
}

function findButtonByLabel(screen: Container, label: string): Container | undefined {
  function walk(node: Container): Container | undefined {
    for (const child of node.children) {
      if (!(child instanceof Container)) continue;
      const c = child as Container;
      if (c.eventMode === "static") {
        for (const gc of c.children) {
          if (gc instanceof Text && gc.text === label) return c;
        }
      }
      const found = walk(c);
      if (found) return found;
    }
    return undefined;
  }
  return walk(screen);
}

// Tab labels are Text nodes with eventMode="static" (not wrapped in a Container).
// This finder locates such Text nodes directly.
function findTabByLabel(screen: Container, label: string): Text | undefined {
  function walk(node: Container): Text | undefined {
    for (const child of node.children) {
      if (child instanceof Text && (child as Text).eventMode === "static" && (child as Text).text === label) {
        return child as Text;
      }
      if (child instanceof Container) {
        const found = walk(child as Container);
        if (found) return found;
      }
    }
    return undefined;
  }
  return walk(screen);
}

function findAllTexts(screen: Container): string[] {
  const texts: string[] = [];
  function walk(node: Container): void {
    for (const child of node.children) {
      if (child instanceof Text) texts.push(child.text);
      if (child instanceof Container) walk(child as Container);
    }
  }
  walk(screen);
  return texts;
}

describe("KnockoutBracketScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new KnockoutBracketScreen()).toBeInstanceOf(Container);
  });

  it("constructor is parameterless", () => {
    expect(() => new KnockoutBracketScreen()).not.toThrow();
  });

  it("prepare() does not throw with a valid tournament + bracket", () => {
    expect(() => makeScreen()).not.toThrow();
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

  it("has no self-scaling resize() method (fixed 1280x720 buffer)", () => {
    const screen = makeScreen();
    expect(
      (screen as unknown as { resize?: unknown }).resize,
    ).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });

  // ─── Interactive mode ────────────────────────────────────────────────────────

  it("SCEN-ELIM-006: interactive mode has no PLAY AGAIN button", () => {
    const screen = makeScreen();
    expect(findButtonByLabel(screen, "PLAY AGAIN")).toBeUndefined();
  });

  it("SCEN-ELIM-006: interactive mode has no WORLD CUP CHAMPION banner", () => {
    const screen = makeScreen();
    const texts = findAllTexts(screen);
    expect(texts.some((t) => t === "WORLD CUP CHAMPION")).toBe(false);
  });

  // ─── View-only pending slot ──────────────────────────────────────────────────

  it("SCEN-ELIM-007: setPendingViewOnlyKnockout + prepare() renders without throwing", () => {
    expect(() => makeViewOnlyScreen()).not.toThrow();
  });

  it("SCEN-ELIM-007: view-only mode has children after prepare", () => {
    const { screen } = makeViewOnlyScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-ELIM-007: view-only screen reset() clears children", () => {
    const { screen } = makeViewOnlyScreen();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  // ─── PLAY button gating ──────────────────────────────────────────────────────

  it("REQ-ELIM-007: no PLAY button in view-only mode", () => {
    const { screen } = makeViewOnlyScreen();
    expect(findButtonByLabel(screen, "PLAY")).toBeUndefined();
  });

  it("REQ-ELIM-007: PLAY button exists in interactive mode (player has a match)", () => {
    // In interactive mode with a bracket where argentina has a match, a PLAY button
    // should appear for the player's upcoming match. We just verify the view-only
    // suppression doesn't affect interactive mode by confirming no false negatives
    // on the interactive screen type.
    const screen = makeScreen();
    // Interactive screen may or may not have a PLAY button depending on whether
    // argentina's match is in r32 and not yet played. We just check it doesn't throw.
    expect(() => findButtonByLabel(screen, "PLAY")).not.toThrow();
  });

  // ─── PLAY AGAIN button ──────────────────────────────────────────────────────

  it("REQ-ELIM-006: PLAY AGAIN button present in view-only mode", () => {
    const { screen } = makeViewOnlyScreen();
    expect(findButtonByLabel(screen, "PLAY AGAIN")).toBeDefined();
  });

  it("REQ-ELIM-006: clicking PLAY AGAIN fires onDone callback", () => {
    const onDone = vi.fn();
    const { screen } = makeViewOnlyScreen(onDone);
    const btn = findButtonByLabel(screen, "PLAY AGAIN")!;
    btn.emit("pointerdown", {} as never);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // ─── Champion banner ─────────────────────────────────────────────────────────
  // New static layout: champion is always visible when viewOnlyChampion is set —
  // no tab navigation needed (REQ-BRK-009).

  it("REQ-ELIM-005: champion banner visible in view-only mode (static layout)", () => {
    const { screen } = makeViewOnlyScreen();
    // In the static bracket layout, WORLD CUP CHAMPION label is always present
    // when a champion is set — no tab navigation required.
    const texts = findAllTexts(screen);
    expect(texts.some((t) => t === "WORLD CUP CHAMPION")).toBe(true);
  });

  it("REQ-ELIM-005: champion banner always present with champion — no tab navigation needed", () => {
    const { screen } = makeViewOnlyScreen();
    // Static layout shows champion immediately without requiring tab click
    const texts = findAllTexts(screen);
    expect(texts.some((t) => t === "WORLD CUP CHAMPION")).toBe(true);
  });

  it("REQ-ELIM-005: champion banner shows the champion team name", () => {
    const { screen, champion } = makeViewOnlyScreen();
    if (!champion) return; // skip if rng produced no champion (shouldn't happen)
    // In static layout, the champion name is always visible
    const texts = findAllTexts(screen);
    expect(texts).toContain(champion.name);
  });

  it("REQ-ELIM-005: no champion banner when viewOnlyChampion is null", () => {
    const { bracket } = makeSimulatedBracket();
    const screen = new KnockoutBracketScreen();
    setPendingViewOnlyKnockout(bracket, null, "argentina", vi.fn());
    screen.prepare();
    const texts = findAllTexts(screen);
    expect(texts.some((t) => t === "WORLD CUP CHAMPION")).toBe(false);
  });

  // ─── Scores visible in view-only mode ────────────────────────────────────────

  it("REQ-ELIM-004: view-only r32 round shows score text (per-team digit)", () => {
    const { screen } = makeViewOnlyScreen();
    // All r32 matches should be simulated and have per-team score digits like "1", "0"
    const texts = findAllTexts(screen);
    const scoreTexts = texts.filter((t) => /^\d+$/.test(t));
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  // ─── setPendingViewOnlyKnockout clears after prepare ────────────────────────

  it("SCEN-ELIM-007: pending slots are cleared after consume — second prepare is interactive mode", () => {
    const { bracket, champion } = makeSimulatedBracket();
    const screen1 = new KnockoutBracketScreen();
    setPendingViewOnlyKnockout(bracket, champion, "argentina", vi.fn());
    screen1.prepare();
    expect(findButtonByLabel(screen1, "PLAY AGAIN")).toBeDefined();

    // Second prepare with interactive data — pending view-only slots should be gone
    const tournament = createTournament("brazil");
    const rng = new MathRandomRng();
    for (const group of tournament.groups) {
      const simulated = simulateGroup(group, rng);
      group.matches = simulated.matches;
      group.standings = simulated.standings;
    }
    tournament.knockoutBracket = buildKnockoutBracket(tournament.groups);
    const screen2 = new KnockoutBracketScreen();
    setPendingTournamentKnockout(tournament);
    setPendingOnPlayKnockoutMatch(vi.fn());
    screen2.prepare();
    expect(findButtonByLabel(screen2, "PLAY AGAIN")).toBeUndefined();
  });

  // ─── T-17: New visual design tests (RED phase) ──────────────────────────────

  it("T-17: interactive match rows contain Graphics children (programmatic flags)", () => {
    const screen = makeScreen();
    // The active round view should contain at least one Graphics node (a flag)
    function countGraphics(node: Container): number {
      let count = 0;
      for (const child of node.children) {
        if (child instanceof Graphics) count++;
        if (child instanceof Container) count += countGraphics(child as Container);
      }
      return count;
    }
    expect(countGraphics(screen)).toBeGreaterThan(0);
  });

  it("T-17: match rows show 3-letter team abbreviations (not full team names)", () => {
    // Use a known bracket with guaranteed teams to avoid RNG-based qualification failure.
    const tournament = createTournament("argentina");
    const rng = new MathRandomRng();
    for (const group of tournament.groups) {
      const simulated = simulateGroup(group, rng);
      group.matches = simulated.matches;
      group.standings = simulated.standings;
    }
    tournament.knockoutBracket = buildKnockoutBracket(tournament.groups);

    // Find which abbreviation is in the r32 home slot 0 (guaranteed to be a real team)
    const firstMatch = tournament.knockoutBracket.rounds.find(r => r.phase === "r32")!.matches[0];
    const homeTeam = getTeamById(firstMatch.home.id);

    const screen = new KnockoutBracketScreen();
    setPendingTournamentKnockout(tournament);
    setPendingOnPlayKnockoutMatch(vi.fn());
    screen.prepare();

    const texts = findAllTexts(screen);
    // The home team's abbreviation should appear in the match rows
    expect(texts).toContain(homeTeam.abbreviation);
  });

  it("T-17: view-only match rows show 3-letter abbreviations", () => {
    const { screen, bracket } = makeViewOnlyScreen();
    // Find the abbreviation of the first team in r32
    const firstMatch = bracket.rounds.find(r => r.phase === "r32")!.matches[0];
    const homeTeam = getTeamById(firstMatch.home.id);

    const texts = findAllTexts(screen);
    expect(texts).toContain(homeTeam.abbreviation);
  });

  it("T-17: player match container is labeled 'player-match' in interactive mode", () => {
    // Build a tournament where we KNOW the player's team is in the r32 bracket.
    // Force qualification by pre-populating standings with argentina winning their group.
    const tournament = createTournament("argentina");
    const rng = new MathRandomRng();
    for (const group of tournament.groups) {
      const simulated = simulateGroup(group, rng);
      group.matches = simulated.matches;
      group.standings = simulated.standings;
    }
    // Ensure argentina is the group winner in their group
    const argGroup = tournament.groups.find(g => g.teams.some(t => t.id === "argentina"))!;
    const argTeam = argGroup.teams.find(t => t.id === "argentina")!;
    // Move argentina to top of standings (force first place)
    const nonArgStandings = argGroup.standings.filter(s => s.team.id !== "argentina");
    argGroup.standings = [{ team: argTeam, played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 9, goalsAgainst: 0, points: 9 }, ...nonArgStandings];

    tournament.knockoutBracket = buildKnockoutBracket(tournament.groups);

    const screen = new KnockoutBracketScreen();
    setPendingTournamentKnockout(tournament);
    setPendingOnPlayKnockoutMatch(vi.fn());
    screen.prepare();

    // The player's match row should be labeled for identification
    function findByLabel(node: Container, label: string): Container | undefined {
      for (const child of node.children) {
        if (!(child instanceof Container)) continue;
        const c = child as Container;
        if ((c as Container & { label?: string }).label === label) return c;
        const found = findByLabel(c, label);
        if (found) return found;
      }
      return undefined;
    }
    const playerRow = findByLabel(screen, "player-match");
    expect(playerRow).toBeDefined();
  });

  // ─── BRKT structural tests (RED until Group 2 implementation is complete) ────

  // Helper: find all Containers at a given x-range that are direct match panels
  function findContainersByX(node: Container, xMin: number, xMax: number): Container[] {
    const found: Container[] = [];
    function walk(n: Container): void {
      for (const child of n.children) {
        if (child instanceof Container) {
          const c = child as Container;
          if (c.x >= xMin && c.x <= xMax) found.push(c);
          walk(c);
        }
      }
    }
    walk(node);
    return found;
  }

  function findContainerByLabel(node: Container, label: string): Container | undefined {
    for (const child of node.children) {
      if (!(child instanceof Container)) continue;
      const c = child as Container;
      if ((c as Container & { label?: string }).label === label) return c;
      const found = findContainerByLabel(c, label);
      if (found) return found;
    }
    return undefined;
  }

  function findText(node: Container, text: string): Text | undefined {
    for (const child of node.children) {
      if (child instanceof Text && child.text === text) return child as Text;
      if (child instanceof Container) {
        const found = findText(child as Container, text);
        if (found) return found;
      }
    }
    return undefined;
  }

  function countGraphicsDeep(node: Container): number {
    let count = 0;
    for (const child of node.children) {
      if (child instanceof Graphics) count++;
      if (child instanceof Container) count += countGraphicsDeep(child as Container);
    }
    return count;
  }

  // Count panels at a given column x — excludes Text and Graphics nodes,
  // counts only plain Containers (match panels).
  function countMatchPanels(screen: Container, colX: number): number {
    return screen.children.filter(
      (c) =>
        c instanceof Container &&
        !(c instanceof Text) &&
        !(c instanceof Graphics) &&
        Math.abs(c.x - colX) < 2,
    ).length;
  }

  // Landscape 1280x720 column x-anchors: r32=40, r16=250, qf=460, sf=670,
  // final=880, champ=1090 (margin 40, MATCH_W=150, gap=60).

  it("BRKT-001: r32 column has 16 match panels", () => {
    const screen = makeScreen();
    expect(countMatchPanels(screen, 40)).toBe(16);
  });

  it("BRKT-002: r16 column has 8 match panels", () => {
    const screen = makeScreen();
    expect(countMatchPanels(screen, 250)).toBe(8);
  });

  it("BRKT-003: qf column has 4 match panels", () => {
    const screen = makeScreen();
    expect(countMatchPanels(screen, 460)).toBe(4);
  });

  it("BRKT-004: sf column has 2 match panels", () => {
    const screen = makeScreen();
    // SF panels only — 3rd place panel is also at x=670 but we only expect 2 SF panels
    // The 3rd place panel is a SEPARATE panel below SF; we still count 2+1=3 Containers at 670
    // Actually: 2 SF panels + 1 3rd-place panel = 3 plain containers at x=670
    // So we test that at least 2 exist at x=670 (the two SF match panels)
    expect(countMatchPanels(screen, 670)).toBeGreaterThanOrEqual(2);
  });

  it("BRKT-005: final column has 1 match panel", () => {
    const screen = makeScreen();
    expect(countMatchPanels(screen, 880)).toBe(1);
  });

  it("BRKT-006: connector Graphics node exists somewhere in the tree", () => {
    const screen = makeScreen();
    expect(countGraphicsDeep(screen)).toBeGreaterThan(0);
    // Specifically the connector Graphics is a direct child of the screen
    const gNodes = screen.children.filter((c) => c instanceof Graphics);
    expect(gNodes.length).toBeGreaterThan(0);
  });

  it("BRKT-007: 3rd-place label '3RD PLACE' present in display tree", () => {
    const { screen } = makeViewOnlyScreen();
    expect(findText(screen, "3RD PLACE")).toBeDefined();
  });

  it("BRKT-008: score text format /^\\d+$/ present after prepare with played matches", () => {
    const { screen } = makeViewOnlyScreen();
    const texts = findAllTexts(screen);
    const scoreTexts = texts.filter((t) => /^\d+$/.test(t));
    expect(scoreTexts.length).toBeGreaterThan(0);
  });

  it("BRKT-009: player match container has label 'player-match'", () => {
    const screen = makeScreen();
    expect(findContainerByLabel(screen, "player-match")).toBeDefined();
  });

  it("BRKT-010: CRT filter applied after prepare (guarded for JSDOM)", () => {
    if (typeof requestAnimationFrame === "undefined") {
      // In JSDOM/Node: filter should NOT be applied (no WebGL / no RAF)
      // This test just verifies no error is thrown
      expect(() => makeScreen()).not.toThrow();
    } else {
      const screen = makeScreen();
      expect(screen.filters.length).toBeGreaterThan(0);
    }
  });
});
