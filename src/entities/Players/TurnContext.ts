import { PassiveCard } from "../Cards/passive/PassiveCard.ts";

export interface TurnContext {
  readonly turnNumber: number;
  readonly role: "shooter" | "goalkeeper";
  readonly availableCards: PassiveCard[];
}
