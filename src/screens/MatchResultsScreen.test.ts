import { describe, it, expect, vi } from "vitest";
import { Container, Text } from "pixi.js";
import {
  MatchResultsScreen,
  setPendingMatchResults,
} from "./MatchResultsScreen.ts";
import type { TournamentMatch } from "../entities/Tournament/TournamentMatch.ts";
import type { WorldCupTeam } from "../entities/Tournament/WorldCupTeam.ts";

const _FS = { h: ["red", "white"] as ["red", "white"] };
const PLAYER_TEAM: WorldCupTeam = { id: "arg", name: "Argentina", power: 90, confederation: "CONMEBOL", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, abbreviation: "ARG", flagSpec: _FS };
const OPP_A: WorldCupTeam = { id: "bra", name: "Brazil", power: 88, confederation: "CONMEBOL", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, abbreviation: "BRA", flagSpec: _FS };
const OPP_B: WorldCupTeam = { id: "fra", name: "France", power: 87, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, abbreviation: "FRA", flagSpec: _FS };
const OPP_C: WorldCupTeam = { id: "ger", name: "Germany", power: 86, confederation: "UEFA", flagUrl: "", strikerColor: 0, goalkeeperColor: 0, abbreviation: "GER", flagSpec: _FS };

function makeMatch(
  id: string,
  home: WorldCupTeam,
  away: WorldCupTeam,
  homeGoals: number | null,
  awayGoals: number | null,
  isPlayerMatch = false,
): TournamentMatch {
  return {
    id, home, away, homeGoals, awayGoals,
    winner: homeGoals === null || awayGoals === null ? null
      : homeGoals > awayGoals ? home
      : awayGoals > homeGoals ? away
      : null,
    phase: "group",
    isPlayerMatch,
  };
}

function findTextInTree(node: Container, needle: string): boolean {
  if (node instanceof Text && node.text.includes(needle)) return true;
  for (const child of node.children) {
    if (child instanceof Container && findTextInTree(child as Container, needle)) return true;
  }
  return false;
}

function makeScreen(overrides?: Partial<Parameters<typeof setPendingMatchResults>[0]>) {
  const onContinue = vi.fn();
  const matchGroups = [
    {
      groupId: "A",
      matches: [
        makeMatch("m1", PLAYER_TEAM, OPP_A, 2, 1, true),
        makeMatch("m2", OPP_B, OPP_C, 1, 1),
      ],
    },
    {
      groupId: "B",
      matches: [
        makeMatch("m3", OPP_A, OPP_B, 0, 3),
        makeMatch("m4", OPP_C, PLAYER_TEAM, 1, 2),
      ],
    },
  ];
  setPendingMatchResults({ matchGroups, playerTeamId: PLAYER_TEAM.id, roundTitle: "MATCHDAY 1", onContinue, ...overrides });
  const screen = new MatchResultsScreen();
  screen.prepare();
  return { screen, onContinue, matchGroups };
}

describe("MatchResultsScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new MatchResultsScreen()).toBeInstanceOf(Container);
  });

  it("constructor is parameterless", () => {
    expect(() => new MatchResultsScreen()).not.toThrow();
  });

  it("prepare() does not throw with valid config", () => {
    expect(() => makeScreen()).not.toThrow();
  });

  it("has children after prepare()", () => {
    const { screen } = makeScreen();
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("SCEN-MRS-RENDER: builds at least bg + header + groups + continue btn", () => {
    const { screen } = makeScreen();
    expect(screen.children.length).toBeGreaterThanOrEqual(4);
  });

  it("SCEN-MRS-PLAYER-HIGHLIGHT: player match rows exist inside group blocks", () => {
    const { screen } = makeScreen();
    // Group blocks are Container children; they contain match rows
    const groupBlocks = screen.children.filter((c) => c instanceof Container) as Container[];
    expect(groupBlocks.length).toBeGreaterThan(0);
    // At least one group block has match-row children
    const hasRows = groupBlocks.some((b) => b.children.length >= 2);
    expect(hasRows).toBe(true);
  });

  it("SCEN-MRS-CONTINUE-BTN: clicking continue container fires onContinue once", () => {
    const { screen, onContinue } = makeScreen();
    const continueBtn = screen.children.find(
      (c) => c instanceof Container && (c as Container).eventMode === "static",
    ) as Container | undefined;
    expect(continueBtn).toBeDefined();
    continueBtn!.emit("pointerdown", {} as never);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("SCEN-MRS-RESET: reset() removes all children", () => {
    const { screen } = makeScreen();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("show() resolves without throwing", async () => {
    const { screen } = makeScreen();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("SCEN-MRS-RESIZE: screen has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const { screen } = makeScreen();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });

  it("prepare() without pending config does not throw", () => {
    const screen = new MatchResultsScreen();
    expect(() => screen.prepare()).not.toThrow();
  });

  it("single-group config renders without throwing", () => {
    expect(() =>
      makeScreen({
        matchGroups: [
          { groupId: "R16", matches: [makeMatch("k1", PLAYER_TEAM, OPP_A, 1, 0, true)] },
        ],
      }),
    ).not.toThrow();
  });

  it("SCEN-MRS-CHAMPION: champion banner appears when champion is set", () => {
    const { screen } = makeScreen({ champion: OPP_B });
    expect(findTextInTree(screen, `CHAMPION: ${OPP_B.name}`)).toBe(true);
  });

  it("SCEN-MRS-NO-CHAMPION: player result banner absent when champion is set", () => {
    const { screen } = makeScreen({ champion: OPP_B });
    expect(findTextInTree(screen, "YOU WIN")).toBe(false);
  });
});
