import { Container, Graphics, Text } from "pixi.js";
import { engine } from "../engine/instance.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";

// ─── Layout (virtual canvas, matches HomeScreen's 1280×720) ──────────────────

const W = 1280;
const H = 720;

const PANEL = { x: W / 2 - 450, y: H / 2 - 310, w: 900, h: 620 };
const DIAGRAM = { x: 40, y: 96, w: 820, h: 170 };
const BULLETS_Y = 282;
const BULLETS_W = 820;
const DOTS_Y = 548;
const NAV_Y = 566;
const NAV_H = 48;

const COLOR = {
  overlay: 0x000000,
  panelBg: 0x1b315a,
  panelBorder: 0x070b14,
  title: 0xf5b73d,
  label: 0xf6eccf,
  boxBg: 0x142544,
  dotOff: 0x2c4a82,
  dotOn: 0xf5b73d,
  navBg: 0x224488,
  navDisabled: 0x16294d,
};

// ─── Tutorial content ─────────────────────────────────────────────────────────

interface BoxSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  accent: number;
}

interface ArrowSpec {
  x1: number;
  x2: number;
  y: number;
}

interface TutorialPage {
  title: string;
  boxes: BoxSpec[];
  arrows: ArrowSpec[];
  bullets: string[];
}

const GOLD = 0xf5b73d;
const RED = 0xff5566;
const GREEN = 0x55ff77;
const BLUE = 0x2f6fe0;
const ORANGE = 0xe8702a;
const PURPLE = 0xb15be0;
const GRAY = 0x8a8f9c;

