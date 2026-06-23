// One-off asset generator for the CrazyGames store listing icons.
// Renders a pixel-art trophy + title composition as SVG and rasterizes it
// with resvg-js at the exact dimensions CrazyGames requires. Does not touch
// any game source under src/ — output goes to marketing/crazygames/.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FONT_PATH = join(ROOT, "public/assets/fonts/Minecraft.ttf");
const OUT_DIR = join(ROOT, "marketing/crazygames");

const COLOR = {
  bgNight: "#0D1830",
  panel: "#142544",
  panelLine: "#2C4A82",
  ink: "#070B14",
  pitch: "#2F8F43",
  pitchDark: "#1F6E30",
  pitchLine: "#7FD089",
  gold: "#F5B73D",
  goldDeep: "#C8801F",
  cream: "#F6ECCF",
  usa: "#2F6FE0",
  navy: "#14306E",
  red: "#E23B3B",
  green: "#18A04A",
};

function scanlinePattern() {
  return `
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="none"/>
      <rect width="4" height="1" fill="${COLOR.ink}" opacity="0.10"/>
    </pattern>`;
}

function pitchBand(W, H, bandH) {
  const stripeW = Math.max(24, Math.round(Math.min(W, H) * 0.09));
  const y = H - bandH;
  let stripes = "";
  let x = 0;
  let i = 0;
  while (x < W) {
    stripes += `<rect x="${x}" y="${y}" width="${stripeW}" height="${bandH}" fill="${
      i % 2 === 0 ? COLOR.pitch : COLOR.pitchDark
    }"/>`;
    x += stripeW;
    i++;
  }
  return `${stripes}<rect x="0" y="${y}" width="${W}" height="3" fill="${COLOR.pitchLine}"/>`;
}

function usaFlagChip(cx, y, w, h) {
  const x = cx - w / 2;
  let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COLOR.cream}"/>`;
  const stripeH = h / 5;
  for (let i = 0; i < 5; i += 2) {
    svg += `<rect x="${x}" y="${y + i * stripeH}" width="${w}" height="${stripeH}" fill="${COLOR.red}"/>`;
  }
  const cantonW = w * 0.46;
  const cantonH = h * 0.58;
  svg += `<rect x="${x}" y="${y}" width="${cantonW}" height="${cantonH}" fill="${COLOR.navy}"/>`;
  const s = Math.min(cantonW, cantonH) * 0.3;
  const sx = x + cantonW / 2;
  const sy = y + cantonH / 2;
  svg += `<polygon points="${sx},${sy - s} ${sx + s * 0.3},${sy - s * 0.3} ${sx + s},${sy} ${sx + s * 0.3},${sy + s * 0.3} ${sx},${sy + s} ${sx - s * 0.3},${sy + s * 0.3} ${sx - s},${sy} ${sx - s * 0.3},${sy - s * 0.3}" fill="${COLOR.cream}"/>`;
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${COLOR.ink}" stroke-width="2"/>`;
  return svg;
}

function flagChip(cx, y, w, h, stripes, accent) {
  const sw = w / 3;
  const x = cx - w / 2;
  let svg = "";
  stripes.forEach((c, i) => {
    svg += `<rect x="${x + i * sw}" y="${y}" width="${sw}" height="${h}" fill="${c}"/>`;
  });
  if (accent) {
    const a = h * 0.32;
    svg += `<rect x="${cx - a / 2}" y="${y + h / 2 - a / 2}" width="${a}" height="${a}" fill="${accent}"/>`;
  }
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${COLOR.ink}" stroke-width="2"/>`;
  return svg;
}

