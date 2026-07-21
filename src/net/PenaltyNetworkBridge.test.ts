import { describe, it, expect, vi } from "vitest";
import { PenaltyPresenter } from "../screens/PenaltyPresenter.ts";
import { MatchFactory } from "../entities/Match/MatchFactory.ts";
import { wireNetworkBridge } from "./PenaltyNetworkBridge.ts";
import type { MultiplayerOutboundMessage } from "./MultiplayerOutboundMessage.ts";

// Minimal fake — wireNetworkBridge only ever calls transport.onMessage(cb),
// so that's the only PeerTransport surface this fixture needs to provide.
class FakeTransport {
  private _cb: ((message: MultiplayerOutboundMessage) => void) | null = null;
  readonly unsubscribeMock = vi.fn();

  onMessage(cb: (message: MultiplayerOutboundMessage) => void): () => void {
    this._cb = cb;
    return this.unsubscribeMock;
  }

  emit(message: MultiplayerOutboundMessage): void {
    this._cb?.(message);
  }
}

function buildPresenter(role: "host" | "guest"): PenaltyPresenter {
  const build = MatchFactory.buildMultiplayer(role);
  return new PenaltyPresenter({
    shootout: build.shootout,
    humanPlayerId: build.humanPlayerId,
    humanPlayer: build.humanPlayer,
    iaPlayer: build.iaPlayer,
    multiplayer: {
      role,
      send: () => {},
    },
  });
}

const DECISION_MESSAGE: MultiplayerOutboundMessage = {
  type: "decision",
  payload: { chosenCardId: 101, activeCardId: null, side: "left" },
};

const OUTCOME_MESSAGE: MultiplayerOutboundMessage = {
  type: "outcome",
  payload: {
    goal: false,
    evidence: {
      kickSide: "left",
      diveSide: "left",
      sidesMatched: true,
      directGoal: false,
      strikerPassiveId: 1,
      goalkeeperPassiveId: 104,
      activesFired: [],
      nullifiedActives: [],
      consumedOnMiss: [],
      finalPGoal: null,
      roll: null,
      strikerCurrentPower: null,
      goalkeeperCurrentPower: null,
    },
  },
};

describe("wireNetworkBridge", () => {
  it("dispatches 'decision' messages to receiveRemoteDecision for the host", () => {
    const presenter = buildPresenter("host");
    const transport = new FakeTransport();
    const spy = vi.spyOn(presenter, "receiveRemoteDecision");

    wireNetworkBridge(presenter, transport, "host");
    transport.emit(DECISION_MESSAGE);

    expect(spy).toHaveBeenCalledWith(DECISION_MESSAGE.payload);
  });

  it("dispatches 'outcome' messages to receiveRemoteOutcome for the guest", () => {
    const presenter = buildPresenter("guest");
    const transport = new FakeTransport();
    const spy = vi.spyOn(presenter, "receiveRemoteOutcome");

    wireNetworkBridge(presenter, transport, "guest");
    transport.emit(OUTCOME_MESSAGE);

    expect(spy).toHaveBeenCalledWith(OUTCOME_MESSAGE.payload);
  });

  it("does NOT call the presenter when the host receives an 'outcome' message", () => {
    const presenter = buildPresenter("host");
    const transport = new FakeTransport();
    const decisionSpy = vi.spyOn(presenter, "receiveRemoteDecision");
    const outcomeSpy = vi.spyOn(presenter, "receiveRemoteOutcome");

    wireNetworkBridge(presenter, transport, "host");
    transport.emit(OUTCOME_MESSAGE);

    expect(decisionSpy).not.toHaveBeenCalled();
    expect(outcomeSpy).not.toHaveBeenCalled();
  });

  it("does NOT call the presenter when the guest receives a 'decision' message", () => {
    const presenter = buildPresenter("guest");
    const transport = new FakeTransport();
    const decisionSpy = vi.spyOn(presenter, "receiveRemoteDecision");
    const outcomeSpy = vi.spyOn(presenter, "receiveRemoteOutcome");

    wireNetworkBridge(presenter, transport, "guest");
    transport.emit(DECISION_MESSAGE);

    expect(decisionSpy).not.toHaveBeenCalled();
    expect(outcomeSpy).not.toHaveBeenCalled();
  });

  it("returns the unsubscribe function from transport.onMessage", () => {
    const presenter = buildPresenter("host");
    const transport = new FakeTransport();

    const unsubscribe = wireNetworkBridge(presenter, transport, "host");

    expect(unsubscribe).toBe(transport.unsubscribeMock);
  });
});
