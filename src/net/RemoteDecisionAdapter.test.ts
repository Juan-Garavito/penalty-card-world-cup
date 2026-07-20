import { describe, it, expect, vi } from "vitest";
import { RemoteDecisionAdapter } from "./RemoteDecisionAdapter.ts";
import { UnknownCardIdError } from "./errors/UnknownCardIdError.ts";
import { InvalidSideError } from "./errors/InvalidSideError.ts";
import { RemotePlayer } from "../entities/Players/RemotePlayer.ts";
import { Striker } from "../entities/Footballers/Striker.ts";
import { Goalkeeper } from "../entities/Footballers/Goalkeeper.ts";
import { ShootCard } from "../entities/Cards/passive/ShootCard.ts";
import { SaveCard } from "../entities/Cards/passive/SaveCard.ts";
import { CheatingCard } from "../entities/Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../entities/Cards/active/IntimidateCard.ts";
import type { PlayerCards } from "../entities/Match/PlayerCards.ts";

function makeTarget() {
  const shootCard = new ShootCard(101, "Strike Normal", "", "", "Normal");
  const saveCard = new SaveCard(104, "Save Normal", "", "", "Normal");
  const strikerActive = new CheatingCard(107, "Cheat", "", "");
  const goalkeeperActive = new IntimidateCard(109, "Intimidate", "", "");

  const striker = new Striker([shootCard], [strikerActive], []);
  const goalkeeper = new Goalkeeper([saveCard], [goalkeeperActive], []);
  const target = new RemotePlayer("guest-1", goalkeeper, striker);

  const cards: PlayerCards = {
    shootCards: [shootCard],
    saveCards: [saveCard],
  };

  return {
    target,
    cards,
    shootCard,
    saveCard,
    strikerActive,
    goalkeeperActive,
  };
}

describe("RemoteDecisionAdapter.apply()", () => {
  it("SCEN-ADAPTER-SHOOT-CARD: resolves chosenCardId against cards.shootCards and sets pending selection", () => {
    const { target, cards, shootCard } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");
    const setActive = vi.spyOn(target, "setPendingActive");
    const setSide = vi.spyOn(target, "setPendingSide");

    RemoteDecisionAdapter.apply(
      { chosenCardId: 101, activeCardId: null, side: "left" },
      cards,
      target,
    );

    expect(setSelection).toHaveBeenCalledWith(shootCard);
    expect(setActive).toHaveBeenCalledWith(null);
    expect(setSide).toHaveBeenCalledWith("left");
  });

  it("SCEN-ADAPTER-SAVE-CARD: resolves chosenCardId against cards.saveCards and sets pending selection", () => {
    const { target, cards, saveCard } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");

    RemoteDecisionAdapter.apply(
      { chosenCardId: 104, activeCardId: null, side: "center" },
      cards,
      target,
    );

    expect(setSelection).toHaveBeenCalledWith(saveCard);
  });

  it("SCEN-ADAPTER-STRIKER-ACTIVE: resolves activeCardId against target.striker.activeCards", () => {
    const { target, cards, strikerActive } = makeTarget();
    const setActive = vi.spyOn(target, "setPendingActive");

    RemoteDecisionAdapter.apply(
      { chosenCardId: 101, activeCardId: 107, side: "right" },
      cards,
      target,
    );

    expect(setActive).toHaveBeenCalledWith(strikerActive);
  });

  it("SCEN-ADAPTER-GOALKEEPER-ACTIVE: resolves activeCardId against target.goalkeeper.activeCards", () => {
    const { target, cards, goalkeeperActive } = makeTarget();
    const setActive = vi.spyOn(target, "setPendingActive");

    RemoteDecisionAdapter.apply(
      { chosenCardId: 104, activeCardId: 109, side: "left" },
      cards,
      target,
    );

    expect(setActive).toHaveBeenCalledWith(goalkeeperActive);
  });

  it("SCEN-ADAPTER-ACTIVE-UNDEFINED: an activeCardId of undefined (key omitted in a raw JSON payload) is treated the same as null — no active card, no throw", () => {
    const { target, cards } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");
    const setActive = vi.spyOn(target, "setPendingActive");
    const setSide = vi.spyOn(target, "setPendingSide");

    // Cast: simulates a real JSON.parse()'d payload where the key was
    // omitted entirely — TS's `number | null` annotation doesn't hold at
    // runtime for untrusted wire data.
    const payload = { chosenCardId: 101, side: "left" } as unknown as {
      chosenCardId: number;
      activeCardId: number | null;
      side: "left" | "center" | "right";
    };

    RemoteDecisionAdapter.apply(payload, cards, target);

    expect(setSelection).toHaveBeenCalled();
    expect(setActive).toHaveBeenCalledWith(null);
    expect(setSide).toHaveBeenCalledWith("left");
  });

  it("SCEN-ADAPTER-SIDE-PASSTHROUGH: side value is forwarded unchanged", () => {
    const { target, cards } = makeTarget();
    const setSide = vi.spyOn(target, "setPendingSide");

    RemoteDecisionAdapter.apply(
      { chosenCardId: 101, activeCardId: null, side: "right" },
      cards,
      target,
    );

    expect(setSide).toHaveBeenCalledWith("right");
  });

  it("SCEN-ADAPTER-UNKNOWN-CHOSEN: unknown chosenCardId throws UnknownCardIdError and applies nothing", () => {
    const { target, cards } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");
    const setActive = vi.spyOn(target, "setPendingActive");
    const setSide = vi.spyOn(target, "setPendingSide");

    expect(() =>
      RemoteDecisionAdapter.apply(
        { chosenCardId: 999, activeCardId: null, side: "left" },
        cards,
        target,
      ),
    ).toThrow(UnknownCardIdError);

    expect(setSelection).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
    expect(setSide).not.toHaveBeenCalled();
  });

  it("SCEN-ADAPTER-UNKNOWN-ACTIVE: unknown (non-null) activeCardId throws UnknownCardIdError and applies nothing — including the otherwise-valid chosen card", () => {
    const { target, cards } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");
    const setActive = vi.spyOn(target, "setPendingActive");
    const setSide = vi.spyOn(target, "setPendingSide");

    expect(() =>
      RemoteDecisionAdapter.apply(
        { chosenCardId: 101, activeCardId: 999, side: "left" },
        cards,
        target,
      ),
    ).toThrow(UnknownCardIdError);

    expect(setSelection).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
    expect(setSide).not.toHaveBeenCalled();
  });

  it("SCEN-ADAPTER-INVALID-SIDE: an invalid side value throws InvalidSideError and applies nothing — including the otherwise-valid chosen/active cards", () => {
    const { target, cards } = makeTarget();
    const setSelection = vi.spyOn(target, "setPendingSelection");
    const setActive = vi.spyOn(target, "setPendingActive");
    const setSide = vi.spyOn(target, "setPendingSide");

    // Cast: simulates a real JSON.parse()'d payload with an out-of-range
    // string — TS's `Side` union annotation doesn't hold at runtime for
    // untrusted wire data.
    const payload = {
      chosenCardId: 101,
      activeCardId: null,
      side: "up",
    } as unknown as {
      chosenCardId: number;
      activeCardId: number | null;
      side: "left" | "center" | "right";
    };

    expect(() => RemoteDecisionAdapter.apply(payload, cards, target)).toThrow(
      InvalidSideError,
    );

    expect(setSelection).not.toHaveBeenCalled();
    expect(setActive).not.toHaveBeenCalled();
    expect(setSide).not.toHaveBeenCalled();
  });
});
