import { describe, it, expect, vi } from "vitest";
import type { Peer } from "peerjs";
import { PeerTransport } from "./PeerTransport.ts";
import type { MultiplayerOutboundMessage } from "./MultiplayerOutboundMessage.ts";

// Minimal event-emitter fake — mimics only the `.on(event, cb)` / `emit`
// slice of PeerJS's Peer/DataConnection API that PeerTransport touches. Real
// `peerjs` needs actual WebRTC, unavailable in vitest/jsdom, so these fakes
// stand in for it entirely.
class FakeEmitter {
  private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  on(event: string, cb: (...args: unknown[]) => void): void {
    (this._listeners[event] ??= []).push(cb);
  }

  emit(event: string, ...args: unknown[]): void {
    (this._listeners[event] ?? []).forEach((cb) => cb(...args));
  }
}

class FakeDataConnection extends FakeEmitter {
  readonly sendMock = vi.fn();
  readonly closeMock = vi.fn();

  constructor(public provider: FakePeer | null) {
    super();
  }

  send(data: unknown): void {
    this.sendMock(data);
  }

  // Mirrors real PeerJS's DataConnection.close(), which nulls out
  // `.provider` as a side effect — a fake that skipped this let a
  // close()-throws-in-production bug pass the original test suite.
  close(): void {
    this.closeMock();
    this.provider = null;
  }
}

class FakePeer extends FakeEmitter {
  readonly destroyMock = vi.fn();
  readonly connectMock = vi.fn();
  lastConn: FakeDataConnection | undefined;

  constructor(public readonly id?: string) {
    super();
  }

  connect(peerId: string): FakeDataConnection {
    this.connectMock(peerId);
    const conn = new FakeDataConnection(this);
    this.lastConn = conn;
    return conn;
  }

  destroy(): void {
    this.destroyMock();
  }
}

async function buildHostedTransport(): Promise<{
  transport: PeerTransport;
  peer: FakePeer;
  conn: FakeDataConnection;
}> {
  let capturedPeer!: FakePeer;
  const promise = PeerTransport.host({
    peerFactory: (id) => {
      capturedPeer = new FakePeer(id);
      return capturedPeer as unknown as Peer;
    },
    roomCode: "ROOM01",
  });
  const conn = new FakeDataConnection(capturedPeer);
  capturedPeer.emit("connection", conn);
  conn.emit("open");
  const transport = await promise;
  return { transport, peer: capturedPeer, conn };
}

const SAMPLE_DECISION_MESSAGE: MultiplayerOutboundMessage = {
  type: "decision",
  payload: { chosenCardId: 1, activeCardId: null, side: "left" },
};

