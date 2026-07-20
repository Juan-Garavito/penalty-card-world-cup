export class InvalidSideError extends Error {
  constructor(side: unknown) {
    super(
      `Invalid side value: ${JSON.stringify(side)} — expected "left" | "center" | "right"`,
    );
    this.name = "InvalidSideError";
  }
}
