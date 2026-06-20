export class InvalidTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`Invalid transition: cannot call '${action}' from phase '${from}'`);
    this.name = "InvalidTransitionError";
  }
}
