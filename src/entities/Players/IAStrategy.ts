import { TurnContext } from "./TurnContext.ts";
import { PassiveCard } from "../Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { Side } from "./Side.ts";

// SCEN-IASTRATEGY-SIDE-INTERFACE
export interface IAStrategy {
  pick(context: TurnContext): PassiveCard;
  pickActive(
    role: "shooter" | "goalkeeper",
    candidatePool: ActiveCard[],
  ): ActiveCard | undefined;
  pickSide(role: "shooter" | "goalkeeper"): Side;
}
