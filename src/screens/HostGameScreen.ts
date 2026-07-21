import { Container, Filter, Graphics, Rectangle, Text, Ticker } from "pixi.js";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { PeerTransport } from "../net/PeerTransport.ts";
import { generateRoomCode } from "../net/RoomCode.ts";
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
  code: 0xf5b73d,
  label: 0xf6eccf,
  error: 0xe23b3b,
  cancelBg: 0x6b1f1f,
};

// ─── Screen ───────────────────────────────────────────────────────────────────
// REQ-MULTIPLAYER-HOST-SCREEN: generates a room code and hosts a PeerTransport.
// show() only KICKS OFF the host flow (fire-and-forget) instead of awaiting
// it — Navigation.addAndShowScreen sets `screen.interactiveChildren = false`
// for the full duration of `await screen.show()`, so awaiting the full
// PeerTransport.host() handshake here would leave the CANCEL button
// unresponsive for as long as this screen is waiting for a guest to connect,
// which could be indefinite.
export class HostGameScreen extends Container {
  private _onConnected: ((transport: PeerTransport) => void) | null = null;
  private _onCancel: (() => void) | null = null;
  // Guards against a resolved/rejected PeerTransport.host() call landing
  // after the player already hit CANCEL and this screen was torn down.
  private _active = false;
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;
  private _codeText!: Text;
  private _statusText!: Text;
  private _errorText!: Text;

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

  async show(): Promise<void> {
    void this._host();
  }

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

  // ─── Host flow ────────────────────────────────────────────────────────────

  private async _host(retried = false): Promise<void> {
    const roomCode = generateRoomCode();
    this._codeText.text = roomCode;
    this._statusText.text = "Waiting for opponent…";
    this._errorText.text = "";

    try {
      const transport = await PeerTransport.host({ roomCode });
      if (!this._active) {
        // Player already cancelled and navigated away before this resolved —
        // tear down the now-orphaned transport instead of proceeding into a
        // match on a screen that's no longer showing.
        transport.close();
        return;
      }
      this._statusText.text = "Opponent connected!";
      this._onConnected?.(transport);
    } catch {
      if (!this._active) return;
      // Simplest retry: a fresh room code sidesteps the most common failure
      // (id collision — peerjs "unavailable-id") without extra UI.
      if (!retried) {
        await this._host(true);
        return;
      }
      this._statusText.text = "";
      this._errorText.text = "Couldn't start hosting — please try again.";
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  private _buildUI(): void {
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(COLOR.bgTop);
    this.addChild(bg);

    const title = new Text({
      text: "HOSTING MATCH",
      style: { fontFamily: "Minecraft", fontSize: 32, fill: COLOR.title },
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2;
    title.y = 140;
    this.addChild(title);

    const label = new Text({
      text: "ROOM CODE",
      style: { fontFamily: "Minecraft", fontSize: 16, fill: COLOR.label },
    });
    label.anchor.set(0.5, 0);
    label.x = W / 2;
    label.y = 240;
    this.addChild(label);

    this._codeText = new Text({
      text: "",
      style: {
        fontFamily: "Minecraft",
        fontSize: 56,
        fill: COLOR.code,
        letterSpacing: 8,
      },
    });
    this._codeText.anchor.set(0.5, 0);
    this._codeText.x = W / 2;
    this._codeText.y = 280;
    this.addChild(this._codeText);

    this._statusText = new Text({
      text: "",
      style: { fontFamily: "Minecraft", fontSize: 18, fill: COLOR.label },
    });
    this._statusText.anchor.set(0.5, 0);
    this._statusText.x = W / 2;
    this._statusText.y = 380;
    this.addChild(this._statusText);

    this._errorText = new Text({
      text: "",
      style: { fontFamily: "Minecraft", fontSize: 16, fill: COLOR.error },
    });
    this._errorText.anchor.set(0.5, 0);
    this._errorText.x = W / 2;
    this._errorText.y = 420;
    this.addChild(this._errorText);

    this.addChild(this._buildCancelButton());
  }

  private _buildCancelButton(): Container {
    const btn = new Container();
    const BTN_W = 200;
    const BTN_H = 48;
    btn.x = W / 2 - BTN_W / 2;
    btn.y = H - 140;
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.hitArea = new Rectangle(0, 0, BTN_W, BTN_H);

    const bg = new Graphics();
    bg.rect(0, 0, BTN_W, BTN_H).fill(COLOR.cancelBg);
    btn.addChild(bg);

    const lbl = new Text({
      text: "CANCEL",
      style: { fontFamily: "Minecraft", fontSize: 18, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = BTN_W / 2;
    lbl.y = BTN_H / 2;
    btn.addChild(lbl);

    btn.on("pointerup", (e) => {
      e.stopPropagation();
      sfx.play(SOUND_ALIASES.buttonClick);
      this._onCancel?.();
    });

    return btn;
  }
}
