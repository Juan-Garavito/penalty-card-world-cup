export class EmptyCardPoolError extends Error {
  constructor() {
    super("Cannot pick from an empty card pool");
    this.name = "EmptyCardPoolError";
  }
}
