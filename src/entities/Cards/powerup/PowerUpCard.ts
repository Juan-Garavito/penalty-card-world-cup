import { Card } from "../Card.ts";
import type { PassiveCard } from "../passive/PassiveCard.ts";

export abstract class PowerUpCard extends Card {
  public used: boolean = false;

  canEquip(): boolean {
    return !this.used;
  }

  revive(): void {
    this.used = false;
  }

  // Concrete subtypes apply their one-shot effect to the target and set this.used = true
  abstract equipTo(target: PassiveCard): void;
}
