import { Peer, DataConnection } from "peerjs";
import type { MultiplayerOutboundMessage } from "./MultiplayerOutboundMessage.ts";
import { generateRoomCode } from "./RoomCode.ts";

// REQ-MULTIPLAYER-PEER-TRANSPORT: thin wrapper around a PeerJS Peer +
// DataConnection pair, shaped to exactly what PenaltyPresenter's
// `multiplayer.send` dep and the (future) PenaltyNetworkBridge need. All
// async waiting (peer creation, connection handshake) happens in the two
// static factories; the constructor only ever wraps an already-`open`
// DataConnection — the class itself has no "connecting" state.
//
// `peerFactory` is the testability seam: real `peerjs` needs actual WebRTC,
// which vitest/jsdom cannot provide, so tests inject a fake Peer/DataConnection
// pair through it instead of touching the real library.
export class PeerTransport {
  private _messageListeners: Array<
    (message: MultiplayerOutboundMessage) => void
  > = [];
  private _closeListeners: Array<() => void> = [];
  private _closed = false;

  private constructor(
    private readonly _conn: DataConnection,
    readonly roomCode: string | null,
  ) {
    this._conn.on("data", (data) => {
      const message = data as MultiplayerOutboundMessage;
      this._messageListeners.forEach((cb) => cb(message));
    });
    this._conn.on("close", () => {
      this._closeListeners.forEach((cb) => cb());
    });
  }

  // Creates a Peer with the room code as its id, resolves once a guest
  // DataConnection arrives AND that connection reaches "open". Rejects if
  // the Peer emits an "error" before that happens (e.g. id already taken).
  static host(deps?: {
    peerFactory?: (id: string) => Peer;
    roomCode?: string;
  }): Promise<PeerTransport> {
    return new Promise((resolve, reject) => {
      const roomCode = deps?.roomCode ?? generateRoomCode();
      const peer = deps?.peerFactory
        ? deps.peerFactory(roomCode)
        : new Peer(roomCode);

      let settled = false;
      peer.on("error", (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
      peer.on("connection", (conn) => {
        conn.on("open", () => {
          // A second guest connecting after the first is already paired
          // (retry after a network flap, a double-clicked "Join") reaches
          // the WebRTC layer fine but has nothing to pair with — close it
          // instead of leaving it dangling with no cleanup or signal.
          if (settled) {
            conn.close();
            return;
          }
          settled = true;
          resolve(new PeerTransport(conn, roomCode));
        });
      });
    });
  }

  // Creates a Peer with an auto-generated id, calls peer.connect(roomCode),
  // resolves once that connection reaches "open". Rejects on "error".
  static join(
    roomCode: string,
    deps?: { peerFactory?: (id?: string) => Peer },
  ): Promise<PeerTransport> {
    return new Promise((resolve, reject) => {
      const peer = deps?.peerFactory ? deps.peerFactory() : new Peer();

      let settled = false;
      peer.on("error", (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
      const conn = peer.connect(roomCode);
      conn.on("open", () => {
        if (settled) return;
        settled = true;
        resolve(new PeerTransport(conn, null));
      });
    });
  }

  send(message: MultiplayerOutboundMessage): void {
    // Real DataConnection.send() on a closed connection doesn't throw — it
    // just console.error's and emits an unhandled "error" event that
    // eventemitter3 silently swallows (we don't subscribe to it), so a
    // message would otherwise vanish with zero signal to the caller.
    if (this._closed) {
      throw new Error("Cannot send on a closed PeerTransport");
    }
    this._conn.send(message);
  }

  onMessage(cb: (message: MultiplayerOutboundMessage) => void): () => void {
    this._messageListeners.push(cb);
    return () => {
      this._messageListeners = this._messageListeners.filter((l) => l !== cb);
    };
  }

  onClose(cb: () => void): () => void {
    this._closeListeners.push(cb);
    return () => {
      this._closeListeners = this._closeListeners.filter((l) => l !== cb);
    };
  }

  close(): void {
    // Real PeerJS's DataConnection.close() nulls out `.provider` as a side
    // effect (the .d.ts's non-null `provider: Peer` doesn't reflect this
    // runtime behavior) — capture it first or the destroy() call below
    // throws on every real close.
    const peer = this._conn.provider;
    this._closed = true;
    this._conn.close();
    peer.destroy();
  }
}
