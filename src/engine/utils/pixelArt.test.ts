import { describe, it, expect } from "vitest";
import type { Texture } from "pixi.js";
import { enablePixelArt, enablePixelArtAll } from "./pixelArt.ts";

function fakeTexture(scaleMode: "nearest" | "linear"): Texture {
  return { source: { scaleMode } } as unknown as Texture;
}

describe("enablePixelArt", () => {
  it("sets the texture source scaleMode to nearest", () => {
    const texture = fakeTexture("linear");

    enablePixelArt(texture);

    expect(texture.source.scaleMode).toBe("nearest");
  });

  it("returns the same texture for chaining", () => {
    const texture = fakeTexture("linear");

    expect(enablePixelArt(texture)).toBe(texture);
  });
});

describe("enablePixelArtAll", () => {
  it("applies nearest to every texture passed", () => {
    const textures = [
      fakeTexture("linear"),
      fakeTexture("linear"),
      fakeTexture("linear"),
    ];

    enablePixelArtAll(textures);

    for (const texture of textures) {
      expect(texture.source.scaleMode).toBe("nearest");
    }
  });
});
