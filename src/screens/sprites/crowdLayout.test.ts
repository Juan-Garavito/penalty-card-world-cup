import { describe, it, expect } from "vitest";
import { crowdGridDims, hairIndexForCell } from "./crowdLayout.ts";

describe("crowdGridDims", () => {
  it("row height splits the band into targetRows", () => {
    const dims = crowdGridDims(500, 120, 3);
    expect(dims.cellH).toBe(40); // 120 / 3
    expect(dims.rows).toBe(3);
  });

  it("picks a near-square column count and fills the half exactly (no cut)", () => {
    // cellH 40 → round(500/40) = round(12.5) = 13 columns
    const dims = crowdGridDims(500, 120, 3);
    expect(dims.colsPerHalf).toBe(13);
    // columns fill the half width exactly → no leftover gap / clipped fan
    expect(dims.colsPerHalf * dims.cellW).toBeCloseTo(500);
  });

  it("returns an empty grid for non-positive dimensions", () => {
    const empty = { cellW: 0, cellH: 0, rows: 0, colsPerHalf: 0 };
    expect(crowdGridDims(0, 120, 3)).toEqual(empty);
    expect(crowdGridDims(500, 0, 3)).toEqual(empty);
    expect(crowdGridDims(500, 120, 0)).toEqual(empty);
    expect(crowdGridDims(-10, 120, 3).colsPerHalf).toBe(0);
  });
});

describe("hairIndexForCell", () => {
  it("always returns a value in 0..2", () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const idx = hairIndexForCell(row, col);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThanOrEqual(2);
      }
    }
  });

  it("is deterministic (same cell → same hair)", () => {
    expect(hairIndexForCell(4, 7)).toBe(hairIndexForCell(4, 7));
  });

  it("varies across neighbouring cells in a row", () => {
    const variants = new Set([
      hairIndexForCell(0, 0),
      hairIndexForCell(0, 1),
      hairIndexForCell(0, 2),
    ]);
    expect(variants.size).toBeGreaterThan(1);
  });
});
