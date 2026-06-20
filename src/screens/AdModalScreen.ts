import { Container, Text } from "pixi.js";

export class AdModalScreen extends Container {
  private _resolve!: () => void;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  readonly promise: Promise<void>;

  constructor() {
    super();
    this.promise = new Promise<void>((resolve) => {
      this._resolve = resolve;
    });
  }

  prepare(): void {
    this.removeChildren();

    const label = new Text({
      text: "WATCHING AD",
      style: { fill: 0xffffff, fontSize: 32 },
    });
    label.anchor.set(0.5);
    label.x = 384;
    label.y = 350;
    this.addChild(label);

    let remaining = 5;
    const countTxt = new Text({
      text: String(remaining),
      style: { fill: 0xffd700, fontSize: 64 },
    });
    countTxt.anchor.set(0.5);
    countTxt.x = 384;
    countTxt.y = 450;
    this.addChild(countTxt);

    this._intervalId = setInterval(() => {
      remaining--;
      countTxt.text = String(Math.max(0, remaining));
    }, 1000);

    this._timeoutId = setTimeout(() => {
      this._cleanup();
      this._resolve();
    }, 5000);
  }

  private _cleanup(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  async show(): Promise<void> {
    // Navigation calls this — resolves immediately, completion via this.promise
  }

  reset(): void {
    this._cleanup();
    this.removeChildren();
  }
}
