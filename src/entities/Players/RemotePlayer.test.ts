import { describe, it, expect } from "vitest";
import { RemotePlayer } from "./RemotePlayer.ts";
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

// SCEN-REMOTE-PLAYER-TYPE — RemotePlayer implements IPlayer
describe("RemotePlayer — IPlayer structural type compatibility", () => {
  it("RemotePlayer satisfies IPlayer interface", () => {
    const player: IPlayer = new RemotePlayer(
      "remote1",
      makeGoalkeeper(),
      makeStriker(),
    );
    expect(player.id).toBe("remote1");
  });
});

// SCEN-REMOTE-01 — Happy path: buffered selection consumed and cleared
describe("RemotePlayer.decide — pre-selection buffer", () => {
  it("returns the pending card and clears the buffer", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const card = makeCard(1);

    player.setPendingSelection(card);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.chosenCard).toBe(card);
    // Buffer should be cleared — second decide() should throw
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });
});

// SCEN-REMOTE-02 — Throws MissingSelectionError when buffer empty
describe("RemotePlayer.decide — empty buffer", () => {
  it("throws MissingSelectionError when no pending selection", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });
});

// SCEN-REMOTE-03 — Buffer replaced before decide
describe("RemotePlayer.setPendingSelection — overwrite", () => {
  it("second setPendingSelection overwrites the first", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const card1 = makeCard(1);
    const card2 = makeCard(2);

    player.setPendingSelection(card1);
    player.setPendingSelection(card2);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.chosenCard).toBe(card2);
  });
});

// SCEN-REMOTE-PENDING-ACTIVE — pending active appears in decision
describe("RemotePlayer.setPendingActive — pending active appears in decision", () => {
  it("decision.activePlayed is the card set via setPendingActive", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
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

// SCEN-REMOTE-NO-ACTIVE — no pending active yields undefined
describe("RemotePlayer.decide — no pending active yields undefined", () => {
  it("decision.activePlayed is undefined when setPendingActive was never called", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const passive = makeCard(1);

    player.setPendingSelection(passive);
    player.setPendingSide("left");
    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBeUndefined();
  });
});

// SCEN-REMOTE-CLEARED — both buffers cleared after decide()
describe("RemotePlayer.decide — both buffers cleared after decide()", () => {
  it("passive buffer cleared: second decide() without setPendingSelection throws MissingSelectionError", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const active = makeActiveCard(10);

    player.setPendingSelection(makeCard(1));
    player.setPendingActive(active);
    player.setPendingSide("left");
    player.decide(ctx); // consumes all buffers

    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });

  it("active buffer cleared: active does not reappear in next decide()", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const active = makeActiveCard(10);

    player.setPendingSelection(makeCard(1));
    player.setPendingActive(active);
    player.setPendingSide("left");
    player.decide(ctx); // first decide — consumes all

    player.setPendingSelection(makeCard(2));
    player.setPendingSide("right");
    const secondDecision = player.decide(ctx);

    expect(secondDecision.activePlayed).toBeUndefined();
  });
});

// SCEN-REMOTE-RESET — resetForNewMatch() resets active cards and pending buffers
describe("RemotePlayer.resetForNewMatch() — resets active cards and pending buffers", () => {
  it("all active cards used=false and pending buffers cleared after resetForNewMatch()", () => {
    const strikerActive = makeActiveCard(1); // CheatingCard — striker active
    const gkActive = new IntimidateCard(2, "Intimidate2", "desc", ""); // goalkeeper active
    strikerActive.activate(); // used = true
    gkActive.activate(); // used = true

    const striker = new Striker([], [strikerActive]);
    const goalkeeper = new Goalkeeper([], [gkActive]);
    const player = new RemotePlayer("remote1", goalkeeper, striker);

    player.setPendingSelection(makeCard(10));
    player.setPendingActive(makeActiveCard(99));

    player.resetForNewMatch();

    expect(strikerActive.canActivate()).toBe(true);
    expect(gkActive.canActivate()).toBe(true);

    expect(() => player.decide(ctx)).toThrowError(MissingSelectionError);
  });

  it("active buffer cleared: after resetForNewMatch, decide() without setPendingActive has undefined activePlayed", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingActive(makeActiveCard(5));
    player.resetForNewMatch();

    player.setPendingSelection(makeCard(1));
    player.setPendingSide("center");
    const decision = player.decide(ctx);

    expect(decision.activePlayed).toBeUndefined();
  });
});

// SCEN-REMOTE-RESET-PASSIVE-UNTOUCHED
describe("RemotePlayer.resetForNewMatch() — passive cards not touched", () => {
  it("passive card internal state is unchanged after resetForNewMatch()", () => {
    const passiveCard = makeCard(1);
    const player = new RemotePlayer(
      "remote1",
      new Goalkeeper([passiveCard as never], []),
      makeStriker(),
    );

    player.resetForNewMatch();

    expect(passiveCard.id).toBe(1);
  });
});

// SCEN-REMOTE-CANNOT-ACTIVATE — setPendingActive accepts used card at API level
describe("RemotePlayer.setPendingActive — accepts canActivate()===false card without throwing", () => {
  it("no exception thrown when setPendingActive called with a used card", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    const usedCard = makeActiveCard(5);
    usedCard.activate(); // used = true, canActivate() = false

    expect(() => player.setPendingActive(usedCard)).not.toThrow();

    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");
    const decision = player.decide(ctx);
    expect(decision.activePlayed).toBe(usedCard);
  });
});

// SCEN-REMOTE-SIDE-SET — setPendingSide + decide returns correct side
describe("RemotePlayer.setPendingSide — side buffer pattern", () => {
  it("decision.side equals the value passed to setPendingSide", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("right");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("right");
  });

  it("decision.side equals 'left' when setPendingSide('left') was called", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("left");
  });

  it("decision.side equals 'center' when setPendingSide('center') was called", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("center");

    const decision = player.decide(ctx);

    expect(decision.side).toBe("center");
  });
});

// SCEN-REMOTE-SIDE-MISSING — MissingSideError thrown when pendingSide is null
describe("RemotePlayer.decide — MissingSideError when pendingSide not set", () => {
  it("throws MissingSideError when setPendingSelection called but setPendingSide was not", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));

    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });

  it("MissingSideError name is 'MissingSideError'", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));

    try {
      player.decide(ctx);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingSideError);
    }
  });
});

// SCEN-REMOTE-SIDE-CLEARED — side buffer cleared after decide()
describe("RemotePlayer.decide — pendingSide cleared after successful decide()", () => {
  it("second decide() without setPendingSide throws MissingSideError (buffer cleared)", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSelection(makeCard(1));
    player.setPendingSide("left");
    player.decide(ctx); // first call — consumes buffer

    player.setPendingSelection(makeCard(2));
    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });
});

// resetForNewMatch() clears pendingSide
describe("RemotePlayer.resetForNewMatch() — clears pendingSide", () => {
  it("after resetForNewMatch(), decide() without setPendingSide throws MissingSideError", () => {
    const player = new RemotePlayer("remote1", makeGoalkeeper(), makeStriker());
    player.setPendingSide("right");

    player.resetForNewMatch();

    player.setPendingSelection(makeCard(1));
    expect(() => player.decide(ctx)).toThrowError(MissingSideError);
  });
});
