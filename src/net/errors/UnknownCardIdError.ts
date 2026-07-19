export class UnknownCardIdError extends Error {
  constructor(cardId: number) {
    super(`No card with id ${cardId} was found in the target's local catalog`);
    this.name = "UnknownCardIdError";
  }
}
