import { describe, it, expect, vi } from "vitest";
import { MatchFactory } from "./MatchFactory.ts";
import { HumanPlayer } from "../Players/HumanPlayer.ts";
import { RemotePlayer } from "../Players/RemotePlayer.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { ResolutionOutcome, ResolutionEvidence } from "./ResolutionOutcome.ts";

describe("MatchFactory.build()", () => {
  it("SCEN-FACTORY-RETURNS-SHAPE: returns shootout, humanPlayerId, humanPlayer", () => {
    const result = MatchFactory.build();
    expect(result).toHaveProperty("shootout");
    expect(result).toHaveProperty("humanPlayerId");
    expect(result).toHaveProperty("humanPlayer");
  });

  it("SCEN-FACTORY-HUMAN-ID: humanPlayer.id matches humanPlayerId", () => {
    const { humanPlayer, humanPlayerId } = MatchFactory.build();
    expect(humanPlayer).toBeInstanceOf(HumanPlayer);
    expect(humanPlayer.id).toBe(humanPlayerId);
  });

  it("SCEN-FACTORY-HAND-SIZE striker: exactly 3 ShootCards, 2 active cards, 2 power-up cards", () => {
    const { humanPlayer } = MatchFactory.build();
    const { striker } = humanPlayer;
    expect(striker.shootCards).toHaveLength(3);
    expect(striker.shootCards.every((c) => c instanceof ShootCard)).toBe(true);
    expect(striker.activeCards).toHaveLength(2);
    expect(striker.activeCards.every((c) => c instanceof ActiveCard)).toBe(
      true,
    );
    expect(striker.powerUps).toHaveLength(3);
    expect(striker.powerUps.every((c) => c instanceof PowerUpCard)).toBe(true);
  });

  it("SCEN-FACTORY-HAND-SIZE goalkeeper: exactly 3 SaveCards, 2 active cards, 2 power-up cards", () => {
    const { humanPlayer } = MatchFactory.build();
    const { goalkeeper } = humanPlayer;
    expect(goalkeeper.saveCards).toHaveLength(3);
    expect(goalkeeper.saveCards.every((c) => c instanceof SaveCard)).toBe(true);
    expect(goalkeeper.activeCards).toHaveLength(2);
    expect(goalkeeper.activeCards.every((c) => c instanceof ActiveCard)).toBe(
      true,
    );
    expect(goalkeeper.powerUps).toHaveLength(3);
    expect(goalkeeper.powerUps.every((c) => c instanceof PowerUpCard)).toBe(
      true,
    );
  });

  it("SCEN-FACTORY-CARD-TIERS striker: ShootCards have Normal, Special, Epic tiers", () => {
    const { humanPlayer } = MatchFactory.build();
    const tiers = humanPlayer.striker.shootCards.map((c) => c.tier);
    expect(tiers).toContain("Normal");
    expect(tiers).toContain("Special");
    expect(tiers).toContain("Epic");
  });

  it("SCEN-FACTORY-CARD-TIERS goalkeeper: SaveCards have Normal, Special, Epic tiers", () => {
    const { humanPlayer } = MatchFactory.build();
    const tiers = humanPlayer.goalkeeper.saveCards.map((c) => c.tier);
    expect(tiers).toContain("Normal");
    expect(tiers).toContain("Special");
    expect(tiers).toContain("Epic");
  });

  it("SCEN-FACTORY-CARD-NAMES: all cards have non-empty id, name", () => {
    const { humanPlayer } = MatchFactory.build();
    const allCards = [
      ...humanPlayer.striker.shootCards,
      ...humanPlayer.goalkeeper.saveCards,
      ...humanPlayer.striker.activeCards,
      ...humanPlayer.goalkeeper.activeCards,
      ...humanPlayer.striker.powerUps,
      ...humanPlayer.goalkeeper.powerUps,
    ];
    for (const card of allCards) {
      expect(card.id).toBeGreaterThan(0);
      expect(card.name.length).toBeGreaterThan(0);
    }
  });

  it("SCEN-FACTORY-DETERMINISTIC: build() returns consistent structure on multiple calls", () => {
    const a = MatchFactory.build();
    const b = MatchFactory.build();
    expect(a.humanPlayerId).toBe(b.humanPlayerId);
    expect(a.humanPlayer.striker.shootCards.length).toBe(
      b.humanPlayer.striker.shootCards.length,
    );
  });
});

