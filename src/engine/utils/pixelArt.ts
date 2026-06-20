import type { Texture } from "pixi.js";

/**
 * Forces nearest-neighbour scaling on a texture's source so pixel-art stays
 * crisp at any scale instead of being blurred by the default linear filter.
 *
 * Every texture that shares the same source (e.g. all frames of a spritesheet)
 * is affected, so calling this once per source is enough.
 */
export function enablePixelArt(texture: Texture): Texture {
  texture.source.scaleMode = "nearest";
  return texture;
}

/** Applies {@link enablePixelArt} to a list of textures. */
export function enablePixelArtAll(textures: Texture[]): void {
  for (const texture of textures) {
    enablePixelArt(texture);
  }
}
