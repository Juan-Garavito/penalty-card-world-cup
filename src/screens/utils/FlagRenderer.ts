import { Graphics } from "pixi.js";
import type { FlagColor, FlagSpec } from "../../entities/Tournament/WorldCupTeam.ts";

export const FLAG_COLORS: Record<FlagColor, number> = {
  red:    0xE23B3B,
  dred:   0xB62B2B,
  white:  0xF6ECCF,
  blue:   0x2F6FE0,
  navy:   0x14306E,
  lblue:  0x84BDEC,
  sky:    0x6FA8DC,
  green:  0x18A04A,
  dgreen: 0x0F7A39,
  yellow: 0xF5C531,
  gold:   0xE0A020,
  black:  0x17171F,
  orange: 0xE8702A,
  maroon: 0x7A1F33,
  brown:  0x7A4A22,
};

export class FlagRenderer {
  /**
   * Draw a flag described by `spec` into an existing Graphics object.
   * The flag occupies the rectangle [0, 0, w, h].
   */
  static draw(g: Graphics, spec: FlagSpec, w: number, h: number): void {
    if ("v" in spec) {
      FlagRenderer._drawVertical(g, spec.v, w, h);
    } else if ("h" in spec) {
      FlagRenderer._drawHorizontal(g, spec.h, w, h);
    } else if ("cross" in spec) {
      FlagRenderer._drawNordicCross(g, spec.bg, spec.cross, spec.crossInner, w, h);
    } else if ("disc" in spec) {
      FlagRenderer._drawDisc(g, spec.bg, spec.disc, w, h);
    } else if ("emblem" in spec) {
      FlagRenderer._drawEmblem(g, spec.bg, spec.emblem, w, h);
    } else if ("special" in spec) {
      FlagRenderer._drawSpecial(g, spec.special, w, h);
    }
  }

  /**
   * Create a new Graphics, draw the flag, and return it.
   */
  static make(spec: FlagSpec, w: number, h: number): Graphics {
    const g = new Graphics();
    FlagRenderer.draw(g, spec, w, h);
    return g;
  }

  // ── Private drawing helpers ─────────────────────────────────────────────────

  private static _drawVertical(g: Graphics, colors: FlagColor[], w: number, h: number): void {
    const bandW = w / colors.length;
    colors.forEach((color, i) => {
      g.rect(i * bandW, 0, bandW, h).fill(FLAG_COLORS[color]);
    });
  }

  private static _drawHorizontal(g: Graphics, colors: FlagColor[], w: number, h: number): void {
    const bandH = h / colors.length;
    colors.forEach((color, i) => {
      g.rect(0, i * bandH, w, bandH).fill(FLAG_COLORS[color]);
    });
  }

  private static _drawNordicCross(
    g: Graphics,
    bg: FlagColor,
    cross: FlagColor,
    crossInner: FlagColor | undefined,
    w: number,
    h: number,
  ): void {
    // Background
    g.rect(0, 0, w, h).fill(FLAG_COLORS[bg]);

    // Cross bars (thick)
    const crossThick = Math.max(4, Math.floor(h * 0.2));
    const crossX = Math.floor(w * 0.35);
    const crossY = Math.floor(h * 0.4);

    // Vertical bar
    g.rect(crossX, 0, crossThick, h).fill(FLAG_COLORS[cross]);
    // Horizontal bar
    g.rect(0, crossY, w, crossThick).fill(FLAG_COLORS[cross]);

    if (crossInner) {
      // Thinner inner line
      const innerThick = Math.max(2, Math.floor(crossThick * 0.4));
      const offsetX = Math.floor((crossThick - innerThick) / 2);
      const offsetY = Math.floor((crossThick - innerThick) / 2);
      g.rect(crossX + offsetX, 0, innerThick, h).fill(FLAG_COLORS[crossInner]);
      g.rect(0, crossY + offsetY, w, innerThick).fill(FLAG_COLORS[crossInner]);
    }
  }

  private static _drawDisc(g: Graphics, bg: FlagColor, disc: FlagColor, w: number, h: number): void {
    g.rect(0, 0, w, h).fill(FLAG_COLORS[bg]);
    const radius = Math.floor(Math.min(w, h) * 0.28);
    // Center at 40% from left, vertically centered (Japan style)
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);
    g.circle(cx, cy, radius).fill(FLAG_COLORS[disc]);
  }

  private static _drawEmblem(g: Graphics, bg: FlagColor, emblem: FlagColor, w: number, h: number): void {
    g.rect(0, 0, w, h).fill(FLAG_COLORS[bg]);
    // Simplified placeholder: centered smaller rect
    const ew = Math.floor(w * 0.3);
    const eh = Math.floor(h * 0.4);
    const ex = Math.floor((w - ew) / 2);
    const ey = Math.floor((h - eh) / 2);
    g.rect(ex, ey, ew, eh).fill(FLAG_COLORS[emblem]);
  }

  private static _drawSpecial(g: Graphics, name: string, w: number, h: number): void {
    const dispatchers: Record<string, (g: Graphics, w: number, h: number) => void> = {
      rsa: FlagRenderer._drawSpecial_rsa,
      cze: FlagRenderer._drawSpecial_cze,
      pan: FlagRenderer._drawSpecial_pan,
      usa: FlagRenderer._drawSpecial_usa,
    };
    const fn = dispatchers[name];
    if (fn) {
      fn(g, w, h);
    } else {
      // Fallback: solid bg color
      g.rect(0, 0, w, h).fill(FLAG_COLORS.navy);
    }
  }

  private static _drawSpecial_rsa(g: Graphics, w: number, h: number): void {
    // South Africa: simplified — green + gold + black + red + white
    g.rect(0, 0, w, h).fill(FLAG_COLORS.green);
    g.rect(0, 0, Math.floor(w * 0.4), h).fill(FLAG_COLORS.black);
    g.rect(0, Math.floor(h * 0.35), w, Math.floor(h * 0.3)).fill(FLAG_COLORS.gold);
  }

  private static _drawSpecial_cze(g: Graphics, w: number, h: number): void {
    // Czech Republic: upper white, lower red, left triangle blue
    g.rect(0, 0, w, Math.floor(h / 2)).fill(FLAG_COLORS.white);
    g.rect(0, Math.floor(h / 2), w, Math.ceil(h / 2)).fill(FLAG_COLORS.red);
    g.rect(0, 0, Math.floor(w * 0.4), h).fill(FLAG_COLORS.blue);
  }

  private static _drawSpecial_pan(g: Graphics, w: number, h: number): void {
    // Panama: 4 quadrants — white/red top, blue/white bottom
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);
    g.rect(0, 0, hw, hh).fill(FLAG_COLORS.white);
    g.rect(hw, 0, w - hw, hh).fill(FLAG_COLORS.red);
    g.rect(0, hh, hw, h - hh).fill(FLAG_COLORS.blue);
    g.rect(hw, hh, w - hw, h - hh).fill(FLAG_COLORS.white);
  }

  private static _drawSpecial_usa(g: Graphics, w: number, h: number): void {
    // USA simplified: alternating red/white stripes
    const stripes = 7;
    const stripeH = h / stripes;
    for (let i = 0; i < stripes; i++) {
      g.rect(0, i * stripeH, w, stripeH).fill(i % 2 === 0 ? FLAG_COLORS.red : FLAG_COLORS.white);
    }
    // Blue canton placeholder
    g.rect(0, 0, Math.floor(w * 0.4), Math.floor(h * 0.45)).fill(FLAG_COLORS.navy);
  }
}