// ─── T-04: MatchFactory context forwarding (REQ-FORMAT-005) ──────────────────

function makeAllMissResolver(): PenaltyResolver {
  const ev: ResolutionEvidence = {
    kickSide: "left",
    diveSide: "left",
    sidesMatched: true,
    directGoal: false,
    strikerPassiveId: 1,
    goalkeeperPassiveId: 4,
    activesFired: [],
    nullifiedActives: [],
    consumedOnMiss: [],
    finalPGoal: 50,
    roll: 0.6,
    strikerCurrentPower: 0,
    goalkeeperCurrentPower: 0,
  };
  return {
    resolve: vi
      .fn()
      .mockReturnValue({ goal: false, evidence: ev } as ResolutionOutcome),
  } as unknown as PenaltyResolver;
}

describe("MatchFactory.build() — context forwarding (REQ-FORMAT-005)", () => {
  it("SCEN-FACTORY-DEFAULT-KNOCKOUT: build() with no arg defaults to knockout — shootoutPhase is 1 initially", () => {
    const { shootout } = MatchFactory.build(undefined, makeAllMissResolver());
    expect(shootout.shootoutPhase).toBe(1);
  });

  it("SCEN-FACTORY-SHOOTOUT-PHASE-GETTER: shootoutPhase getter exists on shootout returned by build()", () => {
    const { shootout } = MatchFactory.build("group", makeAllMissResolver());
    expect(typeof shootout.shootoutPhase).toBe("number");
    expect(shootout.shootoutPhase).toBe(1);
  });

  it("SCEN-FACTORY-GROUP-CONTEXT-FORWARDED: build('group') returns shootout whose shootoutPhase starts at 1", () => {
    const { shootout } = MatchFactory.build("group", makeAllMissResolver());
    // Phase 1 hasn't started yet — shootoutPhase must be 1
    expect(shootout.shootoutPhase).toBe(1);
  });

  it("SCEN-FACTORY-KNOCKOUT-CONTEXT-FORWARDED: build('knockout') returns shootout whose shootoutPhase starts at 1", () => {
    const { shootout } = MatchFactory.build("knockout", makeAllMissResolver());
    expect(shootout.shootoutPhase).toBe(1);
  });
});

// ─── MatchFactory.buildMultiplayer() (Phase 2: Factory & Network Adapter) ────

function allCardIds(player: HumanPlayer | RemotePlayer): number[] {
  // powerUps are the SAME shared instances on striker and goalkeeper (by
  // design, mirroring MatchFactory.build()) — dedupe via Set.
  const ids = new Set([
    ...player.striker.shootCards.map((c) => c.id),
    ...player.striker.activeCards.map((c) => c.id),
    ...player.striker.powerUps.map((c) => c.id),
    ...player.goalkeeper.saveCards.map((c) => c.id),
    ...player.goalkeeper.activeCards.map((c) => c.id),
    ...player.goalkeeper.powerUps.map((c) => c.id),
  ]);
  return [...ids].sort((a, b) => a - b);
}

