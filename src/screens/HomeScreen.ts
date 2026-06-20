import { Container, Filter, Graphics, Rectangle, Text, Ticker } from "pixi.js";
import { FlagRenderer } from "./utils/FlagRenderer.ts";
import { makeText } from "./utils/UIComponents.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { engine } from "../engine/instance.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { SettingsScreen } from "./SettingsScreen.ts";
import { TutorialScreen } from "./TutorialScreen.ts";

// ─── Layout ──────────────────────────────────────────────────────────────────

const W = 1280;
const H = 720;
const SPLIT_Y = 340; // divides stadium top from pitch bottom

// ─── Pending slot ─────────────────────────────────────────────────────────────

let _pendingOnStart: (() => void) | null = null;

export function setPendingOnStart(cb: () => void): void {
  _pendingOnStart = cb;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export class HomeScreen extends Container {
  private _onStart: (() => void) | null = null;
  private _crtFilter: Filter | null = null;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private _startClickHandler: (() => void) | null = null;
  private _footerTicker: ((t: Ticker) => void) | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;

  constructor() {
    super();
  }

  prepare(): void {
    this._onStart = _pendingOnStart;
    _pendingOnStart = null;
    this._buildUI();

    this._keyHandler = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") this._onStart?.();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._keyHandler);
    }
  }

  async show(): Promise<void> {}

  async hide(): Promise<void> {}

  reset(): void {
    if (this._keyHandler && typeof window !== "undefined") {
      window.removeEventListener("keydown", this._keyHandler);
    }
    this._keyHandler = null;
    if (this._startClickHandler) {
      this.off("pointerup", this._startClickHandler);
      this._startClickHandler = null;
    }
    if (this._footerTicker) {
      Ticker.shared.remove(this._footerTicker);
      this._footerTicker = null;
    }
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.removeChildren();
    this.filters = [];
    this._onStart = null;
    this._crtFilter = null;
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  private _buildUI(): void {
    this._buildBackground();
    this._buildFloodlight(140, false);
    this._buildFloodlight(1140, true);
    this._buildTitle();
    this._buildNationTabs();
    this._buildMenu();
    this._buildPitch();
    this._buildFooter();
    this._buildSettingsButton();
    this._buildTutorialButton();
    this._buildClickToStart();

    // CRT filter — requires WebGL; skipped gracefully in non-browser environments
    try {
      this._crtFilter = createCRTFilter();
      this.filters = [this._crtFilter];
      if (typeof requestAnimationFrame !== "undefined") {
        this._crtTicker = (t: Ticker) => {
          if (!this._crtFilter) return;
          const u = this._crtFilter.resources["crtUniforms"] as { uniforms: { uTime: number } };
          u.uniforms.uTime += t.deltaMS / 1000;
        };
        Ticker.shared.add(this._crtTicker);
      }
    } catch {
      // no WebGL context (test runner) — skip filter
    }
  }

  // ─── Click anywhere to start ─────────────────────────────────────────────
  // Settings/tutorial buttons and the menu item stop propagation on their own
  // pointerup so a click on them doesn't also bubble up and trigger start.

  private _buildClickToStart(): void {
    this.eventMode = "static";
    this.hitArea = new Rectangle(0, 0, W, H);
    this._startClickHandler = () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      this._onStart?.();
    };
    this.on("pointerup", this._startClickHandler);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private _buildBackground(): void {
    // Navy top band
    const top = new Graphics();
    top.rect(0, 0, W, SPLIT_Y).fill(0x0a1120);
    this.addChild(top);
  }

  // ─── Floodlights ─────────────────────────────────────────────────────────

  private _buildFloodlight(cx: number, mirrorLamps: boolean): void {
    const POLE_W = 8;
    const POLE_TOP = 45;
    const POLE_BOT = 330;
    const ARM_W = 120;
    const ARM_H = 12;
    const ARM_Y = 32;
    const POLE_COLOR = 0x2c4a82;

    const armX = mirrorLamps ? cx - ARM_W : cx;

    // Glow spill (rendered first, behind structure)
    const glow = new Graphics();
    glow
      .rect(armX, ARM_Y + ARM_H, ARM_W, 35)
      .fill({ color: 0xf5c531, alpha: 0.07 });
    this.addChild(glow);

    const g = new Graphics();

    // Pole
    g.rect(cx - POLE_W / 2, POLE_TOP, POLE_W, POLE_BOT - POLE_TOP).fill(
      POLE_COLOR,
    );

    // Pole base (wider foot)
    g.rect(cx - 14, POLE_BOT - 6, 28, 18).fill(0x1a2e5a);

    // Lamp arm (extends inward toward pitch center)
    g.rect(armX, ARM_Y, ARM_W, ARM_H).fill(POLE_COLOR);

    // Diagonal support brace: arm outer tip → mid-pole
    const braceX = mirrorLamps ? armX : armX + ARM_W;
    g.moveTo(braceX, ARM_Y + ARM_H / 2)
      .lineTo(cx, 145)
      .stroke({ color: POLE_COLOR, width: 3 });

    // 6 lamps sitting on top of arm
    const LAMP_W = 16,
      LAMP_H = 12,
      LAMP_GAP = 3;
    const totalLampW = 6 * LAMP_W + 5 * LAMP_GAP;
    const lampStartX = armX + (ARM_W - totalLampW) / 2;
    for (let i = 0; i < 6; i++) {
      const lx = lampStartX + i * (LAMP_W + LAMP_GAP);
      g.rect(lx, ARM_Y + ARM_H, LAMP_W, LAMP_H).fill(0xf5c531);
    }

    this.addChild(g);
  }

  // ─── Title block ─────────────────────────────────────────────────────────

  private _buildTitle(): void {
    const star = makeText("★   PENALTY   ★", "body", 22, 0xcdbf9a);
    star.anchor.set(0.5, 0);
    star.x = W / 2;
    star.y = 58;
    this.addChild(star);

    const main = new Text({
      text: "WORLD CUP",
      style: {
        fontFamily: "Minecraft",
        fontSize: 62,
        fill: 0xf5b73d,
        align: "center",
        letterSpacing: 6,
      },
    });
    main.anchor.set(0.5, 0);
    main.x = W / 2;
    main.y = 96;
    this.addChild(main);

    const year = makeText("2 0 2 6", "body", 44, 0xf6eccf);
    year.anchor.set(0.5, 0);
    year.x = W / 2;
    year.y = 218;
    this.addChild(year);
  }

  // ─── Nation tabs ─────────────────────────────────────────────────────────

  private _buildNationTabs(): void {
    const tabs = [
      {
        label: "USA",
        flagSpec: { v: ["red", "white", "blue"] as ["red", "white", "blue"] },
        active: false,
      },
      {
        label: "MEX",
        flagSpec: {
          v: ["dgreen", "white", "red"] as ["dgreen", "white", "red"],
        },
        active: false,
      },
      {
        label: "CAN",
        flagSpec: { v: ["red", "white", "red"] as ["red", "white", "red"] },
        active: false,
      },
      { label: "48 NATIONS", flagSpec: null, active: true },
    ];

    const tabW = 160;
    const tabH = 40;
    const gap = 8;
    const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const tabY = 278;

    tabs.forEach((tab, i) => {
      const c = new Container();
      c.x = startX + i * (tabW + gap);
      c.y = tabY;
      c.eventMode = "none";

      const bg = new Graphics();
      const bgColor = tab.active ? 0xf5b73d : 0x1b315a;
      const textColor = tab.active ? 0x17171f : 0xf6eccf;
      bg.rect(0, 0, tabW, tabH).fill(bgColor);
      // 2px ink border
      bg.rect(0, 0, tabW, 2).fill(0x070b14);
      bg.rect(0, tabH - 2, tabW, 2).fill(0x070b14);
      bg.rect(0, 0, 2, tabH).fill(0x070b14);
      bg.rect(tabW - 2, 0, 2, tabH).fill(0x070b14);
      c.addChild(bg);

      let labelX = tabW / 2;

      if (tab.flagSpec) {
        const flag = FlagRenderer.make(tab.flagSpec, 28, 18);
        flag.x = 10;
        flag.y = (tabH - 18) / 2;
        c.addChild(flag);
        labelX = tabW / 2 + 14;
      }

      const lbl = makeText(tab.label, "body", 16, textColor);
      lbl.anchor.set(0.5, 0.5);
      lbl.x = labelX;
      lbl.y = tabH / 2;
      c.addChild(lbl);

      this.addChild(c);
    });
  }

  // ─── Menu ─────────────────────────────────────────────────────────────────

  private _buildMenu(): void {
    const menuX = W / 2 - 80;
    const items = [
      { text: "START TOURNAMENT", y: 355, dim: false, active: true },
      { text: "CONTINUE", y: 407, dim: true, active: false },
      { text: "EXIT", y: 455, dim: true, active: false },
    ];

    // Arrow selector for active item
    const arrow = makeText("►", "body", 22, 0xf5b73d);
    arrow.anchor.set(1, 0.5);
    arrow.x = menuX - 12;
    arrow.y = items[0].y + 11;
    this.addChild(arrow);

    items.forEach((item) => {
      const color = item.dim ? 0x6b5e47 : 0xf6eccf;
      const lbl = makeText(item.text, "body", 22, color);
      lbl.anchor.set(0, 0.5);
      lbl.x = menuX;
      lbl.y = item.y + 11;

      if (item.active) {
        lbl.eventMode = "static";
        lbl.cursor = "pointer";
        lbl.hitArea = new Rectangle(-20, -24, 400, 48);
        lbl.on("pointerup", (e) => {
          e.stopPropagation();
          sfx.play(SOUND_ALIASES.buttonClick);
          this._onStart?.();
        });
      }

      this.addChild(lbl);
    });
  }

  // ─── Pitch ────────────────────────────────────────────────────────────────

  private _buildPitch(): void {
    // ── 1. Base green fill ──────────────────────────────────────────────────
    const pitch = new Graphics();
    pitch.rect(0, SPLIT_Y, W, H - SPLIT_Y).fill(0x2f8f43);
    this.addChild(pitch);

    // ── 2. Grass stripes (vertical bands, perpendicular to goal line) ────────
    const stripes = new Graphics();
    const stripeW = W / 10;
    for (let i = 0; i < 10; i++) {
      const sx = i * stripeW;
      const color = i % 2 === 0 ? 0x2f8f43 : 0x348f49;
      stripes.rect(sx, SPLIT_Y, stripeW, H - SPLIT_Y).fill(color);
    }
    this.addChild(stripes);

    // ── 3. Field markings ───────────────────────────────────────────────────
    const MARK_COLOR = 0x7fd089;
    const MARK_STROKE = { color: MARK_COLOR, width: 2 };

    const GOAL_LINE_Y = SPLIT_Y + 18;
    const GOAL_L = 490;
    const GOAL_R = 790;
    const GOAL_BACK_Y = GOAL_LINE_Y + 30;

    const SIX_L = 420;
    const SIX_R = 860;
    const SIX_BOTTOM_Y = GOAL_LINE_Y + 70;

    const BOX_L = 270;
    const BOX_R = 1010;
    const BOX_BOTTOM_Y = GOAL_LINE_Y + 170;

    const SPOT_X = W / 2;
    const SPOT_Y = (BOX_BOTTOM_Y + SIX_BOTTOM_Y) / 2;

    const marks = new Graphics();
    marks.alpha = 0.55;

    // 18-yard box (penalty box)
    marks
      .moveTo(BOX_L, GOAL_LINE_Y)
      .lineTo(BOX_L, BOX_BOTTOM_Y)
      .lineTo(BOX_R, BOX_BOTTOM_Y)
      .lineTo(BOX_R, GOAL_LINE_Y)
      .stroke(MARK_STROKE);

    // 6-yard box
    marks
      .moveTo(SIX_L, GOAL_LINE_Y)
      .lineTo(SIX_L, SIX_BOTTOM_Y)
      .lineTo(SIX_R, SIX_BOTTOM_Y)
      .lineTo(SIX_R, GOAL_LINE_Y)
      .stroke(MARK_STROKE);

    // Full-width goal line
    marks.moveTo(0, GOAL_LINE_Y).lineTo(W, GOAL_LINE_Y).stroke(MARK_STROKE);

    // Penalty spot
    marks.circle(SPOT_X, SPOT_Y, 4).fill(MARK_COLOR);

    // Penalty arc — D-shape outside the big box, centered on its bottom line
    const ARC_R = 75;
    marks
      .moveTo(SPOT_X - ARC_R, BOX_BOTTOM_Y)
      .arc(SPOT_X, BOX_BOTTOM_Y, ARC_R, Math.PI, 0, true)
      .stroke(MARK_STROKE);

    this.addChild(marks);

    // ── 4. Goal ──────────────────────────────────────────────────────────────
    const goal = new Graphics();
    goal
      .rect(GOAL_L, GOAL_LINE_Y, GOAL_R - GOAL_L, GOAL_BACK_Y - GOAL_LINE_Y)
      .fill({ color: 0x1a6b2f, alpha: 0.6 });

    const netG = new Graphics();
    netG.alpha = 0.35;
    const NET_COLS = 5;
    const NET_ROWS = 3;
    const netW = GOAL_R - GOAL_L;
    const netH = GOAL_BACK_Y - GOAL_LINE_Y;
    for (let c = 1; c < NET_COLS; c++) {
      const nx = GOAL_L + (netW / NET_COLS) * c;
      netG
        .moveTo(nx, GOAL_LINE_Y)
        .lineTo(nx, GOAL_BACK_Y)
        .stroke({ color: 0xe8e8e8, width: 1 });
    }
    for (let r = 1; r < NET_ROWS; r++) {
      const ny = GOAL_LINE_Y + (netH / NET_ROWS) * r;
      netG
        .moveTo(GOAL_L, ny)
        .lineTo(GOAL_R, ny)
        .stroke({ color: 0xe8e8e8, width: 1 });
    }
    this.addChild(goal);
    this.addChild(netG);

    const goalFrame = new Graphics();
    goalFrame.alpha = 0.9;
    const FRAME_STROKE = { color: 0xf6eccf, width: 3 };
    goalFrame
      .moveTo(GOAL_L, GOAL_LINE_Y)
      .lineTo(GOAL_L, GOAL_BACK_Y)
      .stroke(FRAME_STROKE);
    goalFrame
      .moveTo(GOAL_R, GOAL_LINE_Y)
      .lineTo(GOAL_R, GOAL_BACK_Y)
      .stroke(FRAME_STROKE);
    goalFrame
      .moveTo(GOAL_L, GOAL_LINE_Y)
      .lineTo(GOAL_R, GOAL_LINE_Y)
      .stroke({ color: 0xf6eccf, width: 4 });
    goalFrame
      .moveTo(GOAL_L, GOAL_BACK_Y)
      .lineTo(GOAL_R, GOAL_BACK_Y)
      .stroke({ color: 0xf6eccf, width: 2 });
    this.addChild(goalFrame);

    // ── 5. Ball ──────────────────────────────────────────────────────────────
    const ball = new Graphics();
    ball.circle(W / 2, H - 60, 10).fill(0xf6eccf);
    ball.circle(W / 2, H - 60, 10).stroke({ color: 0x070b14, width: 2 });
    this.addChild(ball);
  }

  // ─── Footer ───────────────────────────────────────────────────────────────

  private _buildFooter(): void {
    const footer = makeText("PRESS ENTER FOR STARTING", "body", 18, 0xc8921a);
    footer.anchor.set(0.5, 1);
    footer.x = W / 2;
    footer.y = H - 8;
    this.addChild(footer);

    if (typeof requestAnimationFrame !== "undefined") {
      let elapsed = 0;
      this._footerTicker = (t: Ticker) => {
        elapsed += t.deltaMS;
        footer.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed / 550));
      };
      Ticker.shared.add(this._footerTicker);
    }
  }

  // ─── Settings button ──────────────────────────────────────────────────────

  private _buildSettingsButton(): void {
    const cx = W - 36;
    const cy = 36;
    const gear = new Graphics();

    // Teeth: 8 small rectangles around the outer ring
    const TEETH = 8;
    const outerR = 14;
    const toothW = 6;
    const toothH = 5;
    for (let i = 0; i < TEETH; i++) {
      const angle = (i / TEETH) * Math.PI * 2;
      const tx = cx + Math.cos(angle) * outerR;
      const ty = cy + Math.sin(angle) * outerR;
      gear.rect(tx - toothW / 2, ty - toothH / 2, toothW, toothH).fill(0xf6eccf);
    }

    // Body + hole
    gear.circle(cx, cy, outerR - 2).fill(0xf6eccf);
    gear.circle(cx, cy, 5).fill(0x0a1120);

    gear.eventMode = "static";
    gear.cursor = "pointer";
    gear.hitArea = new Rectangle(cx - 24, cy - 24, 48, 48);
    gear.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.presentPopup(SettingsScreen);
    });
    gear.on("pointerup", (e) => e.stopPropagation());

    this.addChild(gear);
  }

  // ─── Tutorial button ────────────────────────────────────────────────────────

  private _buildTutorialButton(): void {
    const cx = W - 84;
    const cy = 36;

    const icon = new Graphics();
    icon.circle(cx, cy, 16).fill(0xf6eccf);
    icon.eventMode = "static";
    icon.cursor = "pointer";
    icon.hitArea = new Rectangle(cx - 24, cy - 24, 48, 48);
    icon.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.presentPopup(TutorialScreen);
    });
    icon.on("pointerup", (e) => e.stopPropagation());
    this.addChild(icon);

    const mark = new Text({
      text: "?",
      style: { fontFamily: "Minecraft", fontSize: 20, fill: 0x0a1120 },
    });
    mark.anchor.set(0.5);
    mark.x = cx;
    mark.y = cy + 1;
    this.addChild(mark);
  }
}
