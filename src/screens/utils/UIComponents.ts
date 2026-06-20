import { Graphics, Text } from "pixi.js";
import type { Confederation } from "../../entities/Tournament/WorldCupTeam.ts";

/**
 * Draw a pixel-art style border around a rect.
 * - 4px outer border in 0x070B14 (ink)
 * - 8px inner border in 0x2C4A82 (panel-line)
 */
export function drawPixelBorder(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  _color: number,
): void {
  const INK = 0x070B14;
  const PANEL_LINE = 0x2C4A82;

  // Outer ink border (4px)
  g.rect(x - 4, y - 4, w + 8, h + 8).fill(INK);
  // Panel-line border (8px inset)
  g.rect(x - 8, y - 8, w + 16, h + 16).fill(PANEL_LINE);
  // Re-draw outer ink border on top
  g.rect(x - 4, y - 4, w + 8, h + 8).fill(INK);
}

/**
 * Create a Text node using the game's pixel-art font (Minecraft.ttf) for
 * both title and body variants, sized differently by the caller.
 */
export function makeText(
  content: string,
  variant: "title" | "body",
  size: number,
  color: number,
): Text {
  void variant;
  const fontFamily = "Minecraft";
  return new Text({
    text: content,
    style: {
      fontFamily,
      fontSize: size,
      fill: color,
    },
  });
}

/**
 * Return the canonical pixel-arcade hex color for a given confederation.
 */
export function confColor(conf: Confederation | "ALL"): number {
  const MAP: Record<Confederation | "ALL", number> = {
    UEFA:     0x2F6FE0,
    CONMEBOL: 0xF5C531,
    CAF:      0x18A04A,
    AFC:      0xE23B3B,
    CONCACAF: 0xE8702A,
    OFC:      0x84BDEC,
    ALL:      0x2C4A82,
  };
  return MAP[conf];
}
