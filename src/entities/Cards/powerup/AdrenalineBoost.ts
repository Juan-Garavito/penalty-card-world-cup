import { PowerUpCard } from "./PowerUpCard.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

export class AdrenalineBoost extends PowerUpCard {
  equipTo(target: PassiveCard): void {
    target.boost(3);
    this.used = true;
  }
}
