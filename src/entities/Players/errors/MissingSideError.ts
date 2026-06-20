// NF-005: lives under src/entities/Players/errors/
export class MissingSideError extends Error {
  constructor() {
    super("HumanPlayer.decide() called without a pending side selection");
    this.name = "MissingSideError";
  }
}
