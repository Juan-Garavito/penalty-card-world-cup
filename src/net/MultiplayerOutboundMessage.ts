import { RemoteDecisionPayload } from "./RemoteDecisionAdapter.ts";
import { ResolutionOutcome } from "../entities/Match/ResolutionOutcome.ts";

// REQ-MULTIPLAYER-OUTBOUND-MESSAGE: the two message shapes a PenaltyPresenter
// ever needs to send to its peer over the (future) WS relay — a guest sends
// its staged decision, a host sends the resulting outcome once both
// decisions are in. Pure data shape; no network transport wired in yet.
export type MultiplayerOutboundMessage =
  | { type: "decision"; payload: RemoteDecisionPayload }
  | { type: "outcome"; payload: ResolutionOutcome };
