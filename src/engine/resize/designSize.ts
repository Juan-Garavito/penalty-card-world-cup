/**
 * Single source of truth for the game's fixed virtual canvas (design) size.
 *
 * The render buffer is ALWAYS this size — see resize.ts / ResizePlugin.ts,
 * which only scale/letterbox the canvas's CSS box to fit the real viewport.
 * Screens author content at these fixed coordinates and never touch
 * `.scale` for resize purposes.
 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
