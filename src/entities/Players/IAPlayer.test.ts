import { describe, it, expect, vi } from "vitest";
import { IAPlayer } from "./IAPlayer.ts";
import { IPlayer } from "./IPlayer.ts";
import { TurnContext } from "./TurnContext.ts";
import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { Striker } from "../Footballers/Striker.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { makeIAStrategyMock } from "./__test-helpers__/makeIAStrategyMock.ts";

function makeGoalkeeper(
  actives: (IntimidateCard | NullifyCard)[] = [],
): Goalkeeper {
  return new Goalkeeper([], actives);
}

function makeStriker(actives: (CheatingCard | NullifyCard)[] = []): Striker {
  return new Striker([], actives);
}

function makeCard(id: number): ShootCard {
  return new ShootCard(id, `Card${id}`, "desc", "", "Normal");
}

function makeCheatingCard(id: number): CheatingCard {
  return new CheatingCard(id, `Cheat${id}`, "desc", "");
}

function makeIntimidateCard(id: number): IntimidateCard {
  return new IntimidateCard(id, `Intimidate${id}`, "desc", "");
}

function makeNullifyCard(id: number): NullifyCard {
  return new NullifyCard(id, `Nullify${id}`, "desc", "");
}

const ctx: TurnContext = {
  turnNumber: 1,
  role: "shooter",
  availableCards: [],
};

const gkCtx: TurnContext = {
  turnNumber: 1,
  role: "goalkeeper",
  availableCards: [],
};

// SCEN-PLAYER-01 — IPlayer assignability
describe("IAPlayer — IPlayer structural type compatibility", () => {
  it("IAPlayer satisfies IPlayer interface", () => {
    const strategy = makeIAStrategyMock({ pick: vi.fn(() => makeCard(1)) });
    const player: IPlayer = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );
    expect(player.id).toBe("ia1");
  });
});

// SCEN-IA-01 — Delegates to injected strategy
describe("IAPlayer.decide — strategy delegation", () => {
  it("calls strategy.pick with the TurnContext and wraps result in PlayerDecision", () => {
    const stubCard = makeCard(42);
    const strategy = makeIAStrategyMock({ pick: vi.fn(() => stubCard) });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );

    const decision = player.decide(ctx);

    expect(strategy.pick).toHaveBeenCalledWith(ctx);
    expect(decision.chosenCard).toBe(stubCard);
  });
});

// SCEN-IA-02 — Different strategies produce different decisions
describe("IAPlayer.decide — independent strategies", () => {
  it("two IAPlayers with different strategies return independent decisions", () => {
    const cardA = makeCard(1);
    const cardB = makeCard(2);
    const strategyA = makeIAStrategyMock({ pick: vi.fn(() => cardA) });
    const strategyB = makeIAStrategyMock({ pick: vi.fn(() => cardB) });

    const playerA = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategyA,
    );
    const playerB = new IAPlayer(
      "ia2",
      makeGoalkeeper(),
      makeStriker(),
      strategyB,
    );

    const decisionA = playerA.decide(ctx);
    const decisionB = playerB.decide(ctx);

    expect(decisionA.chosenCard).toBe(cardA);
    expect(decisionB.chosenCard).toBe(cardB);
  });
});

// SCEN-IPLAYER-RESET-IA — REQ-IPLAYER-RESET-003
describe("IAPlayer.resetForNewMatch() — resets all active cards", () => {
  it("all striker and goalkeeper active cards have used=false after resetForNewMatch()", () => {
    const strikerActive = makeCheatingCard(1);
    const gkActive = makeIntimidateCard(2);
    strikerActive.activate(); // used = true
    gkActive.activate(); // used = true
    expect(strikerActive.canActivate()).toBe(false);
    expect(gkActive.canActivate()).toBe(false);

    const striker = makeStriker([strikerActive]);
    const goalkeeper = makeGoalkeeper([gkActive]);
    const strategy = makeIAStrategyMock({ pick: vi.fn(() => makeCard(99)) });
    const player = new IAPlayer("ia1", goalkeeper, striker, strategy);

    player.resetForNewMatch();

    expect(strikerActive.canActivate()).toBe(true);
    expect(gkActive.canActivate()).toBe(true);
    expect(strikerActive.used).toBe(false);
    expect(gkActive.used).toBe(false);
  });

  it("after resetForNewMatch(), decide() includes reset cards in candidatePool", () => {
    const strikerActive = makeCheatingCard(3);
    strikerActive.activate(); // used = true

    const striker = makeStriker([strikerActive]);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => makeCard(10)),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer("ia1", makeGoalkeeper(), striker, strategy);

    player.resetForNewMatch();
    player.decide(ctx); // ctx.role = "shooter"

    // After reset, strikerActive.used=false → canActivate()=true → pool has it
    expect(strategy.pickActive).toHaveBeenCalledWith("shooter", [
      strikerActive,
    ]);
  });
});

