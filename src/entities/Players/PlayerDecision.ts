import { PassiveCard } from "../Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { Side } from "./Side.ts";

// REQ-PLAYERDECISION-EXT — v3: side is required for 3-sided directional mechanics
// SCEN-PLAYERDECISION-SIDE-REQUIRED
export interface PlayerDecision {
  readonly chosenCard: PassiveCard;
  readonly activePlayed?: ActiveCard;
  readonly side: Side;
}
