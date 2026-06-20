import { Container, Graphics, Text, Ticker } from "pixi.js";
import { animate } from "motion";
import { drawPixelBorder, makeText } from "./utils/UIComponents.ts";

// ─── Layout (virtual canvas, matches HomeScreen's 1280×720) ──────────────────

const W = 1280;
const H = 720;

const BAR_W = 360;
const BAR_H = 24;
const BAR_X = W / 2 - BAR_W / 2;
const BAR_Y = H / 2 + 20;

const COLOR = {
  bgDeep: 0x0a1120,
  panelLine: 0x2c4a82,
  gold: 0xf5b73d,
  barEmpty: 0x1b315a,
};

const TWEEN_DURATION = 0.4;
const FADE_DURATION = 0.35;
const BLINK_PERIOD_MS = 1600;

export class LoadingScreen extends Container {
  private _tweenState = { value: 0 };
  private _fadeState = { alpha: 0 };
  private _barFill: Graphics | null = null;
  private _percentText: Text | null = null;
  private _studioText: Text | null = null;
  private _blinkElapsedMs = 0;

  prepare(): void {
    this._tweenState = { value: 0 };
    this._fadeState = { alpha: 0 };
    this._blinkElapsedMs = 0;
    this.alpha = 0;
    this._buildBackground();
    this._buildLabel();
    this._buildProgressBar();
    this._buildStudioCredit();
  }

  async show(): Promise<void> {
    await animate(
      this._fadeState,
      { alpha: 1 },
      { duration: FADE_DURATION, ease: "easeOut" },
    );
  }

  async hide(): Promise<void> {
    await animate(
      this._fadeState,
      { alpha: 0 },
      { duration: FADE_DURATION, ease: "easeIn" },
    );
  }

  reset(): void {
    this.removeChildren();
    this._barFill = null;
    this._percentText = null;
    this._studioText = null;
    this._tweenState = { value: 0 };
    this._fadeState = { alpha: 0 };
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  update(t: Ticker): void {
    this._redrawBar(this._tweenState.value);
    this.alpha = this._fadeState.alpha;
    this._blinkElapsedMs += t.deltaMS;
    if (this._studioText) {
      const phase = this._blinkElapsedMs / BLINK_PERIOD_MS;
      this._studioText.alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
    }
  }

  setProgress(pct: number): void {
    animate(
      this._tweenState,
      { value: pct },
      { duration: TWEEN_DURATION, ease: "easeOut" },
    );
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private _buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(COLOR.bgDeep);
    this.addChild(bg);
  }

  private _buildLabel(): void {
    const label = makeText("LOADING", "title", 32, COLOR.gold);
    label.anchor.set(0.5, 0.5);
    label.x = W / 2;
    label.y = H / 2 - 40;
    this.addChild(label);
  }

  private _buildProgressBar(): void {
    const border = new Graphics();
    drawPixelBorder(border, BAR_X, BAR_Y, BAR_W, BAR_H, COLOR.panelLine);
    this.addChild(border);

    const track = new Graphics();
    track.rect(BAR_X, BAR_Y, BAR_W, BAR_H).fill(COLOR.barEmpty);
    this.addChild(track);

    const fill = new Graphics();
    this.addChild(fill);
    this._barFill = fill;

    const percent = makeText("0%", "body", 18, COLOR.gold);
    percent.anchor.set(0.5, 0);
    percent.x = W / 2;
    percent.y = BAR_Y + BAR_H + 12;
    this.addChild(percent);
    this._percentText = percent;

    this._redrawBar(0);
  }

  private _buildStudioCredit(): void {
    const studio = makeText("GUARICHO GAMES", "body", 14, COLOR.gold);
    studio.anchor.set(0.5, 1);
    studio.x = W / 2;
    studio.y = H - 32;
    this.addChild(studio);
    this._studioText = studio;
  }

  private _redrawBar(value: number): void {
    const clamped = Math.max(0, Math.min(100, value));
    if (this._barFill) {
      this._barFill.clear();
      this._barFill
        .rect(BAR_X, BAR_Y, BAR_W * (clamped / 100), BAR_H)
        .fill(COLOR.gold);
    }
    if (this._percentText) {
      this._percentText.text = `${Math.round(clamped)}%`;
    }
  }
}
