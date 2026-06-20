import { Container, Sprite, Texture } from "pixi.js";
import type { LayeredFrames } from "../sprites/loadPenaltySprites.ts";

export type LayerName = "body" | "feet" | "head";

const LAYER_ORDER: LayerName[] = ["feet", "body", "head"];

interface PlayOptions {
  /** Frames per second. Default 6 (matches the Aseprite-authored timing). */
  fps?: number;
  /** Whether to loop. Default false. */
  loop?: boolean;
  /** Called when the last frame finishes playing (non-loop only). */
  onComplete?: () => void;
}

export class LayeredCharacter extends Container {
  private readonly layers: Record<LayerName, Sprite>;
  private readonly frameLists: LayeredFrames;
  private readonly frameWidth: number;
  private readonly frameHeight: number;

  private _playing = false;
  private _frameIndices: number[] = [];
  private _currentIdx = 0;
  private _elapsedMs = 0;
  private _msPerFrame = 167;
  private _loop = false;
  private _onComplete: (() => void) | null = null;

  constructor(frames: LayeredFrames) {
    super();
    this.frameLists = frames;

    const firstFrame = frames.body[0] ?? Texture.EMPTY;
    this.frameWidth = firstFrame.width;
    this.frameHeight = firstFrame.height;

    this.layers = {
      feet: this._makeLayerSprite(frames.feet[0]),
      body: this._makeLayerSprite(frames.body[0]),
      head: this._makeLayerSprite(frames.head[0]),
    };

    for (const name of LAYER_ORDER) {
      this.addChild(this.layers[name]);
    }
  }

  /** Width of a single frame (sprites are stacked at same coords). */
  get frameSize(): { width: number; height: number } {
    return { width: this.frameWidth, height: this.frameHeight };
  }

  /** Show a specific frame statically without animating. */
  setFrame(index: number): void {
    this._playing = false;
    this._applyFrame(index);
  }

  /** Play through a list of frame indices once or in a loop. */
  play(frameIndices: number[], opts: PlayOptions = {}): void {
    if (frameIndices.length === 0) return;
    this._frameIndices = frameIndices;
    this._currentIdx = 0;
    this._elapsedMs = 0;
    this._msPerFrame = 1000 / (opts.fps ?? 6);
    this._loop = opts.loop ?? false;
    this._onComplete = opts.onComplete ?? null;
    this._playing = true;
    this._applyFrame(frameIndices[0]);
  }

  /** Stop playback immediately, keep current frame. */
  stop(): void {
    this._playing = false;
  }

  /** Per-frame update. Called from the screen's update(). */
  tick(deltaMs: number): void {
    if (!this._playing) return;
    this._elapsedMs += deltaMs;
    while (this._elapsedMs >= this._msPerFrame) {
      this._elapsedMs -= this._msPerFrame;
      this._currentIdx++;
      if (this._currentIdx >= this._frameIndices.length) {
        if (this._loop) {
          this._currentIdx = 0;
        } else {
          // Stop on last frame
          this._currentIdx = this._frameIndices.length - 1;
          this._applyFrame(this._frameIndices[this._currentIdx]);
          this._playing = false;
          const cb = this._onComplete;
          this._onComplete = null;
          cb?.();
          return;
        }
      }
      this._applyFrame(this._frameIndices[this._currentIdx]);
    }
  }

  /** Set rotation in radians. Pivots around the character's center. */
  setRotationRadians(radians: number): void {
    this.rotation = radians;
  }

  /** Tint a specific layer (for team coloring). 0xffffff = neutral. */
  setLayerTint(layer: LayerName, color: number): void {
    this.layers[layer].tint = color;
  }

  /** Reset rotation, frames, and tints to defaults. */
  reset(): void {
    this._playing = false;
    this._frameIndices = [];
    this._currentIdx = 0;
    this._elapsedMs = 0;
    this._onComplete = null;
    this.rotation = 0;
    for (const name of LAYER_ORDER) {
      this.layers[name].texture = this.frameLists[name][0];
      this.layers[name].tint = 0xffffff;
    }
  }

  private _applyFrame(index: number): void {
    for (const name of LAYER_ORDER) {
      const tex = this.frameLists[name][index];
      if (tex) this.layers[name].texture = tex;
    }
  }

  private _makeLayerSprite(texture: Texture | undefined): Sprite {
    const s = new Sprite(texture ?? Texture.EMPTY);
    s.anchor.set(0.5);
    return s;
  }
}