const SAMPLE_OUTCOME_MESSAGE: MultiplayerOutboundMessage = {
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

describe("PeerTransport.host", () => {
  it("resolves only once a guest connection reaches 'open', exposing the room code", async () => {
    let capturedPeer!: FakePeer;
    const promise = PeerTransport.host({
      peerFactory: (id) => {
        capturedPeer = new FakePeer(id);
        return capturedPeer as unknown as Peer;
      },
      roomCode: "ABC123",
    });

    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    const conn = new FakeDataConnection(capturedPeer);
    capturedPeer.emit("connection", conn);
    await Promise.resolve();
    expect(resolved).toBe(false);

    conn.emit("open");
    const transport = await promise;
    expect(resolved).toBe(true);
    expect(transport.roomCode).toBe("ABC123");
  });

  it("generates a room code when none is injected and uses it as the peer id", () => {
    let capturedId: string | undefined;
    const promise = PeerTransport.host({
      peerFactory: (id) => {
        capturedId = id;
        return new FakePeer(id) as unknown as Peer;
      },
    });
    expect(capturedId).toHaveLength(6);
    // Prevent an unhandled-rejection warning; this promise never settles
    // because no "connection"/"open"/"error" is fired in this test.
    void promise.catch(() => {});
  });

  it("rejects if the peer emits an error before a connection opens", async () => {
    let capturedPeer!: FakePeer;
    const promise = PeerTransport.host({
      peerFactory: (id) => {
        capturedPeer = new FakePeer(id);
        return capturedPeer as unknown as Peer;
      },
    });
    const err = new Error("unavailable-id");
    capturedPeer.emit("error", err);
    await expect(promise).rejects.toBe(err);
  });

  it("closes a second connection that arrives after the first is already paired, without disturbing the first", async () => {
    const { transport, peer, conn: firstConn } = await buildHostedTransport();

    const secondConn = new FakeDataConnection(peer);
    peer.emit("connection", secondConn);
    secondConn.emit("open");

    expect(secondConn.closeMock).toHaveBeenCalledTimes(1);
    expect(firstConn.closeMock).not.toHaveBeenCalled();
    // The already-resolved transport still wraps the first connection.
    transport.send(SAMPLE_DECISION_MESSAGE);
    expect(firstConn.sendMock).toHaveBeenCalledWith(SAMPLE_DECISION_MESSAGE);
  });
});

describe("PeerTransport.join", () => {
  it("resolves only once the connection reaches 'open', with roomCode null", async () => {
    let capturedPeer!: FakePeer;
    const promise = PeerTransport.join("ROOM01", {
      peerFactory: () => {
        capturedPeer = new FakePeer();
        return capturedPeer as unknown as Peer;
      },
    });

    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(capturedPeer.connectMock).toHaveBeenCalledWith("ROOM01");

    capturedPeer.lastConn!.emit("open");
    const transport = await promise;
    expect(resolved).toBe(true);
    expect(transport.roomCode).toBeNull();
  });

  it("rejects if the peer emits an error before the connection opens", async () => {
    let capturedPeer!: FakePeer;
    const promise = PeerTransport.join("ROOM01", {
      peerFactory: () => {
        capturedPeer = new FakePeer();
        return capturedPeer as unknown as Peer;
      },
    });
    const err = new Error("peer-unavailable");
    capturedPeer.emit("error", err);
    await expect(promise).rejects.toBe(err);
  });
});

describe("PeerTransport — send/onMessage/onClose/close", () => {
  it("send() calls the underlying connection's send with the exact message object", async () => {
    const { transport, conn } = await buildHostedTransport();
    transport.send(SAMPLE_DECISION_MESSAGE);
    expect(conn.sendMock).toHaveBeenCalledWith(SAMPLE_DECISION_MESSAGE);
  });

  it("onMessage delivers data events to the callback and supports multiple subscribers", async () => {
    const { transport, conn } = await buildHostedTransport();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    transport.onMessage(cb1);
    transport.onMessage(cb2);

    conn.emit("data", SAMPLE_OUTCOME_MESSAGE);

    expect(cb1).toHaveBeenCalledWith(SAMPLE_OUTCOME_MESSAGE);
    expect(cb2).toHaveBeenCalledWith(SAMPLE_OUTCOME_MESSAGE);
  });

  it("onMessage's unsubscribe stops delivery to that subscriber only", async () => {
    const { transport, conn } = await buildHostedTransport();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsubscribe1 = transport.onMessage(cb1);
    transport.onMessage(cb2);

    unsubscribe1();
    conn.emit("data", SAMPLE_OUTCOME_MESSAGE);

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("onClose fires on the connection's close event", async () => {
    const { transport, conn } = await buildHostedTransport();
    const cb = vi.fn();
    transport.onClose(cb);

    conn.emit("close");

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("onClose's unsubscribe stops further delivery", async () => {
    const { transport, conn } = await buildHostedTransport();
    const cb = vi.fn();
    const unsubscribe = transport.onClose(cb);

    unsubscribe();
    conn.emit("close");

    expect(cb).not.toHaveBeenCalled();
  });

  it("close() closes the connection and destroys the peer", async () => {
    const { transport, conn, peer } = await buildHostedTransport();
    transport.close();

    expect(conn.closeMock).toHaveBeenCalledTimes(1);
    expect(peer.destroyMock).toHaveBeenCalledTimes(1);
  });

  it("close() destroys the peer even though real DataConnection.close() nulls out .provider as a side effect", async () => {
    // Regression test for a bug where close() read `._conn.provider` AFTER
    // calling `._conn.close()` — real PeerJS nulls `.provider` inside
    // close(), so destroy() was called on null and threw on every real
    // close(). FakeDataConnection.close() mirrors that side effect above
    // specifically so this can't silently regress.
    const { transport, peer } = await buildHostedTransport();
    expect(() => transport.close()).not.toThrow();
    expect(peer.destroyMock).toHaveBeenCalledTimes(1);
  });

  it("send() throws after close() instead of silently dropping the message", async () => {
    const { transport } = await buildHostedTransport();
    transport.close();
    expect(() => transport.send(SAMPLE_DECISION_MESSAGE)).toThrow();
  });
});