function trophy(cx, baseY, h) {
  const u = h / 13.8;
  const ink = `stroke="${COLOR.ink}" stroke-width="${Math.max(1.5, u * 0.16)}" stroke-linejoin="miter"`;
  let y = baseY;

  // plinth
  const plinthH = u * 1.4;
  y -= plinthH;
  let svg = `<rect x="${cx - 5 * u}" y="${y}" width="${10 * u}" height="${plinthH}" fill="${COLOR.goldDeep}" ${ink}/>`;

  // foot
  const footH = u * 1.2;
  y -= footH;
  svg += `<rect x="${cx - 3 * u}" y="${y}" width="${6 * u}" height="${footH}" fill="${COLOR.gold}" ${ink}/>`;

  // stem
  const stemH = u * 3;
  y -= stemH;
  svg += `<rect x="${cx - 1.2 * u}" y="${y}" width="${2.4 * u}" height="${stemH}" fill="${COLOR.goldDeep}" ${ink}/>`;

  // knot
  const knotH = u * 1.2;
  y -= knotH;
  svg += `<rect x="${cx - 2 * u}" y="${y}" width="${4 * u}" height="${knotH}" fill="${COLOR.gold}" ${ink}/>`;

  // bowl (trapezoid, narrow at knot, wide at rim)
  const bowlH = u * 6;
  const bowlTopY = y - bowlH;
  const bottomHalf = 2 * u;
  const topHalf = 4.5 * u;
  svg += `<polygon points="${cx - bottomHalf},${y} ${cx + bottomHalf},${y} ${cx + topHalf},${bowlTopY} ${cx - topHalf},${bowlTopY}" fill="${COLOR.gold}" ${ink}/>`;
  // shading bands inside bowl
  svg += `<rect x="${cx - bottomHalf - u * 0.4}" y="${y - bowlH * 0.35}" width="${(bottomHalf + topHalf) * 0.5}" height="${u * 0.7}" fill="${COLOR.goldDeep}" opacity="0.85"/>`;
  svg += `<rect x="${cx - topHalf * 0.85}" y="${bowlTopY + bowlH * 0.15}" width="${topHalf * 1.7}" height="${u * 0.7}" fill="${COLOR.goldDeep}" opacity="0.7"/>`;
  y = bowlTopY;

  // rim cap
  const rimH = u * 1;
  y -= rimH;
  svg += `<rect x="${cx - 5 * u}" y="${y}" width="${10 * u}" height="${rimH}" fill="${COLOR.cream}" ${ink}/>`;

  // handles — open brackets (top arm + bottom arm + outer bar, no inner
  // edge) that overlap INTO the bowl's silhouette, so they read as welded
  // onto the body instead of floating beside it. The bowl is a trapezoid
  // that narrows going down, so the anchor must use the bowl's actual
  // half-width at the handle's *lowest* point — anchoring to topHalf (the
  // widest point, at the rim) is what left the old handles stranded with a
  // visible gap once the bowl had tapered inward.
  const handleH = u * 2.6;
  const handleCenterY = bowlTopY + bowlH * 0.45;
  const handleBottomY = handleCenterY + handleH / 2;
  const tAtHandleBottom = (handleBottomY - bowlTopY) / bowlH;
  const halfWidthAtHandleBottom =
    topHalf + (bottomHalf - topHalf) * tAtHandleBottom;
  const overlap = u * 0.6; // how far the bracket reaches into the bowl
  const handleW = u * 1.8;
  const armH = u * 0.7;
  const outerBarW = u * 0.7;
  const handleTopY = handleCenterY - handleH / 2;

  // Left handle
  const lInnerX = cx - halfWidthAtHandleBottom + overlap;
  const lOuterX = lInnerX - handleW;
  svg += `<rect x="${lOuterX}" y="${handleTopY}" width="${handleW}" height="${armH}" fill="${COLOR.goldDeep}" ${ink}/>`;
  svg += `<rect x="${lOuterX}" y="${handleBottomY - armH}" width="${handleW}" height="${armH}" fill="${COLOR.goldDeep}" ${ink}/>`;
  svg += `<rect x="${lOuterX}" y="${handleTopY}" width="${outerBarW}" height="${handleH}" fill="${COLOR.goldDeep}" ${ink}/>`;

  // Right handle (mirrored)
  const rInnerX = cx + halfWidthAtHandleBottom - overlap;
  const rOuterX = rInnerX + handleW;
  svg += `<rect x="${rInnerX}" y="${handleTopY}" width="${handleW}" height="${armH}" fill="${COLOR.goldDeep}" ${ink}/>`;
  svg += `<rect x="${rInnerX}" y="${handleBottomY - armH}" width="${handleW}" height="${armH}" fill="${COLOR.goldDeep}" ${ink}/>`;
  svg += `<rect x="${rOuterX - outerBarW}" y="${handleTopY}" width="${outerBarW}" height="${handleH}" fill="${COLOR.goldDeep}" ${ink}/>`;

  // sparkle near the rim
  const sx = cx + topHalf * 0.6;
  const sy = y + rimH * 0.2;
  const s = u * 0.9;
  svg += `<polygon points="${sx},${sy - s} ${sx + s * 0.3},${sy - s * 0.3} ${sx + s},${sy} ${sx + s * 0.3},${sy + s * 0.3} ${sx},${sy + s} ${sx - s * 0.3},${sy + s * 0.3} ${sx - s},${sy} ${sx - s * 0.3},${sy - s * 0.3}" fill="${COLOR.cream}"/>`;

  return svg;
}

