export class CooldownTimer {
  private shotsSinceUse: number = 0;
  private ready: boolean;

  constructor(private readonly cooldown: number) {
    // All cards start ready — cooldown activates only after first play()
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  // Shots still needed before the card is ready again (0 when ready) — pure query
  shotsRemaining(): number {
    return this.ready ? 0 : Math.max(0, this.cooldown - this.shotsSinceUse);
  }

  // Called when a card is played — marks it unready and resets the counter
  play(): void {
    if (this.cooldown === 0) return; // Normal tier never enters cooldown
    this.ready = false;
    this.shotsSinceUse = 0;
  }

  // Called once per shot in the match loop — advances recovery
  tick(): void {
    if (this.ready) return;
    this.shotsSinceUse++;
    if (this.shotsSinceUse >= this.cooldown) this.ready = true;
  }

  // Instantly advances shotsSinceUse by the given amount (TimeRewind effect).
  // No-op when the timer is already ready.
  rewind(shots: number): void {
    if (this.ready) return;
    this.shotsSinceUse += shots;
    if (this.shotsSinceUse >= this.cooldown) this.ready = true;
  }
}
