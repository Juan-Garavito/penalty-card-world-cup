import { describe, it, expect } from "vitest";
import { MissingSideError } from "./MissingSideError.ts";

// SCEN-MISSINGSIDEERROR-CLASS
describe("MissingSideError — class contract", () => {
  it("is instanceof MissingSideError and instanceof Error", () => {
    const err = new MissingSideError();
    expect(err).toBeInstanceOf(MissingSideError);
    expect(err).toBeInstanceOf(Error);
  });

  it("name is 'MissingSideError'", () => {
    const err = new MissingSideError();
    expect(err.name).toBe("MissingSideError");
  });

  it("message describes the missing side selection", () => {
    const err = new MissingSideError();
    expect(typeof err.message).toBe("string");
    expect(err.message.length).toBeGreaterThan(0);
  });
});
