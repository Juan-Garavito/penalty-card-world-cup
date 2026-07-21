import { Container, Filter, Graphics, Rectangle, Text, Ticker } from "pixi.js";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { PeerTransport } from "../net/PeerTransport.ts";
import { showRoomCodeInput } from "../engine/utils/roomCodeInput.ts";
import {
  takePendingOnConnected,
  takePendingOnCancel,
} from "./OnlineMatchPending.ts";

// ─── Layout (virtual canvas, matches HomeScreen's 1280×720) ──────────────────

const W = 1280;
const H = 720;

const COLOR = {
  bgTop: 0x0a1120,
  title: 0xf5b73d,
  label: 0xf6eccf,
  error: 0xe23b3b,
  enterCodeBg: 0x224488,
  cancelBg: 0x6b1f1f,
};

// ─── Screen ───────────────────────────────────────────────────────────────────
// REQ-MULTIPLAYER-JOIN-SCREEN: "ENTER CODE" opens the DOM room-code overlay
// (roomCodeInput.ts — PixiJS has no native text input), then attempts
// PeerTransport.join() with whatever code the player submitted. Unlike
// HostGameScreen, the async work here runs from a button click handler, not
// from show(), so there's no risk of Navigation blocking CANCEL via
// `interactiveChildren` during the connection attempt.
export class JoinGameScreen extends Container {
  private _onConnected: ((transport: PeerTransport) => void) | null = null;
  private _onCancel: (() => void) | null = null;
  // Guards against a resolved/rejected PeerTransport.join() call landing
  // after the player already hit CANCEL and this screen was torn down.
  private _active = false;
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;
  private _statusText!: Text;
  private _errorText!: Text;
  private _enterCodeBtn!: Container;

  constructor() {
    super();
  }

  prepare(): void {
    this._active = true;
    this._onConnected = takePendingOnConnected();
    this._onCancel = takePendingOnCancel();
    this._buildUI();

    // CRT filter — requires WebGL; skipped gracefully in non-browser environments
    try {
      this._crtFilter = createCRTFilter();
      this.filters = [this._crtFilter];
      if (typeof requestAnimationFrame !== "undefined") {
        this._crtTicker = (t: Ticker) => {
          if (!this._crtFilter) return;
          const u = this._crtFilter.resources["crtUniforms"] as {
            uniforms: { uTime: number };
          };
          u.uniforms.uTime += t.deltaMS / 1000;
        };
        Ticker.shared.add(this._crtTicker);
      }
    } catch {
      // no WebGL context (test runner) — skip filter
    }
  }

  async show(): Promise<void> {}

  async hide(): Promise<void> {}

  reset(): void {
    this._active = false;
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.filters = [];
    this._crtFilter = null;
    this.removeChildren();
    this._onConnected = null;
    this._onCancel = null;
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Join flow ────────────────────────────────────────────────────────────

  private async _startJoinFlow(): Promise<void> {
    const code = await showRoomCodeInput();
    if (code === null) return; // player cancelled the overlay — stay on this screen
    if (!this._active) return;

    this._errorText.text = "";
    this._statusText.text = "Connecting…";
    this._enterCodeBtn.eventMode = "none";

    try {
      const transport = await PeerTransport.join(code);
      if (!this._active) {
        // Player already cancelled and navigated away before this resolved —
        // tear down the now-orphaned transport instead of proceeding into a
        // match on a screen that's no longer showing.
        transport.close();
        return;
      }
      this._statusText.text = "Connected!";
      this._onConnected?.(transport);
    } catch {
      if (!this._active) return;
      this._statusText.text = "";
      this._errorText.text = "Couldn't connect — check the code and try again.";
      this._enterCodeBtn.eventMode = "static";
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  private _buildUI(): void {
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(COLOR.bgTop);
    this.addChild(bg);

    const title = new Text({
      text: "JOIN MATCH",
      style: { fontFamily: "Minecraft", fontSize: 32, fill: COLOR.title },
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2;
    title.y = 140;
    this.addChild(title);

    this._statusText = new Text({
      text: "",
      style: { fontFamily: "Minecraft", fontSize: 18, fill: COLOR.label },
    });
    this._statusText.anchor.set(0.5, 0);
    this._statusText.x = W / 2;
    this._statusText.y = 280;
    this.addChild(this._statusText);

    this._errorText = new Text({
      text: "",
      style: { fontFamily: "Minecraft", fontSize: 16, fill: COLOR.error },
    });
    this._errorText.anchor.set(0.5, 0);
    this._errorText.x = W / 2;
    this._errorText.y = 320;
    this.addChild(this._errorText);

    this._enterCodeBtn = this._buildButton(
      "ENTER CODE",
      H - 220,
      COLOR.enterCodeBg,
      () => void this._startJoinFlow(),
    );
    this.addChild(this._enterCodeBtn);

    this.addChild(
      this._buildButton("CANCEL", H - 140, COLOR.cancelBg, () =>
        this._onCancel?.(),
      ),
    );
  }

  private _buildButton(
    label: string,
    y: number,
    bgColor: number,
    onClick: () => void,
  ): Container {
    const BTN_W = 200;
    const BTN_H = 48;
    const btn = new Container();
    btn.x = W / 2 - BTN_W / 2;
    btn.y = y;
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.hitArea = new Rectangle(0, 0, BTN_W, BTN_H);

    const bg = new Graphics();
    bg.rect(0, 0, BTN_W, BTN_H).fill(bgColor);
    btn.addChild(bg);

    const lbl = new Text({
      text: label,
      style: { fontFamily: "Minecraft", fontSize: 18, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = BTN_W / 2;
    lbl.y = BTN_H / 2;
    btn.addChild(lbl);

    btn.on("pointerup", (e) => {
      e.stopPropagation();
      sfx.play(SOUND_ALIASES.buttonClick);
      onClick();
    });

    return btn;
  }
}
