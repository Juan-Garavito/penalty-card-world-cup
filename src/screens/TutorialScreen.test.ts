import { describe, it, expect } from "vitest";
import { Container } from "pixi.js";
import { TutorialScreen } from "./TutorialScreen.ts";

describe("TutorialScreen", () => {
  it("is a PixiJS Container", () => {
    expect(new TutorialScreen()).toBeInstanceOf(Container);
  });

  // NOTE: prepare() is not exercised here — it hits a pre-existing,
  // unrelated bug where reading `Text.height` on a `wordWrap: true` Text
  // during _buildBox() needs a real canvas 2D context, which this repo's
  // vitest.setup.ts document.createElement stub doesn't provide. Out of
  // scope for this resize-migration change; flagged separately.

  it("SCEN-TUT-RESIZE: screen has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = new TutorialScreen();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });
});