// SCEN-IA-03 — Active wiring: pickActive called with correct pool

// SCEN-IAPLAYER-SHOOTER — REQ-IAPLAYER-ACTIVE-002
describe("IAPlayer.decide — shooter role uses striker pool", () => {
  it("pickActive receives only the 2 activatable striker cards when role=shooter", () => {
    const activeA = makeCheatingCard(1);
    const activeB = makeNullifyCard(2);
    const striker = makeStriker([activeA, activeB]);
    const goalkeeper = makeGoalkeeper([makeIntimidateCard(3)]);
    const stubCard = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubCard),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer("ia1", goalkeeper, striker, strategy);

    player.decide(ctx); // ctx.role = "shooter"

    expect(strategy.pickActive).toHaveBeenCalledWith("shooter", [
      activeA,
      activeB,
    ]);
  });
});

// SCEN-IAPLAYER-GK — goalkeeper role uses goalkeeper pool
describe("IAPlayer.decide — goalkeeper role uses goalkeeper pool", () => {
  it("pickActive receives only the 1 activatable goalkeeper card when role=goalkeeper", () => {
    const gkActive = makeIntimidateCard(5);
    const goalkeeper = makeGoalkeeper([gkActive]);
    const striker = makeStriker([makeCheatingCard(6)]);
    const stubCard = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubCard),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer("ia1", goalkeeper, striker, strategy);

    player.decide(gkCtx); // gkCtx.role = "goalkeeper"

    expect(strategy.pickActive).toHaveBeenCalledWith("goalkeeper", [gkActive]);
  });
});

// SCEN-IAPLAYER-USED-FILTERED — used cards excluded from pool
describe("IAPlayer.decide — used cards excluded from candidatePool", () => {
  it("pool contains only the card with used=false when one striker card is used=true", () => {
    const usedCard = makeCheatingCard(1);
    usedCard.activate(); // used = true
    const freshCard = makeNullifyCard(2); // used = false
    const striker = makeStriker([usedCard, freshCard]);
    const stubCard = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubCard),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer("ia1", makeGoalkeeper(), striker, strategy);

    player.decide(ctx); // ctx.role = "shooter"

    expect(strategy.pickActive).toHaveBeenCalledWith("shooter", [freshCard]);
  });
});

// SCEN-IAPLAYER-SIDE-WIRED — pickSide called and side included in decision
describe("IAPlayer.decide — pickSide wired into decision", () => {
  it("decision.side equals the value returned by strategy.pickSide", () => {
    const stubPassive = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubPassive),
      pickActive: vi.fn(() => undefined),
      pickSide: vi.fn().mockReturnValue("right"),
    });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );

    const decision = player.decide(ctx);

    expect(decision.side).toBe("right");
  });

  it("strategy.pickSide is called with context.role", () => {
    const stubPassive = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubPassive),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );

    player.decide(ctx); // ctx.role = "shooter"

    expect(strategy.pickSide).toHaveBeenCalledWith("shooter");
    expect(strategy.pickSide).toHaveBeenCalledTimes(1);
  });

  it("strategy.pickSide called once for goalkeeper role", () => {
    const stubPassive = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubPassive),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );

    player.decide(gkCtx); // gkCtx.role = "goalkeeper"

    expect(strategy.pickSide).toHaveBeenCalledWith("goalkeeper");
  });
});

// SCEN-IAPLAYER-DECISION-WIRED — activePlayed in returned PlayerDecision — REQ-IAPLAYER-ACTIVE-003
describe("IAPlayer.decide — decision.activePlayed matches pickActive return", () => {
  it("decision.activePlayed is the card returned by the strategy mock", () => {
    const activeCard = makeCheatingCard(7);
    const stubPassive = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubPassive),
      pickActive: vi.fn(() => activeCard),
    });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker([activeCard]),
      strategy,
    );

    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBe(activeCard);
    expect(decision.chosenCard).toBe(stubPassive);
  });

  it("decision.activePlayed is undefined when pickActive returns undefined", () => {
    const stubPassive = makeCard(10);
    const strategy = makeIAStrategyMock({
      pick: vi.fn(() => stubPassive),
      pickActive: vi.fn(() => undefined),
    });
    const player = new IAPlayer(
      "ia1",
      makeGoalkeeper(),
      makeStriker(),
      strategy,
    );

    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBeUndefined();
    expect(decision.chosenCard).toBe(stubPassive);
  });
});
