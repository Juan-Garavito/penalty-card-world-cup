/**
 * Uniform, aspect-preserving letterbox calculation.
 *
 * The render BUFFER is always the fixed design size (`designWidth` x
 * `designHeight`, e.g. 1280x720) — never the raw viewport. Only the CSS box
 * wrapping the canvas scales/letterboxes to fit the real viewport, using a
 * single uniform factor applied identically to both axes so nothing is ever
 * stretched or squished.
 */
export interface ResizeResult {
  /** Fixed render buffer width — always equals `designWidth`. */
  bufferWidth: number;
  /** Fixed render buffer height — always equals `designHeight`. */
  bufferHeight: number;
  /** CSS box width the canvas element should be styled to. */
  cssWidth: number;
  /** CSS box height the canvas element should be styled to. */
  cssHeight: number;
}

// Counters floating-point drift (e.g. 720 * (393/720) evaluating to
// 392.99999999999994 instead of exactly 393) so an axis that is meant to
// land on an exact integer never floors down to one less than intended.
const FLOAT_EPSILON = 1e-9;

export function resize(
  rawWidth: number,
  rawHeight: number,
  designWidth: number,
  designHeight: number,
): ResizeResult {
  const scale = Math.min(rawWidth / designWidth, rawHeight / designHeight);

  return {
    bufferWidth: designWidth,
    bufferHeight: designHeight,
    cssWidth: Math.floor(designWidth * scale + FLOAT_EPSILON),
    cssHeight: Math.floor(designHeight * scale + FLOAT_EPSILON),
  };
}
