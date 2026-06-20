import { PowerUpCard } from "./PowerUpCard.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

export class TimeRewind extends PowerUpCard {
  equipTo(target: PassiveCard): void {
    target.rewindCooldown(2);
    this.used = true;
  }
}
