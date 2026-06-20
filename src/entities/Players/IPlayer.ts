import { TurnContext } from "./TurnContext.ts";
import { PlayerDecision } from "./PlayerDecision.ts";

export interface IPlayer {
  readonly id: string;
  decide(context: TurnContext): PlayerDecision;
  resetForNewMatch(): void;
}
