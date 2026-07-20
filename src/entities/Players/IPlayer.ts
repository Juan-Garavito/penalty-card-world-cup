import { TurnContext } from "./TurnContext.ts";
import { PlayerDecision } from "./PlayerDecision.ts";
import { Striker } from "../Footballers/Striker.ts";
import { Goalkeeper } from "../Footballers/Goalkeeper.ts";

// REQ-MULTIPLAYER-IPLAYER-CARDS: striker/goalkeeper are declared on the
// interface (not just left as an implementation detail behind decide()) so
// any IPlayer-typed reference — including a RemotePlayer produced by
// MatchFactory.buildMultiplayer() — can be wired into card-pool consumers
// (e.g. PenaltyPresenter) without an unchecked cast. Safe, non-breaking
// addition: HumanPlayer/BufferedDecisionPlayer, IAPlayer, and RemotePlayer
// already declare these exact fields, so no implementer changes.
export interface IPlayer {
  readonly id: string;
  readonly striker: Striker;
  readonly goalkeeper: Goalkeeper;
  decide(context: TurnContext): PlayerDecision;
  resetForNewMatch(): void;
}