const PAGES: TutorialPage[] = [
  {
    title: "TOURNAMENT FORMAT",
    boxes: [
      { x: 40, y: 40, w: 220, h: 90, title: "GROUP STAGE", lines: ["Round-robin matches", "Top teams advance"], accent: BLUE },
      { x: 300, y: 40, w: 220, h: 90, title: "KNOCKOUT", lines: ["Single elimination", "Win or go home"], accent: ORANGE },
      { x: 560, y: 40, w: 220, h: 90, title: "PENALTY SHOOTOUT", lines: ["Decides every", "knockout match"], accent: GOLD },
    ],
    arrows: [
      { x1: 260, x2: 300, y: 85 },
      { x1: 520, x2: 560, y: 85 },
    ],
    bullets: [
      "The World Cup runs through Group Stage → Knockout Stage → Penalty Shootouts.",
      "In the Group Stage, the best teams from each group advance.",
      "Every Knockout match — including the Final — is decided by a Penalty Shootout.",
    ],
  },
  {
    title: "PENALTY BASICS",
    boxes: [
      { x: 25, y: 25, w: 240, h: 120, title: "LEFT", lines: ["Striker can AIM here", "Goalkeeper can DIVE here"], accent: GOLD },
      { x: 290, y: 25, w: 240, h: 120, title: "CENTER", lines: ["Striker can AIM here", "Goalkeeper can DIVE here"], accent: GOLD },
      { x: 555, y: 25, w: 240, h: 120, title: "RIGHT", lines: ["Striker can AIM here", "Goalkeeper can DIVE here"], accent: GOLD },
    ],
    arrows: [],
    bullets: [
      "Each kick: pick LEFT, CENTER or RIGHT — that's where your Striker aims or your Goalkeeper dives.",
      "Choose a card (and optional Active/Power-up cards), then press CONFIRM to take the shot.",
      "If the Striker's side doesn't match the Goalkeeper's side, it's an automatic GOAL — unless the keeper plays Intimidate.",
    ],
  },
  {
    title: "SHOOT & SAVE CARDS",
    boxes: [
      { x: 40, y: 15, w: 220, h: 140, title: "NORMAL", lines: ["Power: +0", "Cooldown: 0 shots", "Always ready"], accent: GRAY },
      { x: 300, y: 15, w: 220, h: 140, title: "SPECIAL", lines: ["Power: +5", "Cooldown: 3 shots"], accent: BLUE },
      { x: 560, y: 15, w: 220, h: 140, title: "EPIC", lines: ["Power: +10", "Cooldown: 5 shots"], accent: PURPLE },
    ],
    arrows: [],
    bullets: [
      "Strikers play SHOOT cards, Goalkeepers play SAVE cards — one per turn from your hand.",
      "When both sides aim/dive the same way, whoever has more power wins the duel.",
      "After playing a card, it goes on cooldown and can't be used again until it ticks down to 0.",
    ],
  },
  {
    title: "ACTIVE CARDS",
    boxes: [
      { x: 40, y: 10, w: 220, h: 150, title: "CHEATING", lines: ["STRIKER ONLY", "Matched side: rolls a", "goal chance"], accent: GOLD },
      { x: 300, y: 10, w: 220, h: 150, title: "INTIMIDATE", lines: ["GOALKEEPER ONLY", "Matched side: rolls a", "miss chance"], accent: RED },
      { x: 560, y: 10, w: 220, h: 150, title: "NULLIFY", lines: ["EITHER PLAYER", "Cancels opponent's", "card power"], accent: GREEN },
    ],
    arrows: [],
    bullets: [
      "Active cards add a tactical twist on top of the power duel — play them alongside your Shoot/Save card.",
      "CHEATING and INTIMIDATE turn the result into a dice roll based on the opponent's card tier.",
      "If both players play Nullify, both cancel out and pure power decides the shot.",
    ],
  },
  {
    title: "HOW A SHOT IS DECIDED",
    boxes: [
      { x: 20, y: 20, w: 180, h: 130, title: "NULLIFY", lines: ["Cancels opponent's", "passive power", "(if played)"], accent: GREEN },
      { x: 220, y: 20, w: 180, h: 130, title: "INTIMIDATE /\nCHEATING", lines: ["Rolls a chance", "(matched sides,", "if played)"], accent: RED },
      { x: 420, y: 20, w: 180, h: 130, title: "POWER COMPARE", lines: ["Higher power", "wins the duel"], accent: BLUE },
      { x: 620, y: 20, w: 180, h: 130, title: "RESULT", lines: ["Striker wins → GOAL", "Tie / GK wins → SAVE"], accent: GOLD },
    ],
    arrows: [
      { x1: 200, x2: 220, y: 85 },
      { x1: 400, x2: 420, y: 85 },
      { x1: 600, x2: 620, y: 85 },
    ],
    bullets: [
      "Mismatched sides = instant GOAL, unless the Goalkeeper has Intimidate ready (then it's a reduced-chance miss roll).",
      "Matched sides: Nullify effects apply first, then any Intimidate/Cheating roll, then leftover power is compared.",
      "If both Intimidate and Cheating fire, they cancel out — power comparison decides the shot.",
      "Ties go to the Goalkeeper: the Striker only scores when their power is strictly higher — equal power means SAVE.",
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export class TutorialScreen extends Container {
  private _pageIdx = 0;
  private _content: Container | null = null;
  private _dots: Graphics[] = [];
  private _prevBtn!: Container;
  private _nextBtn!: Container;

  prepare(): void {
    this.removeChildren();
    this._pageIdx = 0;
    this._dots = [];

    this._buildOverlay();
    const panel = this._buildPanel();
    this.addChild(panel);

    this._renderPage();
  }

  async show(): Promise<void> {}
  async hide(): Promise<void> {}

  reset(): void {
    this.removeChildren();
    this._content = null;
    this._dots = [];
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Build (static chrome) ─────────────────────────────────────────────────

  private _buildOverlay(): void {
    const overlay = new Graphics();
    overlay.rect(0, 0, W, H).fill({ color: COLOR.overlay, alpha: 0.6 });
    this.addChild(overlay);
  }

  private _panel!: Container;

  private _buildPanel(): Container {
    const panel = new Container();
    panel.x = PANEL.x;
    panel.y = PANEL.y;
    this._panel = panel;

    const bg = new Graphics();
    bg.rect(-4, -4, PANEL.w + 8, PANEL.h + 8).fill(COLOR.panelBorder);
    bg.rect(0, 0, PANEL.w, PANEL.h).fill(COLOR.panelBg);
    panel.addChild(bg);

    const title = new Text({
      text: "HOW TO PLAY",
      style: { fontFamily: "Minecraft", fontSize: 28, fill: COLOR.title },
    });
    title.anchor.set(0.5, 0);
    title.x = PANEL.w / 2;
    title.y = 20;
    panel.addChild(title);

    panel.addChild(this._buildDots());
    panel.addChild(this._buildPrevButton());
    panel.addChild(this._buildNextButton());
    panel.addChild(this._buildCloseButton());

    return panel;
  }

  private _buildDots(): Container {
    const row = new Container();
    const spacing = 24;
    const startX = PANEL.w / 2 - ((PAGES.length - 1) * spacing) / 2;

    for (let i = 0; i < PAGES.length; i++) {
      const dot = new Graphics();
      dot.x = startX + i * spacing;
      dot.y = DOTS_Y;
      row.addChild(dot);
      this._dots.push(dot);
    }

    return row;
  }

  private _buildPrevButton(): Container {
    const btn = new Container();
    btn.x = 40;
    btn.y = NAV_Y;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, 140, NAV_H, 6).fill(COLOR.navBg);
    btn.addChild(bg);

    const lbl = new Text({
      text: "< PREV",
      style: { fontFamily: "Minecraft", fontSize: 16, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = 70;
    lbl.y = NAV_H / 2;
    btn.addChild(lbl);

    btn.on("pointerdown", () => {
      if (this._pageIdx === 0) return;
      sfx.play(SOUND_ALIASES.buttonClick);
      this._pageIdx -= 1;
      this._renderPage();
    });

    this._prevBtn = btn;
    return btn;
  }

  private _buildNextButton(): Container {
    const btn = new Container();
    btn.x = PANEL.w - 40 - 140;
    btn.y = NAV_Y;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, 140, NAV_H, 6).fill(COLOR.navBg);
    btn.addChild(bg);

    const lbl = new Text({
      text: "NEXT >",
      style: { fontFamily: "Minecraft", fontSize: 16, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = 70;
    lbl.y = NAV_H / 2;
    btn.addChild(lbl);

    btn.on("pointerdown", () => {
      if (this._pageIdx === PAGES.length - 1) return;
      sfx.play(SOUND_ALIASES.buttonClick);
      this._pageIdx += 1;
      this._renderPage();
    });

    this._nextBtn = btn;
    return btn;
  }

  private _buildCloseButton(): Container {
    const w = 160;
    const btn = new Container();
    btn.x = PANEL.w / 2 - w / 2;
    btn.y = NAV_Y;
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new Graphics();
    bg.roundRect(0, 0, w, NAV_H, 6).fill(COLOR.navBg);
    btn.addChild(bg);

    const lbl = new Text({
      text: "CLOSE",
      style: { fontFamily: "Minecraft", fontSize: 18, fill: 0xffffff },
    });
    lbl.anchor.set(0.5);
    lbl.x = w / 2;
    lbl.y = NAV_H / 2;
    btn.addChild(lbl);

    btn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.dismissPopup();
    });

    return btn;
  }

  // ─── Build (page content) ───────────────────────────────────────────────────

  private _renderPage(): void {
    if (this._content) {
      this._panel.removeChild(this._content);
      this._content = null;
    }

    const page = PAGES[this._pageIdx];
    const content = new Container();

    const subtitle = new Text({
      text: `${this._pageIdx + 1}/${PAGES.length} — ${page.title}`,
      style: { fontFamily: "Minecraft", fontSize: 18, fill: COLOR.label },
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = PANEL.w / 2;
    subtitle.y = 62;
    content.addChild(subtitle);

    const diagram = new Container();
    diagram.x = DIAGRAM.x;
    diagram.y = DIAGRAM.y;
    for (const box of page.boxes) {
      diagram.addChild(this._buildBox(box));
    }
    for (const arrow of page.arrows) {
      diagram.addChild(this._buildArrow(arrow));
    }
    content.addChild(diagram);

    let by = BULLETS_Y;
    for (const bullet of page.bullets) {
      const t = new Text({
        text: `• ${bullet}`,
        style: {
          fontFamily: "Minecraft",
          fontSize: 15,
          fill: COLOR.label,
          wordWrap: true,
          wordWrapWidth: BULLETS_W,
          lineHeight: 20,
        },
      });
      t.x = 40;
      t.y = by;
      content.addChild(t);
      by += t.height + 10;
    }

    this._panel.addChild(content);
    this._content = content;

    this._refreshDots();
    this._refreshNav();
  }

  private _buildBox(box: BoxSpec): Container {
    const c = new Container();
    c.x = box.x;
    c.y = box.y;

    const bg = new Graphics();
    bg.roundRect(0, 0, box.w, box.h, 6).fill(COLOR.boxBg).stroke({ color: box.accent, width: 2 });
    c.addChild(bg);

    const title = new Text({
      text: box.title,
      style: {
        fontFamily: "Minecraft",
        fontSize: 14,
        fill: box.accent,
        align: "center",
        wordWrap: true,
        wordWrapWidth: box.w - 12,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = box.w / 2;
    title.y = 10;
    c.addChild(title);

    let ly = 10 + title.height + 8;
    for (const line of box.lines) {
      const t = new Text({
        text: line,
        style: {
          fontFamily: "Minecraft",
          fontSize: 12,
          fill: COLOR.label,
          align: "center",
          wordWrap: true,
          wordWrapWidth: box.w - 12,
        },
      });
      t.anchor.set(0.5, 0);
      t.x = box.w / 2;
      t.y = ly;
      c.addChild(t);
      ly += t.height + 4;
    }

    return c;
  }

  private _buildArrow(arrow: ArrowSpec): Graphics {
    const g = new Graphics();
    g.moveTo(arrow.x1, arrow.y).lineTo(arrow.x2 - 10, arrow.y).stroke({ color: COLOR.label, width: 2 });
    g.poly([arrow.x2, arrow.y, arrow.x2 - 10, arrow.y - 5, arrow.x2 - 10, arrow.y + 5]).fill(COLOR.label);
    return g;
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  private _refreshDots(): void {
    this._dots.forEach((dot, i) => {
      dot.clear();
      dot.circle(0, 0, 6).fill(i === this._pageIdx ? COLOR.dotOn : COLOR.dotOff);
    });
  }

  private _refreshNav(): void {
    const onFirst = this._pageIdx === 0;
    const onLast = this._pageIdx === PAGES.length - 1;

    this._prevBtn.alpha = onFirst ? 0.4 : 1;
    this._prevBtn.eventMode = onFirst ? "none" : "static";
    (this._prevBtn.getChildAt(0) as Graphics).clear();
    (this._prevBtn.getChildAt(0) as Graphics)
      .roundRect(0, 0, 140, NAV_H, 6)
      .fill(onFirst ? COLOR.navDisabled : COLOR.navBg);

    this._nextBtn.alpha = onLast ? 0.4 : 1;
    this._nextBtn.eventMode = onLast ? "none" : "static";
    (this._nextBtn.getChildAt(0) as Graphics).clear();
    (this._nextBtn.getChildAt(0) as Graphics)
      .roundRect(0, 0, 140, NAV_H, 6)
      .fill(onLast ? COLOR.navDisabled : COLOR.navBg);
  }
}