function buildSvg(W, H) {
  const titleBlockH = H * 0.22;
  const pitchBandH = H * 0.14;
  const middleH = H - titleBlockH - pitchBandH;
  const trophyH = middleH * 0.82;
  const cx = W / 2;
  const baseY = H - pitchBandH - middleH * 0.06;

  const titleSize = Math.max(26, Math.min(W, H) * 0.085);
  const line1Y = titleBlockH * 0.42;
  const line2Y = titleBlockH * 0.78;

  const flagW = Math.min(W, H) * 0.1;
  const flagH = flagW * 0.62;
  const flagGap = flagW * 0.4;
  const flagY = H - pitchBandH * 0.62;

  const textStyle = (size, fill) =>
    `font-family="Minecraft" font-size="${size}" letter-spacing="${size * 0.05}" fill="${fill}" stroke="${COLOR.ink}" stroke-width="${size * 0.1}" paint-order="stroke fill" stroke-linejoin="miter" text-anchor="middle"`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${scanlinePattern()}</defs>
    <rect width="${W}" height="${H}" fill="${COLOR.bgNight}"/>
    ${pitchBand(W, H, pitchBandH)}
    ${trophy(cx, baseY, trophyH)}
    <text x="${cx}" y="${line1Y}" ${textStyle(titleSize, COLOR.gold)}>PENALTY CARD</text>
    <text x="${cx}" y="${line2Y}" ${textStyle(titleSize, COLOR.cream)}>WORLD CUP</text>
    ${usaFlagChip(cx - flagW - flagGap, flagY, flagW, flagH)}
    ${flagChip(cx, flagY, flagW, flagH, [COLOR.green, COLOR.cream, COLOR.red], COLOR.gold)}
    ${flagChip(cx + flagW + flagGap, flagY, flagW, flagH, [COLOR.red, COLOR.cream, COLOR.red], COLOR.red)}
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </svg>`;
}

const targets = [
  { name: "icon-landscape-1920x1080.png", w: 1920, h: 1080 },
  { name: "icon-portrait-800x1200.png", w: 800, h: 1200 },
  { name: "icon-square-800x800.png", w: 800, h: 800 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const t of targets) {
  const svg = buildSvg(t.w, t.h);
  const resvg = new Resvg(svg, {
    font: { fontFiles: [FONT_PATH], loadSystemFonts: false, defaultFontFamily: "Minecraft" },
  });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT_DIR, t.name), png);
  console.log(`wrote ${t.name}`);
}
