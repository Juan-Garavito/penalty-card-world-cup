import { Container, Filter, Graphics, Text, Ticker } from "pixi.js";
import { engine } from "../engine/instance.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";

// ─── Layout (virtual canvas, matches HomeScreen's 1280×720) ──────────────────

const W = 1280;
const H = 720;

const PANEL = { x: W / 2 - 260, y: H / 2 - 180, w: 520, h: 360 };

const COLOR = {
  overlay: 0x000000,
  panelBg: 0x1b315a,
  panelBorder: 0x070b14,
  title: 0xf5b73d,
  hostBg: 0x224488,
  joinBg: 0x1a6b2f,
  closeBg: 0x6b1f1f,
};

// ─── Pending slots ────────────────────────────────────────────────────────────

let _pendingOnHost: (() => void) | null = null;
let _pendingOnJoin: (() => void) | null = null;

export function setPendingOnHost(cb: () => void): void {
  _pendingOnHost = cb;
}

export function setPendingOnJoin(cb: () => void): void {
  _pendingOnJoin = cb;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
// REQ-MULTIPLAYER-ONLINE-MENU: a popup (presented via engine.navigation.
// presentPopup, like SettingsScreen) offering HOST GAME / JOIN GAME. Both
// buttons explicitly dismiss this popup BEFORE invoking their pending
// callback: main.ts's goToHostGame()/goToJoinGame() call
// engine.navigation.showScreen(...), which per navigation.ts only ever
// touches `currentScreen`, never `currentPopup` — leaving this popup
// registered as `currentPopup` while a full screen is shown underneath
// would be exactly the kind of stale-state bug this codebase's screen
// lifecycle otherwise avoids (dismissPopup() also re-enables/resumes
// whatever `currentScreen` is at the time, which is harmless here since
// showScreen() immediately replaces it).
export class OnlineMenuScreen extends Container {
  private _onHost: (() => void) | null = null;
  private _onJoin: (() => void) | null = null;
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;

  prepare(): void {
    this._onHost = _pendingOnHost;
    _pendingOnHost = null;
    this._onJoin = _pendingOnJoin;
    _pendingOnJoin = null;

    this.removeChildren();
    this._buildOverlay();
    const panel = this._buildPanel();
    this.addChild(panel);

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
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.filters = [];
    this._crtFilter = null;
    this.removeChildren();
    this._onHost = null;
    this._onJoin = null;
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  private _buildOverlay(): void {
    const overlay = new Graphics();
    overlay.rect(0, 0, W, H).fill({ color: COLOR.overlay, alpha: 0.6 });
    this.addChild(overlay);
  }

  private _buildPanel(): Container {
    const panel = new Container();
    panel.x = PANEL.x;
    panel.y = PANEL.y;

    const bg = new Graphics();
    bg.rect(-4, -4, PANEL.w + 8, PANEL.h + 8).fill(COLOR.panelBorder);
    bg.rect(0, 0, PANEL.w, PANEL.h).fill(COLOR.panelBg);
    panel.addChild(bg);

    const title = new Text({
      text: "PLAY ONLINE",
      style: { fontFamily: "Minecraft", fontSize: 28, fill: COLOR.title },
    });
    title.anchor.set(0.5, 0);
    title.x = PANEL.w / 2;
    title.y = 24;
    panel.addChild(title);

    panel.addChild(
      this._buildButton("HOST GAME", 120, COLOR.hostBg, () => {
        sfx.play(SOUND_ALIASES.buttonClick);
        // Capture BEFORE dismissing — dismissPopup() synchronously runs
        // reset() (which nulls this._onHost) before its own promise
        // resolves, so reading `this._onHost` inside .then() would always
        // see null and silently no-op.
        const onHost = this._onHost;
        void engine.navigation.dismissPopup().then(() => onHost?.());
      }),
    );
    panel.addChild(
      this._buildButton("JOIN GAME", 190, COLOR.joinBg, () => {
        sfx.play(SOUND_ALIASES.buttonClick);
        const onJoin = this._onJoin;
        void engine.navigation.dismissPopup().then(() => onJoin?.());
      }),
    );
    panel.addChild(this._buildCloseButton());

    return panel;
  }

  private _buildButton(
    label: string,
    y: number,
    bgColor: number,
    onClick: () => void,
  ): Container {
    const btn = new Container();
    btn.x = PANEL.w / 2 - 160;
    btn.y = y;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.rect(0, 0, 320, 48).fill(bgColor);
    btn.addChild(bg);

    const lbl = new Text({
      text: label,
      style: { fontFamily: "Minecraft", fontSize: 18, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = 160;
    lbl.y = 24;
    btn.addChild(lbl);

    btn.on("pointerdown", onClick);

    return btn;
  }

  private _buildCloseButton(): Container {
    const btn = new Container();
    btn.x = PANEL.w / 2 - 80;
    btn.y = PANEL.h - 64;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.rect(0, 0, 160, 48).fill(COLOR.closeBg);
    btn.addChild(bg);

    const lbl = new Text({
      text: "CLOSE",
      style: { fontFamily: "Minecraft", fontSize: 18, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = 80;
    lbl.y = 24;
    btn.addChild(lbl);

    btn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.dismissPopup();
    });

    return btn;
  }
}
