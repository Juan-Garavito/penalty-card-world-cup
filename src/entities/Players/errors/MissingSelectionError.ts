export class MissingSelectionError extends Error {
  constructor() {
    super("No card selection was set before calling decide()");
    this.name = "MissingSelectionError";
  }
}
