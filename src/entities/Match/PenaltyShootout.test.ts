import { describe, it, expect, vi } from "vitest";
import { PenaltyShootout } from "./PenaltyShootout.ts";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { ResolutionOutcome, ResolutionEvidence } from "./ResolutionOutcome.ts";
import { IPlayer } from "../Players/IPlayer.ts";
import { PlayerCards } from "./PlayerCards.ts";
import { PlayerDecision } from "../Players/PlayerDecision.ts";
import { MatchAlreadyOverError } from "./errors/MatchAlreadyOverError.ts";
import { InvalidTransitionError } from "./errors/InvalidTransitionError.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { IAPlayer } from "../Players/IAPlayer.ts";
import { HumanPlayer } from "../Players/HumanPlayer.ts";
import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { Striker } from "../Footballers/Striker.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { makeIAStrategyMock } from "../Players/__test-helpers__/makeIAStrategyMock.ts";

// ─── Stub helpers ────────────────────────────────────────────────────────────

function stubCard(): ShootCard {
  return new ShootCard(1, "Stub", "desc", "", "Normal");
}

function stubEvidence(): ResolutionEvidence {
  return {
    kickSide: "left",
    diveSide: "left",
    sidesMatched: true,
    directGoal: false,
    strikerPassiveId: 1,
    goalkeeperPassiveId: 1,
    activesFired: [],
    nullifiedActives: [],
    consumedOnMiss: [],
    finalPGoal: 50,
    roll: 0.4,
    strikerCurrentPower: 0,
    goalkeeperCurrentPower: 0,
  };
}

// REQ-INTEGRATION-004: stub resolver cycling through goals[]
function makeStubResolver(goals: boolean[]): PenaltyResolver {
  let index = 0;
  return {
    resolve: vi.fn().mockImplementation(
      (): ResolutionOutcome => ({
        goal: goals[index++] ?? false,
        evidence: stubEvidence(),
      }),
    ),
  } as unknown as PenaltyResolver;
}

function makePlayer(id: string): IPlayer {
  return { id, decide: vi.fn(), resetForNewMatch: vi.fn() };
}

function makeShootCard(): ShootCard {
  const card = new ShootCard(1, "Shoot", "desc", "", "Normal");
  vi.spyOn(card, "tickShot");
  vi.spyOn(card, "resetTurn");
  return card;
}

function makeSaveCard(): SaveCard {
  const card = new SaveCard(1, "Save", "desc", "", "Normal");
  vi.spyOn(card, "tickShot");
  vi.spyOn(card, "resetTurn");
  return card;
}

function makeCards(): PlayerCards {
  return { shootCards: [], saveCards: [] };
}

// REQ-INTEGRATION-004: updated makeMatch — stubs decide(), injects resolver
function makeMatch(
  goals: boolean[] = [],
  playerACards: PlayerCards = makeCards(),
  playerBCards: PlayerCards = makeCards(),
): {
  match: PenaltyShootout;
  pA: IPlayer;
  pB: IPlayer;
  resolver: PenaltyResolver;
} {
  const pA = makePlayer("pA");
  const pB = makePlayer("pB");
  const decision: PlayerDecision = { chosenCard: stubCard(), side: "center" };
  vi.mocked(pA.decide).mockReturnValue(decision);
  vi.mocked(pB.decide).mockReturnValue(decision);
  const resolver = makeStubResolver(goals);
  const match = new PenaltyShootout(pA, pB, playerACards, playerBCards, {
    resolver,
  });
  return { match, pA, pB, resolver };
}

// REQ-INTEGRATION-004: updated runTurns — just calls advance() N times (count, not outcomes[])
// The outcomes are now controlled by the stub resolver in makeMatch
function runTurns(match: PenaltyShootout, count: number): void {
  for (let i = 0; i < count; i++) match.advance();
}

// ─── Task 5.4 — SCEN-INTEGRATION-001: Constructor test ──────────────────────

describe("PenaltyShootout — constructor accepts resolver (SCEN-INTEGRATION-001)", () => {
  it("constructs with explicit resolver injected via options", () => {
    const pA = makePlayer("pA");
    const pB = makePlayer("pB");
    const resolver = makeStubResolver([true]);
    // REQ-INTEGRATION-001: must compile and not throw
    expect(
      () => new PenaltyShootout(pA, pB, makeCards(), makeCards(), { resolver }),
    ).not.toThrow();
  });

  it("constructs without options (uses internal default resolver)", () => {
    const pA = makePlayer("pA");
    const pB = makePlayer("pB");
    // REQ-INTEGRATION-001 (Decision 5): backward-compatible — no options
    expect(
      () => new PenaltyShootout(pA, pB, makeCards(), makeCards()),
    ).not.toThrow();
  });
});

