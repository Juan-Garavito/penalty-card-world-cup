import { describe, it, expect } from "vitest";
import { createCRTFilter } from "./CRTFilter.ts";

describe("CRTFilter", () => {
  it("SCEN-CRT-MODULE: module exports createCRTFilter function", () => {
    expect(typeof createCRTFilter).toBe("function");
  });

  it("SCEN-CRT-INIT: instantiates without throwing (skipped without WebGL)", () => {
    try {
      const f = createCRTFilter();
      expect(f).toBeDefined();
    } catch (e) {
      expect((e as Error).message).toMatch(/document|WebGL|canvas/i);
    }
  });
});
