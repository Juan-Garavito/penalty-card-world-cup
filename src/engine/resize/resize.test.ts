import { describe, it, expect } from "vitest";
import { resize } from "./resize.ts";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "./designSize.ts";

describe("resize", () => {
  const cases: Array<{
    name: string;
    rawWidth: number;
    rawHeight: number;
    expectedCssWidth: number;
    expectedCssHeight: number;
  }> = [
    // spec: "Wider-than-canvas viewport (mobile landscape)"
    // scale = min(852/1280, 393/720) = min(0.665625, 0.5458333) = 0.5458333
    // cssHeight = 720 * 0.5458333 = 393 (exact, height is the constraint)
    // cssWidth = 1280 * 0.5458333 = 698.666... -> floors to 698
    {
      name: "mobile landscape viewport wider than design aspect (852x393)",
      rawWidth: 852,
      rawHeight: 393,
      expectedCssWidth: 698,
      expectedCssHeight: 393,
    },
    // spec: "Viewport matches canvas aspect ratio (desktop)"
    // scale = 1.5 on both axes, no letterbox margin
    {
      name: "desktop viewport matching design aspect ratio exactly (1920x1080)",
      rawWidth: 1920,
      rawHeight: 1080,
      expectedCssWidth: 1920,
      expectedCssHeight: 1080,
    },
    // spec: "Taller-than-canvas viewport" — width is the constraint
    // scale = min(1024/1280, 900/720) = min(0.8, 1.25) = 0.8
    {
      name: "narrower/taller-than-design viewport, width-constrained (1024x900)",
      rawWidth: 1024,
      rawHeight: 900,
      expectedCssWidth: 1024,
      expectedCssHeight: 576,
    },
    // Extra triangulation case: viewport smaller than the design size in
    // both axes (sub-design), still must scale down uniformly, not clamp.
    {
      name: "sub-design viewport, scaled down uniformly (640x360, exact half)",
      rawWidth: 640,
      rawHeight: 360,
      expectedCssWidth: 640,
      expectedCssHeight: 360,
    },
  ];

  it.each(cases)(
    "$name",
    ({ rawWidth, rawHeight, expectedCssWidth, expectedCssHeight }) => {
      const result = resize(rawWidth, rawHeight, DESIGN_WIDTH, DESIGN_HEIGHT);

      // Buffer is ALWAYS the fixed design size — never the raw viewport.
      expect(result.bufferWidth).toBe(DESIGN_WIDTH);
      expect(result.bufferHeight).toBe(DESIGN_HEIGHT);

      expect(result.cssWidth).toBe(expectedCssWidth);
      expect(result.cssHeight).toBe(expectedCssHeight);
    },
  );

  it("centers letterboxed content by producing a cssWidth/cssHeight pair with the same aspect ratio as the design size", () => {
    const result = resize(852, 393, DESIGN_WIDTH, DESIGN_HEIGHT);

    // The scaled box must preserve the design's aspect ratio exactly —
    // this is what guarantees no distortion, only empty margins.
    const designAspect = DESIGN_WIDTH / DESIGN_HEIGHT;
    const cssAspect = result.cssWidth / result.cssHeight;

    expect(cssAspect).toBeCloseTo(designAspect, 2);
  });
});