describe("MatchFactory.buildMultiplayer()", () => {
  it("SCEN-MP-HOST-SHAPE: role 'host' returns shootout, humanPlayerId, humanPlayer, iaPlayer", () => {
    const result = MatchFactory.buildMultiplayer("host");
    expect(result).toHaveProperty("shootout");
    expect(result).toHaveProperty("humanPlayerId");
    expect(result).toHaveProperty("humanPlayer");
    expect(result).toHaveProperty("iaPlayer");
  });

  it("SCEN-MP-HOST-LOCAL-IS-HUMAN: role 'host' — humanPlayer is a HumanPlayer with catalog ids 1-13", () => {
    const { humanPlayer, humanPlayerId } =
      MatchFactory.buildMultiplayer("host");
    expect(humanPlayer).toBeInstanceOf(HumanPlayer);
    expect(humanPlayer.id).toBe(humanPlayerId);
    expect(allCardIds(humanPlayer)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("SCEN-MP-HOST-OPPONENT-IS-REMOTE: role 'host' — iaPlayer is a RemotePlayer with catalog ids 101-113", () => {
    const { iaPlayer } = MatchFactory.buildMultiplayer("host");
    expect(iaPlayer).toBeInstanceOf(RemotePlayer);
    expect(allCardIds(iaPlayer as RemotePlayer)).toEqual([
      101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
    ]);
  });

  it("SCEN-MP-GUEST-LOCAL-IS-HUMAN: role 'guest' — humanPlayer is a HumanPlayer with catalog ids 101-113", () => {
    const { humanPlayer, humanPlayerId } =
      MatchFactory.buildMultiplayer("guest");
    expect(humanPlayer).toBeInstanceOf(HumanPlayer);
    expect(humanPlayer.id).toBe(humanPlayerId);
    expect(allCardIds(humanPlayer)).toEqual([
      101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
    ]);
  });

  it("SCEN-MP-GUEST-OPPONENT-IS-REMOTE: role 'guest' — iaPlayer is a RemotePlayer with catalog ids 1-13", () => {
    const { iaPlayer } = MatchFactory.buildMultiplayer("guest");
    expect(iaPlayer).toBeInstanceOf(RemotePlayer);
    expect(allCardIds(iaPlayer as RemotePlayer)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("SCEN-MP-CATALOGS-DISJOINT: humanPlayer and iaPlayer card ids never overlap, either role", () => {
    for (const role of ["host", "guest"] as const) {
      const { humanPlayer, iaPlayer } = MatchFactory.buildMultiplayer(role);
      const humanIds = new Set(allCardIds(humanPlayer));
      const opponentIds = allCardIds(iaPlayer as RemotePlayer);
      for (const id of opponentIds) {
        expect(humanIds.has(id)).toBe(false);
      }
    }
  });

  it("SCEN-MP-DETERMINISTIC: two calls with the same role produce identical catalog id sets (fresh instances)", () => {
    const a = MatchFactory.buildMultiplayer("host");
    const b = MatchFactory.buildMultiplayer("host");
    expect(allCardIds(a.humanPlayer)).toEqual(allCardIds(b.humanPlayer));
    expect(allCardIds(a.iaPlayer as RemotePlayer)).toEqual(
      allCardIds(b.iaPlayer as RemotePlayer),
    );
    expect(a.humanPlayer).not.toBe(b.humanPlayer);
  });

  it("SCEN-MP-FIXED-ORDERING: host is always playerA / shooterId, guest always playerB / goalkeeperId, regardless of local role", () => {
    const hostBuild = MatchFactory.buildMultiplayer("host");
    const guestBuild = MatchFactory.buildMultiplayer("guest");
    const hostState = hostBuild.shootout.state as {
      shooterId: string;
      goalkeeperId: string;
    };
    const guestState = guestBuild.shootout.state as {
      shooterId: string;
      goalkeeperId: string;
    };
    expect(hostState.shooterId).toBe(hostBuild.humanPlayerId);
    expect(hostState.goalkeeperId).toBe(hostBuild.iaPlayer.id);
    // Guest client's local shootout must construct with the SAME playerA/playerB
    // ordering (host first) so shooterId/goalkeeperId converge identically —
    // guest's own humanPlayer is playerB (goalkeeperId), not playerA.
    expect(guestState.shooterId).toBe(guestBuild.iaPlayer.id);
    expect(guestState.goalkeeperId).toBe(guestBuild.humanPlayerId);
    expect(hostState.shooterId).toBe(guestState.shooterId);
    expect(hostState.goalkeeperId).toBe(guestState.goalkeeperId);
  });

  it("SCEN-MP-PLAYER-IDS-FIXED: host player id is always 'host-1', guest player id is always 'guest-1'", () => {
    const hostBuild = MatchFactory.buildMultiplayer("host");
    const guestBuild = MatchFactory.buildMultiplayer("guest");
    expect(hostBuild.humanPlayerId).toBe("host-1");
    expect(hostBuild.iaPlayer.id).toBe("guest-1");
    expect(guestBuild.humanPlayerId).toBe("guest-1");
    expect(guestBuild.iaPlayer.id).toBe("host-1");
  });
});
