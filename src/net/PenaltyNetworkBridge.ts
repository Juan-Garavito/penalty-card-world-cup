import { PenaltyPresenter } from "../screens/PenaltyPresenter.ts";
import type { PeerTransport } from "./PeerTransport.ts";

// REQ-MULTIPLAYER-NETWORK-BRIDGE: glues PeerTransport's raw "data" events to
// the right PenaltyPresenter method for this client's role. A host only ever
// expects incoming "decision" messages (from its guest); a guest only ever
// expects incoming "outcome" messages (from its host). Any other
// role/message-type combination is a message this client should never
// receive (e.g. a host receiving "outcome") — silently ignored rather than
// thrown, since a malformed/out-of-order peer message is not this client's
// bug to crash on.
export function wireNetworkBridge(
  presenter: PenaltyPresenter,
  transport: Pick<PeerTransport, "onMessage">,
  role: "host" | "guest",
): () => void {
  return transport.onMessage((message) => {
    if (role === "host" && message.type === "decision") {
      presenter.receiveRemoteDecision(message.payload);
      return;
    }
    if (role === "guest" && message.type === "outcome") {
      presenter.receiveRemoteOutcome(message.payload);
      return;
    }
  });
}
