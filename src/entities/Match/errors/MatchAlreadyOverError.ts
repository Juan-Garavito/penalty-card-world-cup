export class MatchAlreadyOverError extends Error {
  constructor() {
    super("Cannot act on a match that is already over");
    this.name = "MatchAlreadyOverError";
  }
}