// ─── Task 5.5 — SCEN-INTEGRATION-FULLTURN: advance() full turn ──────────────

describe("PenaltyShootout — advance() drives full turn cycle (SCEN-INTEGRATION-FULLTURN)", () => {
  it("calls decide() on both players exactly once per advance()", () => {
    const { match, pA, pB } = makeMatch([true]);

    match.advance();

    expect(pA.decide).toHaveBeenCalledTimes(1);
    expect(pB.decide).toHaveBeenCalledTimes(1);
  });

  it("calls resolver.resolve() exactly once per advance()", () => {
    const { match, resolver } = makeMatch([true]);

    match.advance();

    expect(resolver.resolve).toHaveBeenCalledTimes(1);
  });

  it("phase returns to WaitingForDecisions after advance() with goal=true", () => {
    const { match } = makeMatch([true]);

    match.advance();

    expect(match.state.phase).toBe("WaitingForDecisions");
  });

  it("shooter score increments when advance() goal is true", () => {
    const { match } = makeMatch([true]);

    match.advance();

    expect(match.score.playerA).toBe(1);
    expect(match.score.playerB).toBe(0);
  });

  it("turnNumber increments after advance()", () => {
    const { match } = makeMatch([false]);
    expect(match.turnNumber).toBe(1);

    match.advance();

    expect(match.turnNumber).toBe(2);
  });
});

// ─── Task 5.6 — SCEN-INTEGRATION-003: lastOutcome getter ────────────────────

describe("PenaltyShootout — lastOutcome (SCEN-INTEGRATION-003)", () => {
  it("lastOutcome is null/undefined before any advance()", () => {
    const pA = makePlayer("pA");
    const pB = makePlayer("pB");
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());

    expect(match.lastOutcome == null).toBe(true);
  });

  it("lastOutcome matches the resolver's returned ResolutionOutcome after advance()", () => {
    const { match, resolver } = makeMatch([true]);

    match.advance();

    const lastCall = vi.mocked(resolver.resolve).mock.results[0]
      .value as ResolutionOutcome;
    expect(match.lastOutcome).toEqual(lastCall);
  });
});

// ─── Task 5.7 — SCEN-INTEGRATION-MIGRATION / SCEN-PD-EXT-001 ─────────────────

describe("PenaltyShootout — backward compat: submitTurnOutcome public (SCEN-INTEGRATION-MIGRATION)", () => {
  it("submitTurnOutcome still throws InvalidTransitionError when called without advance()", () => {
    const { match } = makeMatch([]);

    // State is WaitingForDecisions — submitTurnOutcome directly should throw
    expect(() => match.submitTurnOutcome({ goal: true })).toThrowError(
      InvalidTransitionError,
    );
  });

  it("submitTurnOutcome still throws MatchAlreadyOverError when match is GameOver", () => {
    // Drive to GameOver: pA scores 3, pB misses 3 (triggers early win after turn 6)
    const { match } = makeMatch([true, false, true, false, true, false]);
    runTurns(match, 6);

    expect(match.state.phase).toBe("GameOver");
    expect(() => match.submitTurnOutcome({ goal: true })).toThrowError(
      MatchAlreadyOverError,
    );
  });
});

describe("PenaltyShootout — SCEN-PD-EXT-001: v1 PlayerDecision (chosenCard only) works", () => {
  it("advance() works when decide() returns PlayerDecision without activePlayed", () => {
    const pA = makePlayer("pA");
    const pB = makePlayer("pB");
    // v1 style: only chosenCard, no activePlayed
    // v2→v3: activePlayed remains optional (purpose of test); side is now required
    const v1Decision: PlayerDecision = {
      chosenCard: stubCard(),
      side: "center",
    };
    vi.mocked(pA.decide).mockReturnValue(v1Decision);
    vi.mocked(pB.decide).mockReturnValue(v1Decision);
    const resolver = makeStubResolver([false]);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards(), {
      resolver,
    });

    expect(() => match.advance()).not.toThrow();
    expect(match.state.phase).toBe("WaitingForDecisions");
  });
});

