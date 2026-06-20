import { Card } from "../Card.ts";
import { Tier, TIER_STATS } from "../Tier.ts";
import { CooldownTimer } from "../CooldownTimer.ts";

export abstract class PassiveCard extends Card {
  public readonly power: number;
  public readonly cooldown: number;
  public effectivePower: number; // mutable — NullifyCard writes here
  public bonusPower: number = 0; // mutable — AdrenalineBoost writes here, resetTurn() clears
  public immuneToActives: boolean = false; // mutable — FocusPill writes here, resetTurn() clears
  private readonly timer: CooldownTimer;

  constructor(
    id: number,
    name: string,
    description: string,
    imageUrl: string,
    public readonly tier: Tier,
  ) {
    super(id, name, description, imageUrl);
    const stats = TIER_STATS[tier];
    this.power = stats.power;
    this.cooldown = stats.cooldown;
    this.effectivePower = stats.power;
    this.timer = new CooldownTimer(stats.cooldown);
  }

  canPlay(): boolean {
    return this.timer.isReady();
  }

  // Shots remaining before this card can be played again (0 when ready)
  shotsRemaining(): number {
    return this.timer.shotsRemaining();
  }

  play(): number {
    this.timer.play();
    return this.effectivePower;
  }

  tickShot(): void {
    this.timer.tick();
  }

  // Called by NullifyCard to zero out this card's contribution
  nullify(): void {
    this.effectivePower = 0;
  }

  // Adds amount to bonusPower for this turn (AdrenalineBoost effect)
  boost(amount: number): void {
    this.bonusPower += amount;
  }

  // Grants immunity to active cards for this turn (FocusPill effect)
  makeImmune(): void {
    this.immuneToActives = true;
  }

  // Delegates to the internal timer (TimeRewind effect)
  rewindCooldown(shots: number): void {
    this.timer.rewind(shots);
  }

  // Returns the total power including any bonus applied this turn
  getCurrentPower(): number {
    return this.effectivePower + this.bonusPower;
  }

  // Resets all per-turn mutable state: restores effectivePower, clears bonusPower and immuneToActives
  resetTurn(): void {
    this.effectivePower = this.power;
    this.bonusPower = 0;
    this.immuneToActives = false;
  }
}
