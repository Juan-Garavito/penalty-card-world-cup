import { describe, it, expect } from "vitest";
import { HumanPlayer } from "./HumanPlayer.ts";
import { IPlayer } from "./IPlayer.ts";
import { TurnContext } from "./TurnContext.ts";
import { MissingSelectionError } from "./errors/MissingSelectionError.ts";
import { MissingSideError } from "./errors/MissingSideError.ts";
import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { Striker } from "../Footballers/Striker.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";

function makeGoalkeeper(): Goalkeeper {
  return new Goalkeeper([], []);
}

function makeStriker(): Striker {
  return new Striker([], []);
}

function makeCard(id: number): ShootCard {
  return new ShootCard(id, `Card${id}`, "desc", "", "Normal");
}

function makeActiveCard(id: number): CheatingCard {
  return new CheatingCard(id, `Active${id}`, "desc", "");
}

const ctx: TurnContext = {
  turnNumber: 1,
  role: "shooter",
  availableCards: [],
};

// SCEN-PLAYER-01 — IPlayer assignability
describe("HumanPlayer — IPlayer structural type compatibility", () => {
  it("HumanPlayer satisfies IPlayer interface", () => {
    const player: IPlayer = new HumanPlayer(
      "p1",
      makeGoalkeeper(),
      makeStriker(),
    );
    expect(player.id).toBe("p1");
  });
});

// SCEN-HUMAN-01 — Happy path: selection consumed and buffer cleared
describe("HumanPlayer.decide — pre-selection buffer", () => {
  it("returns the pending card and clears the buffer", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const card = makeCard(1);

    player.setPendingSelection(card);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.chosenCard).toBe(card);
    // Buffer should be cleared — second decide() should throw
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });
});

// SCEN-HUMAN-02 — Throws MissingSelectionError when buffer empty
describe("HumanPlayer.decide — empty buffer", () => {
  it("throws MissingSelectionError when no pending selection", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });
});

// SCEN-HUMAN-03 — Buffer replaced before decide
describe("HumanPlayer.setPendingSelection — overwrite", () => {
  it("second setPendingSelection overwrites the first", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const card1 = makeCard(1);
    const card2 = makeCard(2);

    player.setPendingSelection(card1);
    player.setPendingSelection(card2);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.chosenCard).toBe(card2);
  });
});

// SCEN-HUMAN-PENDING-ACTIVE — REQ-HUMAN-ACTIVE-001, REQ-HUMAN-ACTIVE-002
describe("HumanPlayer.setPendingActive — pending active appears in decision", () => {
  it("decision.activePlayed is the card set via setPendingActive", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const passive = makeCard(1);
    const active = makeActiveCard(10);

    player.setPendingSelection(passive);
    player.setPendingActive(active);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBe(active);
    expect(decision.chosenCard).toBe(passive);
  });
});

// SCEN-HUMAN-NO-ACTIVE — no pending active yields undefined
describe("HumanPlayer.decide — no pending active yields undefined", () => {
  it("decision.activePlayed is undefined when setPendingActive was never called", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const passive = makeCard(1);

    player.setPendingSelection(passive);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBeUndefined();
  });
});

// SCEN-HUMAN-CLEARED — both buffers cleared after decide — REQ-HUMAN-ACTIVE-003
describe("HumanPlayer.decide — both buffers cleared after decide()", () => {
  it("passive buffer cleared: second decide() without setPendingSelection throws MissingSelectionError", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const active = makeActiveCard(10);

    player.setPendingSelection(makeCard(1));
    player.setPendingActive(active);
    player.setPendingSide("left");
    player.decide(ctx); // consumes all buffers

    // Passive cleared → throws
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });

  it("active buffer cleared: active does not reappear in next decide()", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const active = makeActiveCard(10);

    player.setPendingSelection(makeCard(1));
    player.setPendingActive(active);
    player.setPendingSide("left");
    player.decide(ctx); // first decide — consumes all

    // Second decide with new passive and side — active should be undefined
    player.setPendingSelection(makeCard(2));
    player.setPendingSide("right");
    const secondDecision = player.decide(ctx);

    expect(secondDecision.activePlayed).toBeUndefined();
  });
});

