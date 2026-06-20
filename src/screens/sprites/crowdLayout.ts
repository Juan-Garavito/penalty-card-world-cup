// Pure layout math for the stadium crowd grid. Kept Pixi-free so it can be unit
// tested: the real grid is only built at runtime (needs the sprite bundle), so the
// geometry decisions live here where they're cheap to verify.

export interface CrowdGridDims {
  /** Column width in screen px — chosen so columns fill the half with no gap. */
  cellW: number;
  /** Row height in screen px (band split into `rows`). */
  cellH: number;
  /** Number of fan rows stacked in the stands band. */
  rows: number;
  /** Number of fan columns in one half (one hinchada). */
  colsPerHalf: number;
}

// Sizes the crowd grid for one half of the stands. Rows split the band height;
// the column count is chosen to keep cells roughly square, then the column width
// is set so the columns fill the half EXACTLY — no leftover gap and no fan
// clipped at the end of the row. Non-positive inputs yield an empty grid.
export function crowdGridDims(
  halfWidth: number,
  bandHeight: number,
  targetRows: number,
): CrowdGridDims {
  if (halfWidth <= 0 || bandHeight <= 0 || targetRows <= 0) {
    return { cellW: 0, cellH: 0, rows: 0, colsPerHalf: 0 };
  }
  const cellH = bandHeight / targetRows;
  const colsPerHalf = Math.max(1, Math.round(halfWidth / cellH));
  const cellW = halfWidth / colsPerHalf;
  return { cellW, cellH, rows: targetRows, colsPerHalf };
}

// Deterministic hair variant (0..2) for a cell. Deterministic so the crowd stays
// stable across resizes (no flicker), and varied so neighbours rarely match.
export function hairIndexForCell(row: number, col: number): 0 | 1 | 2 {
  return ((row * 31 + col) % 3) as 0 | 1 | 2;
}
