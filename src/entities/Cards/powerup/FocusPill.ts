import { PowerUpCard } from "./PowerUpCard.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

export class FocusPill extends PowerUpCard {
  equipTo(target: PassiveCard): void {
    target.makeImmune();
    this.used = true;
  }
}