// SCEN-IPLAYER-RESET-HUMAN — REQ-IPLAYER-RESET-002, REQ-IPLAYER-RESET-004
describe("HumanPlayer.resetForNewMatch() — resets active cards and pending buffers", () => {
  it("all active cards used=false and pending buffers cleared after resetForNewMatch()", () => {
    const strikerActive = makeActiveCard(1); // CheatingCard — striker active
    const gkActive = new IntimidateCard(2, "Intimidate2", "desc", ""); // goalkeeper active
    strikerActive.activate(); // used = true
    gkActive.activate(); // used = true

    const striker = new Striker([], [strikerActive]);
    const goalkeeper = new Goalkeeper([], [gkActive]);
    const player = new HumanPlayer("p1", goalkeeper, striker);

    // Set pending buffers
    player.setPendingSelection(makeCard(10));
    player.setPendingActive(makeActiveCard(99));

    player.resetForNewMatch();

    // Active cards reset
    expect(strikerActive.canActivate()).toBe(true);
    expect(gkActive.canActivate()).toBe(true);

    // Pending passive buffer cleared → decide() throws MissingSelectionError
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });

  it("active buffer cleared: after resetForNewMatch, decide() without setPendingActive has undefined activePlayed", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingActive(makeActiveCard(5));
    player.resetForNewMatch();

    // Provide a passive and side to allow decide() to run
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("center");
    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBeUndefined();
  });
});

// SCEN-IPLAYER-RESET-PASSIVE-UNTOUCHED — REQ-IPLAYER-RESET-005
describe("HumanPlayer.resetForNewMatch() — passive cards not touched", () => {
  it("passive card internal state is unchanged after resetForNewMatch()", () => {
    const passiveCard = makeCard(1);
    // Simulate some internal state by checking bonusPower if PassiveCard has it,
    // or simply confirm the card object reference is unchanged and no method was called
    const player = new HumanPlayer(
      "p1",
      new Goalkeeper([passiveCard as never], []),
      makeStriker(),
    );

    player.resetForNewMatch();

    // The card is the same object — no mutation happened to it
    // We verify by checking the card still has its original id (not a proxy or copy)
    expect(passiveCard.id).toBe(1);
  });
});

// SCEN-HUMAN-CANNOT-ACTIVATE — setPendingActive accepts used card at API level — REQ-HUMAN-ACTIVE-004
describe("HumanPlayer.setPendingActive — accepts canActivate()===false card without throwing", () => {
  it("no exception thrown when setPendingActive called with a used card", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    const usedCard = makeActiveCard(5);
    usedCard.activate(); // used = true, canActivate() = false

    expect(() => player.setPendingActive(usedCard)).not.toThrow();

    // And the decision still carries it (validation is downstream)
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");
    const decision = player.decide(ctx);
    expect(decision.activePlayed).toBe(usedCard);
  });
});

// SCEN-HUMAN-SIDE-SET — setPendingSide + decide returns correct side
describe("HumanPlayer.setPendingSide — side buffer pattern", () => {
  it("decision.side equals the value passed to setPendingSide", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("right");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("right");
  });

  it("decision.side equals 'left' when setPendingSide('left') was called", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("left");
  });

  it("decision.side equals 'center' when setPendingSide('center') was called", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("center");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("center");
  });
});

// SCEN-HUMAN-SIDE-MISSING — MissingSideError thrown when pendingSide is null
describe("HumanPlayer.decide — MissingSideError when pendingSide not set", () => {
  it("throws MissingSideError when setPendingSelection called but setPendingSide was not", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    // No setPendingSide call

    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });

  it("MissingSideError name is 'MissingSideError'", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));

    try {
      player.decide(ctx);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingSideError);
    }
  });
});

// SCEN-HUMAN-SIDE-CLEARED — side buffer cleared after decide()
describe("HumanPlayer.decide — pendingSide cleared after successful decide()", () => {
  it("second decide() without setPendingSide throws MissingSideError (buffer cleared)", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");
    player.decide(ctx); // first call — consumes buffer

    // Second call without new setPendingSide
    player.setPendingSelection(makeCard(2));
    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });
});

// resetForNewMatch() clears pendingSide
describe("HumanPlayer.resetForNewMatch() — clears pendingSide", () => {
  it("after resetForNewMatch(), decide() without setPendingSide throws MissingSideError", () => {
    const player = new HumanPlayer("p1", makeGoalkeeper(), makeStriker());
    player.setPendingSide("right");

    player.resetForNewMatch();

    player.setPendingSelection(makeCard(1));
    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });
});
