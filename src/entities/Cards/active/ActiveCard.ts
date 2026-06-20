import { Card } from "../Card.ts";

export abstract class ActiveCard extends Card {
  public used: boolean = false;

  constructor(id: number, name: string, description: string, imageUrl: string) {
    super(id, name, description, imageUrl);
  }

  canActivate(): boolean {
    return !this.used;
  }

  activate(): void {
    this.used = true;
  }

  /**
   * Marks the card as used WITHOUT firing any gameplay effect (applyTo).
   * Used by PenaltyResolver Step 0 when sides mismatch — cards are consumed
   * but their effects do not apply. Semantically distinct from activate().
   */
  markUsed(): void {
    this.used = true;
  }

  reset(): void {
    this.used = false;
  }
}