// ─── TASK-012: SCEN-MATCH-01 — Initial state ────────────────────────────────

describe("PenaltyShootout — construction (SCEN-MATCH-01)", () => {
  it("initial state has WaitingForDecisions phase, correct shooter/goalkeeper, score 0-0, turn 1", () => {
    const { match, pA, pB } = makeMatch();

    expect(match.state.phase).toBe("WaitingForDecisions");
    if (match.state.phase === "WaitingForDecisions") {
      expect(match.state.shooterId).toBe(pA.id);
      expect(match.state.goalkeeperId).toBe(pB.id);
    }
    expect(match.score).toEqual({ playerA: 0, playerB: 0 });
    expect(match.turnNumber).toBe(1);
  });
});

// ─── TASK-013: SCEN-MATCH-02, 03, 04, 05 ────────────────────────────────────

describe("PenaltyShootout — role alternation (SCEN-MATCH-02)", () => {
  it("after first turn pB becomes shooter and pA becomes goalkeeper", () => {
    const { match, pA, pB } = makeMatch([false]);

    match.advance();

    expect(match.state.phase).toBe("WaitingForDecisions");
    if (match.state.phase === "WaitingForDecisions") {
      expect(match.state.shooterId).toBe(pB.id);
      expect(match.state.goalkeeperId).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — score tracking (SCEN-MATCH-03)", () => {
  it("goal increments shooter (playerA) score", () => {
    const { match } = makeMatch([true]);

    match.advance();

    expect(match.score.playerA).toBe(1);
    expect(match.score.playerB).toBe(0);
  });
});

describe("PenaltyShootout — score tracking (SCEN-MATCH-04)", () => {
  it("miss does not change score", () => {
    const { match } = makeMatch([false]);

    match.advance();

    expect(match.score.playerA).toBe(0);
    expect(match.score.playerB).toBe(0);
  });
});

describe("PenaltyShootout — turn counter (SCEN-MATCH-05)", () => {
  it("turnNumber increments after each advance()", () => {
    const { match } = makeMatch([false, false]);

    expect(match.turnNumber).toBe(1);
    match.advance();
    expect(match.turnNumber).toBe(2);
  });
});

// ─── TASK-014: SCEN-MATCH-13, 14 ─────────────────────────────────────────────

describe("PenaltyShootout — error: MatchAlreadyOverError (SCEN-MATCH-13)", () => {
  it("throws MatchAlreadyOverError when submitTurnOutcome called on GameOver match", () => {
    // Drive to GameOver via early win after turn 6 (pA=3, pB=0, pBKicksLeft=2 → 3>0+2)
    const { match } = makeMatch([true, false, true, false, true, false]);
    runTurns(match, 6);

    expect(match.state.phase).toBe("GameOver");
    expect(() => match.submitTurnOutcome({ goal: true })).toThrowError(
      MatchAlreadyOverError,
    );
  });
});

describe("PenaltyShootout — error: InvalidTransitionError (SCEN-MATCH-14)", () => {
  it("throws InvalidTransitionError when submitTurnOutcome called without advance()", () => {
    const { match } = makeMatch([]);

    // State is WaitingForDecisions, not ResolvingShot
    expect(() => match.submitTurnOutcome({ goal: true })).toThrowError(
      InvalidTransitionError,
    );
  });
});

// ─── TASK-015: SCEN-MATCH-06, 07 ─────────────────────────────────────────────

describe("PenaltyShootout — best-of-5 win after 10 turns (SCEN-MATCH-06)", () => {
  it("GameOver with winner after 10 turns when one player has more goals", () => {
    const { match, pA } = makeMatch([
      true, // turn 1: pA scores → pA=1
      true, // turn 2: pB scores → pB=1
      true, // turn 3: pA scores → pA=2
      true, // turn 4: pB scores → pB=2
      true, // turn 5: pA scores → pA=3
      false, // turn 6: pB misses → pB=2
      false, // turn 7: pA misses → pA=3
      false, // turn 8: pB misses → pB=2
      false, // turn 9: pA misses → pA=3
      false, // turn 10: pB misses → pB=2
    ]);

    runTurns(match, 10);

    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — early win detection (SCEN-MATCH-07)", () => {
  it("GameOver immediately when leader's advantage is mathematically unreachable", () => {
    const { match, pA } = makeMatch([
      true, // turn 1: pA=1
      false, // turn 2: pB=0
      true, // turn 3: pA=2
      false, // turn 4: pB=0
      true, // turn 5: pA=3
      false, // turn 6: pB=0 → GameOver (3>0+2)
    ]);

    runTurns(match, 6);

    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

// ─── TASK-016: SCEN-MATCH-08, 09, 10 ─────────────────────────────────────────

describe("PenaltyShootout — sudden death after tie (SCEN-MATCH-08)", () => {
  it("transitions to SuddenDeath when score is tied after 20 turns (Phase 1 + Phase 2)", () => {
    // Phase 1: 10 tied kicks
    // Phase 2: 10 tied kicks → SuddenDeath (default context=knockout)
    const { match } = makeMatch([
      true, // turn 1: pA=1
      true, // turn 2: pB=1
      true, // turn 3: pA=2
      true, // turn 4: pB=2
      true, // turn 5: pA=3
      true, // turn 6: pB=3
      false, // turn 7: pA misses
      false, // turn 8: pB misses
      false, // turn 9: pA misses
      false, // turn 10: pB misses → Phase 1 tied → Phase 2
      true,  // turn 11: pA=4
      true,  // turn 12: pB=4
      false, // turn 13: pA misses
      false, // turn 14: pB misses
      false, // turn 15: pA misses
      false, // turn 16: pB misses
      false, // turn 17: pA misses
      false, // turn 18: pB misses
      false, // turn 19: pA misses
      false, // turn 20: pB misses → Phase 2 tied → SuddenDeath
    ]);

    runTurns(match, 20);

    expect(match.state.phase).toBe("SuddenDeath");
  });
});

describe("PenaltyShootout — sudden death winner (SCEN-MATCH-09)", () => {
  it("GameOver when pA scores and pB misses in a SD pair", () => {
    const { match, pA } = makeMatch([
      // Phase 1: 10 tied kicks
      true, true, true, true, true, true, false, false, false, false,
      // Phase 2: 10 tied kicks
      true, true, false, false, false, false, false, false, false, false,
      // SD round:
      true,  // pA scores in SD
      false, // pB misses in SD
    ]);

    runTurns(match, 20);
    expect(match.state.phase).toBe("SuddenDeath");

    runTurns(match, 2); // SD pair

    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — sudden death continues on double miss (SCEN-MATCH-10)", () => {
  it("SuddenDeath continues when both players miss their SD kick", () => {
    const { match } = makeMatch([
      // Phase 1: 10 tied kicks
      true, true, true, true, true, true, false, false, false, false,
      // Phase 2: 10 tied kicks
      true, true, false, false, false, false, false, false, false, false,
      // SD round 1:
      false, // pA misses
      false, // pB misses
    ]);

    runTurns(match, 20);
    expect(match.state.phase).toBe("SuddenDeath");

    runTurns(match, 2);

    expect(match.state.phase).toBe("SuddenDeath");
    if (match.state.phase === "SuddenDeath") {
      expect(match.state.sdRound).toBeGreaterThan(1);
    }
  });
});

// ─── TASK-017: SCEN-MATCH-11, 12 ─────────────────────────────────────────────

describe("PenaltyShootout — card lifecycle: tickShot (SCEN-MATCH-11)", () => {
  it("advance() calls tickShot() on all PassiveCards of both players", () => {
    const pAShoot = makeShootCard();
    const pASave = makeSaveCard();
    const pBShoot = makeShootCard();
    const pBSave = makeSaveCard();

    const pACards: PlayerCards = { shootCards: [pAShoot], saveCards: [pASave] };
    const pBCards: PlayerCards = { shootCards: [pBShoot], saveCards: [pBSave] };

    const { match } = makeMatch([false], pACards, pBCards);
    match.advance();

    expect(pAShoot.tickShot).toHaveBeenCalledTimes(1);
    expect(pASave.tickShot).toHaveBeenCalledTimes(1);
    expect(pBShoot.tickShot).toHaveBeenCalledTimes(1);
    expect(pBSave.tickShot).toHaveBeenCalledTimes(1);
  });
});

// SCEN-INTEGRATION-FULL-MATCH-RESET — Domain 6 integration scenario
describe("PenaltyShootout — full match lifecycle: resetForNewMatch restores active cards (SCEN-INTEGRATION-FULL-MATCH-RESET)", () => {
  it("all active cards are reset to canActivate()=true after resetForNewMatch() on both real players", () => {
    // Construct real IAPlayer and HumanPlayer with 2 active cards each
    const iaStrikerCard = new CheatingCard(1, "Cheat1", "desc", "");
    const iaGkCard = new IntimidateCard(2, "Intimidate2", "desc", "");
    const humanStrikerCard = new CheatingCard(3, "Cheat3", "desc", "");
    const humanGkCard = new IntimidateCard(4, "Intimidate4", "desc", "");

    // Activate all 4 cards (simulating a match in progress)
    iaStrikerCard.activate();
    iaGkCard.activate();
    humanStrikerCard.activate();
    humanGkCard.activate();

    expect(iaStrikerCard.canActivate()).toBe(false);
    expect(iaGkCard.canActivate()).toBe(false);
    expect(humanStrikerCard.canActivate()).toBe(false);
    expect(humanGkCard.canActivate()).toBe(false);

    const iaStrategy = makeIAStrategyMock({
      pick: vi.fn(() => stubCard()),
      pickActive: vi.fn(() => undefined),
    });
    const iaPlayer = new IAPlayer(
      "ia",
      new Goalkeeper([], [iaGkCard]),
      new Striker([], [iaStrikerCard]),
      iaStrategy,
    );
    const humanPlayer = new HumanPlayer(
      "human",
      new Goalkeeper([], [humanGkCard]),
      new Striker([], [humanStrikerCard]),
    );

    // Reset both players for a new match
    iaPlayer.resetForNewMatch();
    humanPlayer.resetForNewMatch();

    // All 4 active cards must now be activatable
    expect(iaStrikerCard.canActivate()).toBe(true);
    expect(iaGkCard.canActivate()).toBe(true);
    expect(humanStrikerCard.canActivate()).toBe(true);
    expect(humanGkCard.canActivate()).toBe(true);

    // Verify IAPlayer.decide() includes reset cards in candidate pool
    const decision = iaPlayer.decide({
      turnNumber: 1,
      role: "shooter",
      availableCards: [stubCard()],
    });
    // pickActive should have been called with the now-fresh striker card
    expect(iaStrategy.pickActive).toHaveBeenCalledWith("shooter", [
      iaStrikerCard,
    ]);
    expect(decision).toBeDefined();
  });
});

// ─── T-02: Phase 2 + draw behaviour (draw-format) ─────────────────────────────

function makeMatchWithContext(
  goals: boolean[] = [],
  context?: "group" | "knockout",
): {
  match: PenaltyShootout;
  pA: IPlayer;
  pB: IPlayer;
} {
  const pA = makePlayer("pA");
  const pB = makePlayer("pB");
  const decision: PlayerDecision = { chosenCard: stubCard(), side: "center" };
  vi.mocked(pA.decide).mockReturnValue(decision);
  vi.mocked(pB.decide).mockReturnValue(decision);
  const resolver = makeStubResolver(goals);
  const match = new PenaltyShootout(pA, pB, makeCards(), makeCards(), {
    resolver,
    ...(context !== undefined ? { context } : {}),
  });
  return { match, pA, pB };
}

describe("PenaltyShootout — Phase 2 entry after 10 tied kicks (REQ-FORMAT-001)", () => {
  it("after 10 tied kicks shootoutPhase === 2 and state is still WaitingForDecisions", () => {
    // 10 kicks: all miss — scores stay 0-0, should enter Phase 2
    const { match } = makeMatchWithContext(Array(20).fill(false), "knockout");
    runTurns(match, 10);
    expect(match.shootoutPhase).toBe(2);
    expect(match.state.phase).toBe("WaitingForDecisions");
  });
});

describe("PenaltyShootout — Group draw after 20 tied kicks (REQ-FORMAT-003)", () => {
  it("context=group: 20 tied kicks produces GameOver with winner === null", () => {
    const { match } = makeMatchWithContext(Array(20).fill(false), "group");
    runTurns(match, 20);
    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBeNull();
    }
  });
});

describe("PenaltyShootout — Group Phase 2 pair-based: win after pair 1 (REQ-FORMAT-003)", () => {
  it("context=group: pA scores pair-1 kick, pB misses → pA wins after turn 12 (not turn 16)", () => {
    // Phase 2 order: A kicks first (turn 11), B kicks second (turn 12).
    // Pair 1 ends at turn 12 — if there is a score difference, the leader wins immediately.
    const goals = [
      ...Array(10).fill(false), // Phase 1: all miss → tied, enter Phase 2
      true,  // turn 11: pA scores → pA=1, pB=0 (pair incomplete)
      false, // turn 12: pB misses → pair 1 done: pA=1, pB=0 → pA wins NOW
    ];
    const { match, pA } = makeMatchWithContext(goals, "group");
    runTurns(match, 12);
    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — Group Phase 2 pair-based: win after pair 2 (REQ-FORMAT-003)", () => {
  it("context=group: pair 1 tied, pair 2 decisive → winner at turn 14", () => {
    const goals = [
      ...Array(10).fill(false), // Phase 1: all miss
      true,  // turn 11: pA scores → pA=1
      true,  // turn 12: pB scores → pair 1 tied (1-1) → continue
      true,  // turn 13: pA scores → pA=2
      false, // turn 14: pB misses → pair 2 done: pA=2, pB=1 → pA wins
    ];
    const { match, pA } = makeMatchWithContext(goals, "group");
    runTurns(match, 14);
    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — Group Phase 2 pair-based: win after pair 3 (REQ-FORMAT-003)", () => {
  it("context=group: 2 tied pairs then decisive pair 3 → winner at turn 16", () => {
    const goals = [
      ...Array(10).fill(false), // Phase 1: all miss
      false, false, // pair 1: both miss → tied
      true,  true,  // pair 2: both score → tied
      false, true,  // pair 3: pA misses, pB scores → pB wins at turn 16
    ];
    const { match, pB } = makeMatchWithContext(goals, "group");
    runTurns(match, 16);
    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe(pB.id);
    }
  });
});

describe("PenaltyShootout — Knockout Phase 2 tied transitions to SuddenDeath (REQ-FORMAT-004)", () => {
  it("context=knockout: 20 tied kicks → SuddenDeath (not GameOver)", () => {
    const { match } = makeMatchWithContext(Array(20).fill(false), "knockout");
    runTurns(match, 20);
    expect(match.state.phase).toBe("SuddenDeath");
  });
});

describe("PenaltyShootout — Knockout never emits draw (REQ-FORMAT-004)", () => {
  it("context=knockout: full SD resolution produces non-null winner", () => {
    const goals = [
      ...Array(20).fill(false),
      // SD pair: pA scores, pB misses
      true, false,
    ];
    const { match, pA } = makeMatchWithContext(goals, "knockout");
    runTurns(match, 22);
    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).not.toBeNull();
      expect(match.state.winner).toBe(pA.id);
    }
  });
});

describe("PenaltyShootout — card lifecycle: resetTurn (SCEN-MATCH-12)", () => {
  it("advance() calls resetTurn() on all PassiveCards of both players", () => {
    const pAShoot = makeShootCard();
    const pASave = makeSaveCard();
    const pBShoot = makeShootCard();
    const pBSave = makeSaveCard();

    const pACards: PlayerCards = { shootCards: [pAShoot], saveCards: [pASave] };
    const pBCards: PlayerCards = { shootCards: [pBShoot], saveCards: [pBSave] };

    const { match } = makeMatch([false], pACards, pBCards);
    match.advance(); // advance() now calls submitTurnOutcome internally → resetTurn fires

    expect(pAShoot.resetTurn).toHaveBeenCalledTimes(1);
    expect(pASave.resetTurn).toHaveBeenCalledTimes(1);
    expect(pBShoot.resetTurn).toHaveBeenCalledTimes(1);
    expect(pBSave.resetTurn).toHaveBeenCalledTimes(1);
  });
});

// ─── Phase 1 (add-multiplayer-mode) — applyRemoteOutcome ────────────────────
// REQ: Additive applyRemoteOutcome on guest — applies a host-resolved turn's
// score/turn/phase WITHOUT calling advance() or PenaltyResolver.

describe("PenaltyShootout.applyRemoteOutcome — guest applies host-resolved outcome (SCEN-REMOTE-OUTCOME)", () => {
  it("never calls decide() on either player", () => {
    const { match, pA, pB } = makeMatch([]);
    const outcome: ResolutionOutcome = { goal: true, evidence: stubEvidence() };

    match.applyRemoteOutcome(outcome);

    expect(pA.decide).not.toHaveBeenCalled();
    expect(pB.decide).not.toHaveBeenCalled();
  });

  it("never calls resolver.resolve()", () => {
    const { match, resolver } = makeMatch([]);
    const outcome: ResolutionOutcome = { goal: true, evidence: stubEvidence() };

    match.applyRemoteOutcome(outcome);

    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it("shooter score increments when outcome.goal is true", () => {
    const { match } = makeMatch([]);
    const outcome: ResolutionOutcome = { goal: true, evidence: stubEvidence() };

    match.applyRemoteOutcome(outcome);

    expect(match.score.playerA).toBe(1);
    expect(match.score.playerB).toBe(0);
  });

  it("score unchanged when outcome.goal is false", () => {
    const { match } = makeMatch([]);
    const outcome: ResolutionOutcome = {
      goal: false,
      evidence: stubEvidence(),
    };

    match.applyRemoteOutcome(outcome);

    expect(match.score.playerA).toBe(0);
    expect(match.score.playerB).toBe(0);
  });

  it("turnNumber increments after applyRemoteOutcome()", () => {
    const { match } = makeMatch([]);
    expect(match.turnNumber).toBe(1);
    const outcome: ResolutionOutcome = {
      goal: false,
      evidence: stubEvidence(),
    };

    match.applyRemoteOutcome(outcome);

    expect(match.turnNumber).toBe(2);
  });

  it("phase returns to WaitingForDecisions with swapped shooter/goalkeeper after a regular turn", () => {
    const { match } = makeMatch([]);
    const outcome: ResolutionOutcome = {
      goal: false,
      evidence: stubEvidence(),
    };

    match.applyRemoteOutcome(outcome);

    expect(match.state.phase).toBe("WaitingForDecisions");
    if (match.state.phase === "WaitingForDecisions") {
      expect(match.state.shooterId).toBe("pB");
      expect(match.state.goalkeeperId).toBe("pA");
    }
  });

  it("lastOutcome is set to the applied outcome", () => {
    const { match } = makeMatch([]);
    const outcome: ResolutionOutcome = { goal: true, evidence: stubEvidence() };

    match.applyRemoteOutcome(outcome);

    expect(match.lastOutcome).toEqual(outcome);
  });

  it("calls tickShot() and resetTurn() on all PassiveCards of both players", () => {
    const pAShoot = makeShootCard();
    const pASave = makeSaveCard();
    const pBShoot = makeShootCard();
    const pBSave = makeSaveCard();

    const pACards: PlayerCards = { shootCards: [pAShoot], saveCards: [pASave] };
    const pBCards: PlayerCards = { shootCards: [pBShoot], saveCards: [pBSave] };

    const { match } = makeMatch([], pACards, pBCards);
    const outcome: ResolutionOutcome = {
      goal: false,
      evidence: stubEvidence(),
    };

    match.applyRemoteOutcome(outcome);

    expect(pAShoot.tickShot).toHaveBeenCalledTimes(1);
    expect(pASave.tickShot).toHaveBeenCalledTimes(1);
    expect(pBShoot.tickShot).toHaveBeenCalledTimes(1);
    expect(pBSave.tickShot).toHaveBeenCalledTimes(1);
    expect(pAShoot.resetTurn).toHaveBeenCalledTimes(1);
    expect(pASave.resetTurn).toHaveBeenCalledTimes(1);
    expect(pBShoot.resetTurn).toHaveBeenCalledTimes(1);
    expect(pBSave.resetTurn).toHaveBeenCalledTimes(1);
  });

  it("throws MatchAlreadyOverError when match is already GameOver", () => {
    // Drive to GameOver via early win after turn 6 (pA=3, pB=0, pBKicksLeft=2 → 3>0+2)
    const { match } = makeMatch([true, false, true, false, true, false]);
    runTurns(match, 6);

    expect(match.state.phase).toBe("GameOver");
    const outcome: ResolutionOutcome = { goal: true, evidence: stubEvidence() };
    expect(() => match.applyRemoteOutcome(outcome)).toThrowError(
      MatchAlreadyOverError,
    );
  });

  it("reaches GameOver via applyRemoteOutcome exactly like advance() would (parity check)", () => {
    // Same goals sequence as the advance()-based early-win scenario, but driven
    // entirely through applyRemoteOutcome() to prove it reaches the same state.
    const { match } = makeMatch([]);
    const goals = [true, false, true, false, true, false];

    for (const goal of goals) {
      match.applyRemoteOutcome({ goal, evidence: stubEvidence() });
    }

    expect(match.state.phase).toBe("GameOver");
    if (match.state.phase === "GameOver") {
      expect(match.state.winner).toBe("pA");
    }
  });
});

// ─── Review fix 1 — applyRemoteOutcome replays ActiveCard side effects ─────
// REQ-REMOTE-OUTCOME-002: the guest never runs PenaltyResolver locally, so
// applyRemoteOutcome() must replay the activate()/markUsed() calls the host's
// PenaltyResolver made, using outcome.evidence (activesFired/consumedOnMiss)
// as the source of truth, so canActivate() stays in sync across peers.

function makePlayerWithActives(
  id: string,
  strikerActives: ActiveCard[] = [],
  goalkeeperActives: ActiveCard[] = [],
): IPlayer & {
  striker: { activeCards: ActiveCard[] };
  goalkeeper: { activeCards: ActiveCard[] };
} {
  return {
    id,
    decide: vi.fn(),
    resetForNewMatch: vi.fn(),
    striker: { activeCards: strikerActives },
    goalkeeper: { activeCards: goalkeeperActives },
  };
}

describe("PenaltyShootout.applyRemoteOutcome — replays ActiveCard side effects from evidence (SCEN-REMOTE-OUTCOME-CARDS)", () => {
  it("activates the shooter's active card referenced in evidence.activesFired (by: striker)", () => {
    const strikerActive = new CheatingCard(10, "Cheat", "desc", "");
    // Default construction: shooter=pA, goalkeeper=pB
    const pA = makePlayerWithActives("pA", [strikerActive], []);
    const pB = makePlayerWithActives("pB", [], []);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());
    const outcome: ResolutionOutcome = {
      goal: true,
      evidence: {
        ...stubEvidence(),
        activesFired: [{ cardId: 10, by: "striker", effect: "cheat" }],
      },
    };

    match.applyRemoteOutcome(outcome);

    expect(strikerActive.canActivate()).toBe(false);
  });

  it("activates the goalkeeper's active card referenced in evidence.activesFired (by: goalkeeper)", () => {
    const gkActive = new IntimidateCard(11, "Intimidate", "desc", "");
    const pA = makePlayerWithActives("pA", [], []);
    const pB = makePlayerWithActives("pB", [], [gkActive]);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());
    const outcome: ResolutionOutcome = {
      goal: false,
      evidence: {
        ...stubEvidence(),
        activesFired: [{ cardId: 11, by: "goalkeeper", effect: "intimidate" }],
      },
    };

    match.applyRemoteOutcome(outcome);

    expect(gkActive.canActivate()).toBe(false);
  });

  it("marks used (without activating) the striker's active card referenced in evidence.consumedOnMiss", () => {
    const strikerActive = new CheatingCard(12, "Cheat", "desc", "");
    const pA = makePlayerWithActives("pA", [strikerActive], []);
    const pB = makePlayerWithActives("pB", [], []);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());
    const outcome: ResolutionOutcome = {
      goal: true,
      evidence: {
        ...stubEvidence(),
        directGoal: true,
        sidesMatched: false,
        consumedOnMiss: [{ cardId: 12, by: "striker" }],
      },
    };

    match.applyRemoteOutcome(outcome);

    expect(strikerActive.canActivate()).toBe(false);
  });

  it("does not touch a card that is not referenced in activesFired or consumedOnMiss", () => {
    const untouchedStriker = new CheatingCard(13, "Cheat", "desc", "");
    const untouchedGk = new IntimidateCard(14, "Intimidate", "desc", "");
    const pA = makePlayerWithActives("pA", [untouchedStriker], []);
    const pB = makePlayerWithActives("pB", [], [untouchedGk]);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());
    const outcome: ResolutionOutcome = {
      goal: true,
      evidence: stubEvidence(),
    };

    match.applyRemoteOutcome(outcome);

    expect(untouchedStriker.canActivate()).toBe(true);
    expect(untouchedGk.canActivate()).toBe(true);
  });

  it("does not throw when a referenced cardId is not found in the local pool (defensive no-op)", () => {
    const pA = makePlayerWithActives("pA", [], []);
    const pB = makePlayerWithActives("pB", [], []);
    const match = new PenaltyShootout(pA, pB, makeCards(), makeCards());
    const outcome: ResolutionOutcome = {
      goal: true,
      evidence: {
        ...stubEvidence(),
        activesFired: [{ cardId: 999, by: "striker", effect: "cheat" }],
      },
    };

    expect(() => match.applyRemoteOutcome(outcome)).not.toThrow();
  });
});
