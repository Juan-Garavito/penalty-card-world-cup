import { BufferedDecisionPlayer } from "./BufferedDecisionPlayer.ts";

// REQ-REMOTE-PLAYER-001: RemotePlayer implements IPlayer using the same
// buffer pattern as HumanPlayer — the remote peer's decision is buffered
// (via setPendingX) when it arrives over the network, then consumed by
// decide() when the shootout is ready to resolve the turn. See
// BufferedDecisionPlayer for the shared implementation.
export class RemotePlayer extends BufferedDecisionPlayer {}
