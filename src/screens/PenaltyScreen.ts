import {
  BlurFilter,
  Container,
  Filter,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
  Ticker,
} from "pixi.js";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { engine } from "../engine/instance.ts";
import { TutorialScreen } from "./TutorialScreen.ts";
import { SettingsScreen } from "./SettingsScreen.ts";
import type { PenaltyPresenter, PenaltyViewModel } from "./PenaltyPresenter.ts";
import type {
  PenaltySpriteBundle,
  ScorePanelTextures,
  StandLayers,
} from "./sprites/loadPenaltySprites.ts";
import { crowdGridDims, hairIndexForCell } from "./sprites/crowdLayout.ts";
import { LayeredCharacter } from "./components/LayeredCharacter.ts";
import { PenaltyAnimation } from "./PenaltyAnimation.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { PassiveCard } from "../entities/Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../entities/Cards/active/ActiveCard.ts";
import { CheatingCard } from "../entities/Cards/active/CheatingCard.ts";
import {
  IntimidateCard,
  INTIMIDATE_MISMATCH_PENALTY,
} from "../entities/Cards/active/IntimidateCard.ts";
import { NullifyCard } from "../entities/Cards/active/NullifyCard.ts";
import { TIER_STATS } from "../entities/Cards/Tier.ts";
import type { Card } from "../entities/Cards/Card.ts";
import { cardArtUrl } from "./sprites/cardArt.ts";

// ─── LAYOUT constants (virtual canvas 768×1024) ───────────────────────────────
// Top-down soccer view: goal at the top, striker at the bottom firing upward.

const LAYOUT = {
  CANVAS_W: 768,
  CANVAS_H: 1024,

  // Score band (top ~10%)
  SCORE: { x: 0, y: 0, w: 768, h: 102 },

  // Top-down field (~50%)
  PLAYER_AREA: { x: 0, y: 102, w: 768, h: 600 },

  // Goal outline (top of the field). Drawn as a wireframe rectangle.
  // Fallback only — replaced by the real pitch sprite once it's installed.
  GOAL_FRAME: { x: 220, y: 140, w: 328, h: 140, color: 0x33aa66, stroke: 3 },
  // Real pitch/goal sprite (goal posts + grass). Native art is 104×62, rendered
  // bigger so it reads clearly. Positioned by its center (anchor 0.5) just BELOW
  // the stands (fans + horizontal wall) so it never overlaps the crowd. cy is
  // derived from the stands layout:
  //   (standsTopFrac + fansBandFrac)*1024 + 62*scale (wall) + 62*scale/2
  //   = 256 + 111.6 + 55.8 ≈ 423
  GOAL: { cx: 384, cy: 400, scaleX: 3.8, scaleY: 4.6 },

  // Environment (screen-space background, laid out from the real renderer size
  // so the pixel-art tiles instead of stretching). Grass color is sampled from
  // the goal sprite's own grass so there's no seam.
  ENV: {
    grassColor: "#2f8f43",
    standsTopFrac: 0.03, // stands band starts just below the score bar
    fansBandFrac: 0.22, // fan-rows band height as a fraction of h
    wallFrac: 0.2, // horizontal wall height — independent of goal scale
    crowdRows: 3, // fan rows in the band
  },
  // Crowd shirt tints per team. The shirt art is green, so tint (multiply) can't
  // produce pure team colours — these are SOFT warm/cool washes that read as two
  // distinct hinchadas without muddying the green.
  TEAM_COLORS: { human: 0xffc080, ai: 0x80c0ff },

  // Keeper sits inside the goal mouth, ball in midfield, striker bottom-center.
  // Pushed down so they sit on the field, below the stands+wall (see GOAL.cy).
  KEEPER_POS: { x: 384, y: 440 },
  BALL_POS: { x: 384, y: 580 },
  STRIKER_POS: { x: 384, y: 660 },
  CHARACTER_SCALE: 4,
  KEEPER_SCALE: 3.5, // keeper a bit smaller than the striker
  BALL_RADIUS: 20,

  // Ball flight targets — goal scaleX 3.8 → ~395px wide, center 384,
  // left edge ≈186, right ≈582. Thirds at ~249 / 384 / 519.
  BALL_TARGET_LEFT: { x: 249, y: 410 },
  BALL_TARGET_CENTER: { x: 384, y: 410 },
  BALL_TARGET_RIGHT: { x: 519, y: 410 },

  // Ground markings (penalty box + goal line + spot) drawn as vector lines
  // directly on playerArea, so they scale with the screen like everything
  // else in this container — no resize-time recomputation needed. The goal
  // posts/net themselves are the real sprite (LAYOUT.GOAL); this box just
  // frames the goal mouth + keeper + spot, like a real penalty area.
  PITCH_BOX: { x: 150, y: 488, w: 468, h: 200 },
  PITCH_LINE_COLOR: 0xffffff,
  PENALTY_SPOT_RADIUS: 5,

  // Side picker — three zones spanning the full goal mouth width (395px).
  // Each zone 118px wide; together they cover 3×118=354px centred on 384.
  GOAL_ZONE_SIZE: { w: 88, h: 148 },
  GOAL_ZONES: {
    left: { x: 230, y: 340 },
    center: { x: 345, y: 340 },
    right: { x: 457, y: 340 },
  },

  // Hand (bottom) — passives on the left half, actives on the right half.
  // Cards are laid out flat with overlap; hover lifts a card above the rest.
  HAND: {
    cardW: 85,
    cardH: 118,
    gap: -28, // negative = overlap between cards
    y: 900, // vertical centre of all cards
    zoneW: 378, // width of each half-zone (2 × zoneW + divider = 768)
    divider: 12, // gap between the two zones
  },

  // Tooltip bubble shown on card hover
  TOOLTIP: { w: 300, h: 120, pad: 14 },

  // Confirm button — centred horizontally at the bottom
  CONFIRM_BTN: { x: 299, y: 952, w: 170, h: 52 },

  // Card duel panel (during revealing, sidesMatched=true) — used to centre the
  // duel sprites/VS marker; backgrounds (drawn in _drawDuelBackground /
  // _onDuelClash / _buildDarkenOverlay / _buildResultPanel) cover the full
  // CANVAS_W × CANVAS_H screen.
  DUEL_PANEL: { x: 24, y: 110, w: 720, h: 600 },
  DUEL_CARD_HUMAN: { x: 60, y: 150, w: 280, h: 380 },
  DUEL_CARD_AI: { x: 428, y: 150, w: 280, h: 380 },

  // Result panel
  RESULT_TEXT: { x: 384, y: 470 },
  NEXT_BTN: { x: 284, y: 580, w: 200, h: 60 },

  // Game over panel
  GAME_OVER_PANEL: { x: 0, y: 320, w: 768, h: 360 },
  GAME_OVER_TEXT: { x: 384, y: 400 },
  WINNER_TEXT: { x: 384, y: 490 },
  FINAL_SCORE_TEXT: { x: 384, y: 580 },
} as const;

// ─── First-time tutorial ────────────────────────────────────────────────────
// Auto-opens the same rules popup HomeScreen's "?" button shows, once, the
// first time the player ever reaches a penalty shootout — covers onboarding
// for shooting, keeper saves, and active/passive card rules without a new
// in-screen tooltip system.

const PENALTY_TUTORIAL_SEEN_KEY = "penaltyWC.seenPenaltyTutorial";

function hasSeenPenaltyTutorial(): boolean {
  try {
    return localStorage.getItem(PENALTY_TUTORIAL_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

function markPenaltyTutorialSeen(): void {
  try {
    localStorage.setItem(PENALTY_TUTORIAL_SEEN_KEY, "true");
  } catch {
    // private browsing / storage disabled — just skip persisting
  }
}

// ─── Pending slots (BigPool / no-arg prepare() pattern) ────────────────────────

let _pendingPresenter: PenaltyPresenter | null = null;
let _pendingSpriteBundle: PenaltySpriteBundle | null = null;
let _pendingCardTextures: Map<string, Texture> | null = null;
let _pendingOnMatchComplete: (() => void) | null = null;
let _pendingHumanKitColor: number | null = null;
let _pendingHumanKeeperColor: number | null = null;
let _pendingAiKitColor: number | null = null;
let _pendingAiKeeperColor: number | null = null;
let _pendingHumanTeamAbbr: string | null = null;
let _pendingAiTeamAbbr: string | null = null;

export function setPendingPresenter(presenter: PenaltyPresenter): void {
  _pendingPresenter = presenter;
}

export function setPendingTeamColors(
  humanKit: number,
  humanKeeper: number,
  aiKit: number,
  aiKeeper: number,
): void {
  _pendingHumanKitColor = humanKit;
  _pendingHumanKeeperColor = humanKeeper;
  _pendingAiKitColor = aiKit;
  _pendingAiKeeperColor = aiKeeper;
}

export function setPendingSpriteBundle(bundle: PenaltySpriteBundle): void {
  _pendingSpriteBundle = bundle;
}

export function setPendingTeamNames(human: string, ai: string): void {
  _pendingHumanTeamAbbr = human;
  _pendingAiTeamAbbr = ai;
}

export function setPendingCardTextures(textures: Map<string, Texture>): void {
  _pendingCardTextures = textures;
}

export function setPendingOnMatchComplete(cb: () => void): void {
  _pendingOnMatchComplete = cb;
}

// Per-card hover tween state, driven each frame from update().
interface HoverState {
  container: Container;
  glow: Graphics;
  baseX: number;
  baseY: number;
  baseRot: number; // resting rotation inside the fan
  baseIndex: number; // resting zIndex (fan overlap order)
  selectedGlow: number; // persistent glow alpha when the card is selected
  w: number;
  h: number;
  cur: number; // 0 (rest) .. 1 (fully hovered)
  target: number;
  lift: number;
  maxScale: number;
}

// ─── PenaltyScreen ────────────────────────────────────────────────────────────

export class PenaltyScreen extends Container {
  public scoreDisplay!: Container;
  public playerArea!: Container;
  public sidePicker!: Container;
  public cardRow!: Container;
  public actionRow!: Container;
  public confirmButton!: Container;
  public duelPanel!: Container;
  public darkenOverlay!: Container;
  public resultPanel!: Container;
  public gameOverPanel!: Container;

  private _presenter: PenaltyPresenter | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _onMatchComplete: (() => void) | null = null;
  private _strikerChar: LayeredCharacter | null = null;
  private _keeperChar: LayeredCharacter | null = null;
  private _ballSprite!: Sprite;

  // Screen-space stadium background (grass + crowd grid + central wall). Laid
  // out from the real renderer size so the pixel-art tiles instead of stretching.
  private _environment: Container | null = null;
  private _grassBg: Graphics | null = null;
  private _crowd: Container | null = null; // holds the grid of composed fans
  private _divider: TilingSprite | null = null; // central wall between hinchadas
  private _wall: TilingSprite | null = null; // horizontal wall below the fans
  private _topWall: TilingSprite | null = null; // wall strip above the fans (fills the gap)
  private _standTextures: StandLayers | null = null; // refs to rebuild the grid
  private _humanShirts: Sprite[] = []; // tintable shirts, left hinchada
  private _aiShirts: Sprite[] = []; // tintable shirts, right hinchada
  private _crowdTints: { human: number; ai: number } = {
    human: LAYOUT.TEAM_COLORS.human,
    ai: LAYOUT.TEAM_COLORS.ai,
  };
  private _gridKey: string | null = null; // cached cols×rows to avoid rebuild churn
  private _humanKitColor = 0xffffff;
  private _humanKeeperColor = 0xffffff;
  private _aiKitColor = 0xffffff;
  private _aiKeeperColor = 0xffffff;
  private _currentHumanRole: "striker" | "goalkeeper" = "striker";
  private _humanTeamAbbr = "YOU";
  private _aiTeamAbbr = "AI";

  // Scoreboard panel mounted on the stadium wall, composed from 4 layered
  // 164×82 textures: panel (frame + two empty windows), resultado (the two
  // dark digit-display boxes), equipo1/equipo2 (nameplate strips below them).
  private _scorePanel: Container | null = null;
  private _scorePanelHomeTxt!: Text;
  private _scorePanelAwayTxt!: Text;
  // Blurred duplicates rendered behind the score digits for a glowing
  // digital-display look — kept in sync with the sharp text in _render.
  private _scorePanelHomeGlowTxt!: Text;
  private _scorePanelAwayGlowTxt!: Text;
  private _scorePanelHomeNameTxt!: Text;
  private _scorePanelAwayNameTxt!: Text;

  private _animation: PenaltyAnimation | null = null;
  private _lastPhase: PenaltyViewModel["phase"] | null = null;
  private _coinSprite: Sprite | null = null;
  private _coinFrames: [Texture, Texture] | null = null;

  private _adsLeftTxt!: Text;
  private _resultTxt!: Text;
  private _gameOverTxt!: Text;
  private _winnerTxt!: Text;
  private _finalScoreTxt!: Text;

  // Duel panel background layers (redrawn in _refreshDuelBackground on prepare())
  private _duelBgLeft!: Graphics;
  private _duelBgRight!: Graphics;
  private _duelLines!: Graphics;
  private _duelBgFlash!: Graphics;

  // Duel panel card sprites (the actual cards that were played)
  private _duelHumanSprite!: Sprite;
  private _duelAiSprite!: Sprite;
  private _duelHumanActiveSprite!: Sprite;
  private _duelAiActiveSprite!: Sprite;
  private _vsTxt!: Text;

  // Card artwork (url -> Texture), hover tweens, and the shared tooltip bubble
  private _cardTextures: Map<string, Texture> = new Map();
  private _hoverables: HoverState[] = [];
  private _sideZones: {
    side: "left" | "center" | "right";
    gfx: Graphics;
    w: number;
    h: number;
  }[] = [];
  private _zonePulseT = 0;
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;
  private _tooltip!: Container;
  private _tooltipBg!: Graphics;
  private _tooltipText!: Text;

  // Last renderer size seen by resize() — used to lay out the environment when
  // sprites are installed after the first resize.
  private _lastW: number = LAYOUT.CANVAS_W;
  private _lastH: number = LAYOUT.CANVAS_H;

  constructor() {
    super();
    this._buildContainers();
  }

  prepare(): void {
    const p = _pendingPresenter;
    _pendingPresenter = null;
    const bundle = _pendingSpriteBundle;
    _pendingSpriteBundle = null;

    if (_pendingCardTextures) {
      this._cardTextures = _pendingCardTextures;
      _pendingCardTextures = null;
    }

    if (bundle) {
      this._installSprites(bundle);
    }

    if (_pendingHumanKitColor !== null) {
      this._humanKitColor = _pendingHumanKitColor;
      this._humanKeeperColor = _pendingHumanKeeperColor!;
      this._aiKitColor = _pendingAiKitColor!;
      this._aiKeeperColor = _pendingAiKeeperColor!;
      _pendingHumanKitColor = null;
      _pendingHumanKeeperColor = null;
      _pendingAiKitColor = null;
      _pendingAiKeeperColor = null;
    }
    if (_pendingHumanTeamAbbr !== null) {
      this._humanTeamAbbr = _pendingHumanTeamAbbr;
      this._aiTeamAbbr = _pendingAiTeamAbbr!;
      _pendingHumanTeamAbbr = null;
      _pendingAiTeamAbbr = null;
    }
    if (this._scorePanelHomeNameTxt) {
      this._scorePanelHomeNameTxt.text = this._humanTeamAbbr;
      this._scorePanelAwayNameTxt.text = this._aiTeamAbbr;
    }

    this._applyRoleColors(this._currentHumanRole);
    this._refreshDuelBackground();

    this._onMatchComplete = _pendingOnMatchComplete;
    _pendingOnMatchComplete = null;

    if (!p) return;
    this._presenter = p;
    this._unsubscribe = p.onStateChange(() => {
      this._render(p.viewModel);
    });
  }

  async show(): Promise<void> {
    if (this._presenter) {
      this._render(this._presenter.viewModel);
    }
    // engine.navigation (and its .app) are unset in tests/non-browser
    // environments (no real CreationEngine.init() call there) — skip rather
    // than reject.
    if (!hasSeenPenaltyTutorial() && engine.navigation?.app) {
      markPenaltyTutorialSeen();
      void engine.navigation.presentPopup(TutorialScreen);
    }
  }

  async hide(): Promise<void> {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  reset(): void {
    this.removeChildren();
    this._presenter = null;
    this._unsubscribe = null;
    this._onMatchComplete = null;
    this._animation = null;
    this._lastPhase = null;
    this._hoverables = [];
    this._environment = null;
    this._grassBg = null;
    this._crowd = null;
    this._divider = null;
    this._wall = null;
    this._topWall = null;
    this._scorePanel = null;
    this._standTextures = null;
    this._humanShirts = [];
    this._aiShirts = [];
    this._gridKey = null;
    this._humanKitColor = 0xffffff;
    this._humanKeeperColor = 0xffffff;
    this._aiKitColor = 0xffffff;
    this._aiKeeperColor = 0xffffff;
    this._currentHumanRole = "striker";
    this._coinSprite = null;
    this._coinFrames = null;
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.filters = [];
    this._crtFilter = null;
  }

  resize(w: number, h: number): void {
    this._lastW = w;
    this._lastH = h;
    const sx = w / LAYOUT.CANVAS_W;
    const sy = h / LAYOUT.CANVAS_H;
    this._repositionPanels(sx, sy);
    this._layoutEnvironment(w, h);
  }

  update(time: Ticker): void {
    if (this._animation) {
      this._animation.tick(time.deltaMS);
    }
    this._tickHover(time.deltaMS);
    this._tickZones(time.deltaMS);
  }

  private _tickZones(deltaMs: number): void {
    if (!this.sidePicker?.visible || this._sideZones.length === 0) return;
    this._zonePulseT += deltaMs;
    const pulse = 0.55 + 0.45 * Math.sin(this._zonePulseT * 0.003);
    const selected = this._presenter?.viewModel.selection.side ?? null;
    for (const z of this._sideZones) {
      z.gfx.alpha = z.side === selected ? 1.0 : pulse;
    }
  }

  // Smoothly lerps every hovered card toward its target (lift + scale +
  // straighten + glow). Cards use a centre pivot, so scale/rotation pivot on
  // the card centre and no manual re-centring is needed.
  private _tickHover(deltaMs: number): void {
    if (this._hoverables.length === 0) return;
    const speed = 0.009; // progress per ms (~110ms to settle)
    for (const h of this._hoverables) {
      // Selected cards keep a persistent glow even at rest, so they still need
      // a refresh on the frame they settle; everything else can early-out.
      if (h.cur === h.target) continue;
      const dir = Math.sign(h.target - h.cur);
      h.cur += dir * Math.min(Math.abs(h.target - h.cur), deltaMs * speed);
      // easeOutCubic for a snappy-then-soft feel
      const e = 1 - Math.pow(1 - h.cur, 3);
      const s = 1 + (h.maxScale - 1) * e;
      h.container.scale.set(s);
      h.container.x = h.baseX;
      h.container.y = h.baseY - h.lift * e;
      // Straighten the card a little as it lifts, so it reads cleanly.
      h.container.rotation = h.baseRot * (1 - 0.6 * e);
      h.container.zIndex = h.cur > 0.01 ? 1000 : h.baseIndex;
      h.glow.alpha = Math.max(h.selectedGlow, 0.6 * e);
    }
  }

  // ─── Private: build static containers on construction ────────────────────

  private _buildContainers(): void {
    this.scoreDisplay = this._buildScoreDisplay();
    this.addChild(this.scoreDisplay);

    this.sidePicker = this._buildSidePicker();
    this.addChild(this.sidePicker);

    this.playerArea = this._buildPlayerArea();
    this.addChild(this.playerArea);

    this.cardRow = new Container();
    this.cardRow.sortableChildren = true; // fan overlap + hover brings to front
    this.addChild(this.cardRow);

    this.actionRow = new Container();
    this.actionRow.sortableChildren = true;
    this.addChild(this.actionRow);

    this.confirmButton = this._makeButton(
      "CONFIRM",
      LAYOUT.CONFIRM_BTN.x,
      LAYOUT.CONFIRM_BTN.y,
      LAYOUT.CONFIRM_BTN.w,
      LAYOUT.CONFIRM_BTN.h,
      0xf5b73d,
      { textColor: 0x17171f, border: true },
    );
    this.confirmButton.on("pointerdown", () => {
      if (this._presenter?.viewModel.canConfirm) {
        sfx.play(SOUND_ALIASES.whistle);
        this._presenter.confirm();
      }
    });
    this.addChild(this.confirmButton);

    this.darkenOverlay = this._buildDarkenOverlay();
    this.darkenOverlay.visible = false;
    this.addChild(this.darkenOverlay);

    this.duelPanel = this._buildDuelPanel();
    this.duelPanel.visible = false;
    this.addChild(this.duelPanel);

    this.resultPanel = this._buildResultPanel();
    this.resultPanel.visible = false;
    this.addChild(this.resultPanel);

    this.gameOverPanel = this._buildGameOverPanel();
    this.gameOverPanel.visible = false;
    this.addChild(this.gameOverPanel);

    this._tooltip = this._buildTooltip();
    this._tooltip.visible = false;
    this.addChild(this._tooltip);

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
      // no WebGL context — skip filter
    }
  }

  private _buildTooltip(): Container {
    const panel = new Container();
    panel.eventMode = "none"; // never intercept pointer events
    this._tooltipBg = new Graphics();
    panel.addChild(this._tooltipBg);

    this._tooltipText = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontFamily: "Minecraft",
        fontSize: 16,
        align: "left",
        wordWrap: true,
        wordWrapWidth: LAYOUT.TOOLTIP.w - LAYOUT.TOOLTIP.pad * 2,
        lineHeight: 20,
      },
    });
    this._tooltipText.x = LAYOUT.TOOLTIP.pad;
    this._tooltipText.y = LAYOUT.TOOLTIP.pad;
    panel.addChild(this._tooltipText);
    return panel;
  }

  private _buildScoreDisplay(): Container {
    const panel = new Container();

    // Ads-left badge — same gold/ink pixel-art style as the CONFIRM button.
    const BADGE_W = 96;
    const BADGE_H = 30;
    const badge = new Container();
    badge.x = 10;
    badge.y = 10;

    const badgeBg = new Graphics();
    const INK = 0x070b14;
    badgeBg.rect(0, 0, BADGE_W, BADGE_H).fill(0xf5b73d);
    badgeBg.rect(0, 0, BADGE_W, 2).fill(INK);
    badgeBg.rect(0, BADGE_H - 2, BADGE_W, 2).fill(INK);
    badgeBg.rect(0, 0, 2, BADGE_H).fill(INK);
    badgeBg.rect(BADGE_W - 2, 0, 2, BADGE_H).fill(INK);
    badge.addChild(badgeBg);

    this._adsLeftTxt = new Text({
      text: "ADS: 0",
      style: { fill: 0x17171f, fontFamily: "Minecraft", fontSize: 14 },
    });
    this._adsLeftTxt.anchor.set(0.5);
    this._adsLeftTxt.x = BADGE_W / 2;
    this._adsLeftTxt.y = BADGE_H / 2;
    badge.addChild(this._adsLeftTxt);

    panel.addChild(badge);

    // Settings/tutorial — same icons and behavior as HomeScreen's, so the
    // player can read the rules or fix the volume without leaving the kick.
    this._buildSettingsButton(panel);
    this._buildTutorialButton(panel);

    return panel;
  }

  private _buildSettingsButton(panel: Container): void {
    const cx = LAYOUT.CANVAS_W - 26;
    const cy = LAYOUT.CANVAS_H - 26;
    const gear = new Graphics();

    const TEETH = 8;
    const outerR = 10;
    const toothW = 4;
    const toothH = 4;
    for (let i = 0; i < TEETH; i++) {
      const angle = (i / TEETH) * Math.PI * 2;
      const tx = cx + Math.cos(angle) * outerR;
      const ty = cy + Math.sin(angle) * outerR;
      gear
        .rect(tx - toothW / 2, ty - toothH / 2, toothW, toothH)
        .fill(0xf6eccf);
    }
    gear.circle(cx, cy, outerR - 2).fill(0xf6eccf);
    gear.circle(cx, cy, 4).fill(0x0a1120);

    gear.eventMode = "static";
    gear.cursor = "pointer";
    gear.hitArea = new Rectangle(cx - 18, cy - 18, 36, 36);
    gear.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.presentPopup(SettingsScreen);
    });
    gear.on("pointerup", (e) => e.stopPropagation());

    panel.addChild(gear);
  }

  private _buildTutorialButton(panel: Container): void {
    const cx = LAYOUT.CANVAS_W - 60;
    const cy = LAYOUT.CANVAS_H - 26;

    const icon = new Graphics();
    icon.circle(cx, cy, 11).fill(0xf6eccf);
    icon.eventMode = "static";
    icon.cursor = "pointer";
    icon.hitArea = new Rectangle(cx - 18, cy - 18, 36, 36);
    icon.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      void engine.navigation.presentPopup(TutorialScreen);
    });
    icon.on("pointerup", (e) => e.stopPropagation());
    panel.addChild(icon);

    const mark = new Text({
      text: "?",
      style: { fontFamily: "Minecraft", fontSize: 14, fill: 0x0a1120 },
    });
    mark.anchor.set(0.5);
    mark.x = cx;
    mark.y = cy + 1;
    panel.addChild(mark);
  }

  private _buildPlayerArea(): Container {
    const panel = new Container();

    // Ground markings: penalty box + goal line + spot. Drawn once in virtual
    // coords — playerArea's own scale handles resizing, so these never need
    // per-resize recomputation like the screen-space environment does.
    // zIndex -1 keeps them behind the goal sprite/ball/characters once
    // _installSprites turns sortableChildren on.
    const pitchLines = new Graphics();
    pitchLines.zIndex = -1;
    pitchLines
      .rect(
        LAYOUT.PITCH_BOX.x,
        LAYOUT.PITCH_BOX.y,
        LAYOUT.PITCH_BOX.w,
        LAYOUT.PITCH_BOX.h,
      )
      .stroke({ color: LAYOUT.PITCH_LINE_COLOR, width: 3, alpha: 0.7 });
    // Goal line redrawn bolder on top of the box's top edge — "la meta".
    pitchLines
      .moveTo(LAYOUT.PITCH_BOX.x, LAYOUT.PITCH_BOX.y)
      .lineTo(LAYOUT.PITCH_BOX.x + LAYOUT.PITCH_BOX.w, LAYOUT.PITCH_BOX.y)
      .stroke({ color: LAYOUT.PITCH_LINE_COLOR, width: 4, alpha: 0.85 });
    // Touchline at the box's same y, crossing the full canvas width — hints
    // at the corners sitting just off-screen, like the box is a close-up
    // crop of a bigger pitch.
    pitchLines
      .moveTo(0, LAYOUT.PITCH_BOX.y)
      .lineTo(LAYOUT.CANVAS_W, LAYOUT.PITCH_BOX.y)
      .stroke({ color: LAYOUT.PITCH_LINE_COLOR, width: 3, alpha: 0.7 });
    pitchLines
      .circle(LAYOUT.BALL_POS.x, LAYOUT.BALL_POS.y, LAYOUT.PENALTY_SPOT_RADIUS)
      .fill({ color: LAYOUT.PITCH_LINE_COLOR, alpha: 0.85 });
    panel.addChild(pitchLines);

    // Goal frame (wireframe rectangle at top, like the mockup)
    const goalFrame = new Graphics();
    goalFrame
      .rect(
        LAYOUT.GOAL_FRAME.x,
        LAYOUT.GOAL_FRAME.y,
        LAYOUT.GOAL_FRAME.w,
        LAYOUT.GOAL_FRAME.h,
      )
      .stroke({
        color: LAYOUT.GOAL_FRAME.color,
        width: LAYOUT.GOAL_FRAME.stroke,
      });
    goalFrame.label = "goal-fallback";
    panel.addChild(goalFrame);

    // Fallback rects in case sprites aren't installed (used by tests)
    const strikerRect = new Graphics();
    strikerRect
      .rect(LAYOUT.STRIKER_POS.x - 24, LAYOUT.STRIKER_POS.y - 40, 48, 80)
      .stroke({ color: 0x66ddff, width: 2 });
    strikerRect.label = "striker-fallback";
    panel.addChild(strikerRect);

    const keeperRect = new Graphics();
    keeperRect
      .rect(LAYOUT.KEEPER_POS.x - 24, LAYOUT.KEEPER_POS.y - 40, 48, 80)
      .stroke({ color: 0xff8866, width: 2 });
    keeperRect.label = "keeper-fallback";
    panel.addChild(keeperRect);

    // Ball (placeholder; swapped for the real ball.goal sprite in _installSprites)
    this._ballSprite = new Sprite(Texture.WHITE);
    this._ballSprite.label = "ball-fallback";
    this._ballSprite.anchor.set(0.5);
    this._ballSprite.width = LAYOUT.BALL_RADIUS * 4;
    this._ballSprite.height = LAYOUT.BALL_RADIUS * 4;
    this._ballSprite.x = LAYOUT.BALL_POS.x;
    this._ballSprite.y = LAYOUT.BALL_POS.y;
    panel.addChild(this._ballSprite);

    return panel;
  }

  // Aim picker: three clickable boxes overlaid on the goal mouth. Children are
  // kept in [left, center, right] order so each maps to its shot side.
  private _buildSidePicker(): Container {
    const panel = new Container();
    const sides = ["left", "center", "right"] as const;
    const positions = [
      LAYOUT.GOAL_ZONES.left,
      LAYOUT.GOAL_ZONES.center,
      LAYOUT.GOAL_ZONES.right,
    ];
    const { w, h } = LAYOUT.GOAL_ZONE_SIZE;
    this._sideZones = [];

    sides.forEach((side, i) => {
      const gfx = new Graphics();
      gfx.x = positions[i].x;
      gfx.y = positions[i].y;
      gfx.eventMode = "static";
      gfx.cursor = "pointer";
      this._paintSideZone(gfx, w, h, "idle");

      gfx.on("pointerdown", () => this._presenter?.selectSide(side));
      gfx.on("pointerover", () => {
        if (this._presenter?.viewModel.selection.side !== side) {
          this._paintSideZone(gfx, w, h, "hover");
        }
      });
      gfx.on("pointerout", () => {
        const selected = this._presenter?.viewModel.selection.side === side;
        this._paintSideZone(gfx, w, h, selected ? "selected" : "idle");
      });

      panel.addChild(gfx);
      this._sideZones.push({ side, gfx, w, h });
    });
    return panel;
  }

  private _paintSideZone(
    gfx: Graphics,
    w: number,
    h: number,
    state: "idle" | "hover" | "selected",
  ): void {
    gfx.clear();
    if (state === "selected") {
      // Outer glow ring
      gfx
        .roundRect(-4, -4, w + 8, h + 8, 12)
        .fill({ color: 0xffd700, alpha: 0.28 });
      // Main fill
      gfx.roundRect(0, 0, w, h, 8).fill({ color: 0xffcc00, alpha: 0.45 });
      // Bright border
      gfx
        .roundRect(0, 0, w, h, 8)
        .stroke({ color: 0xffd700, alpha: 1, width: 3 });
      // Inner highlight line at top
      gfx.roundRect(6, 4, w - 12, 3, 2).fill({ color: 0xffffff, alpha: 0.6 });
    } else if (state === "hover") {
      gfx
        .roundRect(-2, -2, w + 4, h + 4, 11)
        .fill({ color: 0xffd700, alpha: 0.18 });
      gfx.roundRect(0, 0, w, h, 8).fill({ color: 0xffcc00, alpha: 0.3 });
      gfx
        .roundRect(0, 0, w, h, 8)
        .stroke({ color: 0xffffff, alpha: 1, width: 3 });
      gfx.roundRect(6, 4, w - 12, 3, 2).fill({ color: 0xffffff, alpha: 0.45 });
    } else {
      gfx.roundRect(0, 0, w, h, 8).fill({ color: 0xffd700, alpha: 0.1 });
      gfx
        .roundRect(0, 0, w, h, 8)
        .stroke({ color: 0xffd700, alpha: 0.85, width: 2.5 });
      // Corner accents
      gfx.roundRect(4, 4, 10, 10, 3).fill({ color: 0xffd700, alpha: 0.6 });
      gfx.roundRect(w - 14, 4, 10, 10, 3).fill({ color: 0xffd700, alpha: 0.6 });
      gfx.roundRect(4, h - 14, 10, 10, 3).fill({ color: 0xffd700, alpha: 0.6 });
      gfx
        .roundRect(w - 14, h - 14, 10, 10, 3)
        .fill({ color: 0xffd700, alpha: 0.6 });
    }
  }

  private _buildDarkenOverlay(): Container {
    const panel = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, LAYOUT.CANVAS_W, LAYOUT.CANVAS_H).fill({
      color: 0x000000,
      alpha: 0.78,
    });
    panel.addChild(bg);
    return panel;
  }

  private _buildDuelPanel(): Container {
    const panel = new Container();

    // Left and right half tinted rects — drawn with placeholder colors,
    // redrawn with real kit colors in _refreshDuelBackground() during prepare()
    this._duelBgLeft = new Graphics();
    panel.addChild(this._duelBgLeft);

    this._duelBgRight = new Graphics();
    panel.addChild(this._duelBgRight);

    // Speed lines (drawn in _refreshDuelBackground)
    this._duelLines = new Graphics();
    panel.addChild(this._duelLines);

    // Cards are centered in each half of the panel
    const panelCx = LAYOUT.DUEL_PANEL.x + LAYOUT.DUEL_PANEL.w / 2; // 384
    const panelCy = LAYOUT.DUEL_PANEL.y + LAYOUT.DUEL_PANEL.h / 2; // 410
    const humanCx = LAYOUT.DUEL_PANEL.x + LAYOUT.DUEL_PANEL.w / 4; // 204
    const aiCx = LAYOUT.DUEL_PANEL.x + (LAYOUT.DUEL_PANEL.w * 3) / 4; // 564
    const nameY = LAYOUT.DUEL_PANEL.y + 60;

    this._duelHumanSprite = new Sprite();
    this._duelHumanSprite.anchor.set(0.5);
    this._duelHumanSprite.x = humanCx;
    this._duelHumanSprite.y = panelCy + 20;
    panel.addChild(this._duelHumanSprite);

    this._duelHumanActiveSprite = new Sprite();
    this._duelHumanActiveSprite.anchor.set(0.5);
    this._duelHumanActiveSprite.x = humanCx - 110;
    this._duelHumanActiveSprite.y = panelCy - 140;
    this._duelHumanActiveSprite.visible = false;
    panel.addChild(this._duelHumanActiveSprite);

    // VS center marker — pixel art font, large
    this._vsTxt = new Text({
      text: "VS",
      style: {
        fontFamily: "Minecraft",
        fill: 0xffd700,
        fontSize: 72,
        stroke: { color: 0x000000, width: 6 },
      },
    });
    this._vsTxt.anchor.set(0.5);
    this._vsTxt.x = panelCx;
    this._vsTxt.y = panelCy;
    panel.addChild(this._vsTxt);

    this._duelAiSprite = new Sprite();
    this._duelAiSprite.anchor.set(0.5);
    this._duelAiSprite.x = aiCx;
    this._duelAiSprite.y = panelCy + 20;
    panel.addChild(this._duelAiSprite);

    this._duelAiActiveSprite = new Sprite();
    this._duelAiActiveSprite.anchor.set(0.5);
    this._duelAiActiveSprite.x = aiCx + 110;
    this._duelAiActiveSprite.y = panelCy - 140;
    this._duelAiActiveSprite.visible = false;
    panel.addChild(this._duelAiActiveSprite);

    // Flash overlay — filled in _onDuelClash, invisible by default
    this._duelBgFlash = new Graphics();
    this._duelBgFlash.alpha = 0;
    panel.addChild(this._duelBgFlash);

    // Draw with placeholder colors — real colors applied in _refreshDuelBackground()
    this._drawDuelBackground(0x1a3a6a, 0x3a1a1a);

    return panel;
  }

  /** Draws the split background + speed lines with the given team kit colors. */
  private _drawDuelBackground(humanColor: number, aiColor: number): void {
    const cx = 384; // canvas center x (split point)
    const panelCy = LAYOUT.DUEL_PANEL.y + LAYOUT.DUEL_PANEL.h / 2; // 410

    // Left half tinted rect (human color) — spans the full screen height
    this._duelBgLeft.clear();
    this._duelBgLeft
      .rect(0, 0, cx, LAYOUT.CANVAS_H)
      .fill({ color: humanColor, alpha: 0.3 });

    // Right half tinted rect (AI color) — spans the full screen height
    this._duelBgRight.clear();
    this._duelBgRight
      .rect(cx, 0, LAYOUT.CANVAS_W - cx, LAYOUT.CANVAS_H)
      .fill({ color: aiColor, alpha: 0.3 });

    // Speed lines radiating from center point
    this._duelLines.clear();
    this._drawSpeedLines(
      this._duelLines,
      cx,
      panelCy,
      humanColor,
      toRad(100),
      toRad(260),
      14,
    );
    this._drawSpeedLines(
      this._duelLines,
      cx,
      panelCy,
      aiColor,
      toRad(-80),
      toRad(80),
      14,
    );
  }

  /** Redraws the duel panel background with current kit colors. Called from prepare(). */
  private _refreshDuelBackground(): void {
    this._drawDuelBackground(this._humanKitColor, this._aiKitColor);
  }

  private _drawSpeedLines(
    gfx: Graphics,
    cx: number,
    cy: number,
    color: number,
    angleStart: number,
    angleEnd: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = angleStart + (i / count) * (angleEnd - angleStart);
      const len = 220 + (i % 3) * 60; // 220, 280, 340 cycling
      const startR = 45;
      gfx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
      gfx.lineTo(
        cx + Math.cos(angle) * (startR + len),
        cy + Math.sin(angle) * (startR + len),
      );
    }
    gfx.stroke({ color, alpha: 0.28, width: 1.5 });
  }

  private _buildResultPanel(): Container {
    const panel = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, LAYOUT.CANVAS_W, LAYOUT.CANVAS_H).fill({
      color: 0x111111,
      alpha: 0.85,
    });
    panel.addChild(bg);

    this._resultTxt = new Text({
      text: "",
      style: { fill: 0xffffff, fontFamily: "Minecraft", fontSize: 96 },
    });
    this._resultTxt.anchor.set(0.5);
    this._resultTxt.x = LAYOUT.RESULT_TEXT.x;
    this._resultTxt.y = LAYOUT.RESULT_TEXT.y;
    panel.addChild(this._resultTxt);

    const nextBtn = this._makeButton(
      "NEXT",
      LAYOUT.NEXT_BTN.x,
      LAYOUT.NEXT_BTN.y,
      LAYOUT.NEXT_BTN.w,
      LAYOUT.NEXT_BTN.h,
      0xf5b73d,
      { textColor: 0x17171f, border: true },
    );
    nextBtn.on("pointerdown", () => this._presenter?.advanceTurn());
    panel.addChild(nextBtn);
    return panel;
  }

  private _buildGameOverPanel(): Container {
    const panel = new Container();
    const bg = new Graphics();
    bg.rect(
      LAYOUT.GAME_OVER_PANEL.x,
      LAYOUT.GAME_OVER_PANEL.y,
      LAYOUT.GAME_OVER_PANEL.w,
      LAYOUT.GAME_OVER_PANEL.h,
    ).fill({ color: 0x000000, alpha: 0.92 });
    panel.addChild(bg);

    this._gameOverTxt = new Text({
      text: "FULL TIME",
      style: { fill: 0xff4444, fontSize: 64, fontWeight: "bold" },
    });
    this._gameOverTxt.anchor.set(0.5);
    this._gameOverTxt.x = LAYOUT.GAME_OVER_TEXT.x;
    this._gameOverTxt.y = LAYOUT.GAME_OVER_TEXT.y;
    panel.addChild(this._gameOverTxt);

    this._winnerTxt = new Text({
      text: "",
      style: { fill: 0xffffff, fontSize: 40 },
    });
    this._winnerTxt.anchor.set(0.5);
    this._winnerTxt.x = LAYOUT.WINNER_TEXT.x;
    this._winnerTxt.y = LAYOUT.WINNER_TEXT.y;
    panel.addChild(this._winnerTxt);

    this._finalScoreTxt = new Text({
      text: "",
      style: { fill: 0xffffff, fontSize: 32 },
    });
    this._finalScoreTxt.anchor.set(0.5);
    this._finalScoreTxt.x = LAYOUT.FINAL_SCORE_TEXT.x;
    this._finalScoreTxt.y = LAYOUT.FINAL_SCORE_TEXT.y;
    panel.addChild(this._finalScoreTxt);

    const continueBtn = new Container();
    continueBtn.eventMode = "static";
    continueBtn.cursor = "pointer";
    continueBtn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      this._onMatchComplete?.();
    });

    const btnBg = new Graphics();
    btnBg.roundRect(0, 0, 280, 56, 10).fill({ color: 0x224488 });
    continueBtn.addChild(btnBg);

    const btnLbl = new Text({
      text: "CONTINUE →",
      style: { fill: 0xffffff, fontFamily: "Minecraft", fontSize: 20 },
    });
    btnLbl.anchor.set(0.5);
    btnLbl.x = 140;
    btnLbl.y = 28;
    continueBtn.addChild(btnLbl);

    continueBtn.x = LAYOUT.CANVAS_W / 2 - 140;
    continueBtn.y = LAYOUT.GAME_OVER_PANEL.y + LAYOUT.GAME_OVER_PANEL.h - 72;
    panel.addChild(continueBtn);

    return panel;
  }

  private _installSprites(bundle: PenaltySpriteBundle): void {
    // Remove fallback placeholders (goal wireframe + striker/keeper outlines + ball)
    for (const child of this.playerArea.children.slice()) {
      if (
        child.label === "goal-fallback" ||
        child.label === "striker-fallback" ||
        child.label === "keeper-fallback" ||
        child.label === "ball-fallback"
      ) {
        this.playerArea.removeChild(child);
      }
    }

    // Stadium background (grass + stands + tiled crowd) lives in screen space,
    // behind everything, so it fills any window without stretching the art.
    this._buildEnvironment(bundle.stands, bundle.scorePanel);
    if (this._environment) this.addChildAt(this._environment, 0);
    this._layoutEnvironment(this._lastW, this._lastH);

    // Real pitch/goal sprite — at the back of playerArea (behind characters and
    // ball), centered, anchored at 0.5 so it never deforms.
    const goal = new Sprite(bundle.goal);
    goal.anchor.set(0.5);
    goal.scale.set(LAYOUT.GOAL.scaleX, LAYOUT.GOAL.scaleY);
    goal.x = LAYOUT.GOAL.cx;
    goal.y = LAYOUT.GOAL.cy;
    this.playerArea.addChildAt(goal, 0);

    // Use sortableChildren so ball zIndex can be swapped at runtime based on result.
    this.playerArea.sortableChildren = true;

    // Real ball sprite (32×32 native) — scaled to LAYOUT.BALL_RADIUS*2 diameter.
    const ball = new Sprite(bundle.ball);
    ball.anchor.set(0.5);
    ball.scale.set((LAYOUT.BALL_RADIUS * 2) / bundle.ball.width);
    ball.x = LAYOUT.BALL_POS.x;
    ball.y = LAYOUT.BALL_POS.y;
    ball.zIndex = 1;
    this._ballSprite = ball;
    this.playerArea.addChild(this._ballSprite);

    this._keeperChar = new LayeredCharacter(bundle.goalkeeper);
    this._keeperChar.scale.set(LAYOUT.KEEPER_SCALE);
    this._keeperChar.x = LAYOUT.KEEPER_POS.x;
    this._keeperChar.y = LAYOUT.KEEPER_POS.y;
    this._keeperChar.zIndex = 2;
    this.playerArea.addChild(this._keeperChar);

    this._strikerChar = new LayeredCharacter(bundle.striker);
    this._strikerChar.scale.set(LAYOUT.CHARACTER_SCALE);
    this._strikerChar.x = LAYOUT.STRIKER_POS.x;
    this._strikerChar.y = LAYOUT.STRIKER_POS.y;
    this._strikerChar.zIndex = 3;
    this.playerArea.addChild(this._strikerChar);

    this._coinFrames = bundle.coinFrames;
    const coin = new Sprite(bundle.coinFrames[0]);
    coin.anchor.set(0.5);
    coin.visible = false;
    this._coinSprite = coin;
    // Added to root container (after duelPanel) so it renders above the card duel panel.
    // Position and scale are managed by _repositionPanels.
    this.addChild(coin);
  }

  // Builds the screen-space stadium background scaffold: a flat grass fill, an
  // empty crowd container (the grid is filled later, sized to the real screen),
  // and the central wall divider between the two hinchadas. The fan textures are
  // stashed so the grid can be (re)built in _layoutEnvironment().
  private _buildEnvironment(
    stands: StandLayers,
    scorePanelTextures: ScorePanelTextures,
  ): void {
    const env = new Container();
    this._standTextures = stands;

    this._grassBg = new Graphics();
    env.addChild(this._grassBg);

    this._crowd = new Container();
    env.addChild(this._crowd);

    // Horizontal wall below the fans (perimeter barrier) + vertical divider that
    // splits the two hinchadas. Both tiled from stand.wall.
    this._topWall = new TilingSprite({ texture: stands.wall });
    env.addChild(this._topWall);

    this._wall = new TilingSprite({ texture: stands.wall });
    env.addChild(this._wall);

    this._divider = new TilingSprite({ texture: stands.wall });
    env.addChild(this._divider);

    // Scoreboard panel (164×82 native), stacked from its 4 layers: frame
    // background, the two dark "digit display" boxes (resultado), and the
    // nameplate strips (equipo1/equipo2) below each one.
    const panel = new Container();
    panel.addChild(new Sprite(scorePanelTextures.panel));
    panel.addChild(new Sprite(scorePanelTextures.resultado));
    panel.addChild(new Sprite(scorePanelTextures.equipo1));
    panel.addChild(new Sprite(scorePanelTextures.equipo2));

    // Score digits sit centred in each dark display box (x18-148, y19-59).
    // Each digit gets a blurred glow duplicate behind it for a digital-screen look.
    const digitStyle = {
      fill: 0xffe066,
      fontFamily: "Minecraft",
      fontSize: 22,
    } as const;
    const glowFilter = () => new BlurFilter({ strength: 4 });

    this._scorePanelHomeGlowTxt = new Text({ text: "0", style: digitStyle });
    this._scorePanelHomeGlowTxt.anchor.set(0.5);
    this._scorePanelHomeGlowTxt.position.set(46.5, 39);
    this._scorePanelHomeGlowTxt.filters = [glowFilter()];
    panel.addChild(this._scorePanelHomeGlowTxt);

    this._scorePanelHomeTxt = new Text({ text: "0", style: digitStyle });
    this._scorePanelHomeTxt.anchor.set(0.5);
    this._scorePanelHomeTxt.position.set(46.5, 39);
    panel.addChild(this._scorePanelHomeTxt);

    this._scorePanelAwayGlowTxt = new Text({ text: "0", style: digitStyle });
    this._scorePanelAwayGlowTxt.anchor.set(0.5);
    this._scorePanelAwayGlowTxt.position.set(119.5, 39);
    this._scorePanelAwayGlowTxt.filters = [glowFilter()];
    panel.addChild(this._scorePanelAwayGlowTxt);

    this._scorePanelAwayTxt = new Text({ text: "0", style: digitStyle });
    this._scorePanelAwayTxt.anchor.set(0.5);
    this._scorePanelAwayTxt.position.set(119.5, 39);
    panel.addChild(this._scorePanelAwayTxt);

    // Team abbreviations sit centred below each digit box (y64-71), fontSize 10
    // white for visibility against the panel's dark background there.
    this._scorePanelHomeNameTxt = new Text({
      text: this._humanTeamAbbr,
      style: { fill: 0xffffff, fontFamily: "Minecraft", fontSize: 10 },
    });
    this._scorePanelHomeNameTxt.anchor.set(0.5);
    this._scorePanelHomeNameTxt.position.set(46.5, 67.5);
    panel.addChild(this._scorePanelHomeNameTxt);

    this._scorePanelAwayNameTxt = new Text({
      text: this._aiTeamAbbr,
      style: { fill: 0xffffff, fontFamily: "Minecraft", fontSize: 10 },
    });
    this._scorePanelAwayNameTxt.anchor.set(0.5);
    this._scorePanelAwayNameTxt.position.set(119.5, 67.5);
    panel.addChild(this._scorePanelAwayNameTxt);

    env.addChild(panel);
    this._scorePanel = panel;

    this._environment = env;
  }

  // Positions the stadium background for the real renderer size. The crowd is a
  // grid of square fans (one cell = 32 native px); cell count depends on size, so
  // the grid is rebuilt only when that count changes (cached via _gridKey). Below
  // the fans sits a horizontal wall (height = goal height) and a vertical divider
  // splits the human (left) and AI (right) hinchadas.
  private _layoutEnvironment(w: number, h: number): void {
    if (!this._environment || !this._grassBg || !this._crowd) return;
    if (!this._divider || !this._wall || !this._topWall || !this._standTextures)
      return;

    const top = h * LAYOUT.ENV.standsTopFrac;
    const fansH = h * LAYOUT.ENV.fansBandFrac;
    // Wall height tracks the goal's on-screen height (62 native * goal scale,
    // mapped from virtual → screen via h/CANVAS_H) so wall and goal read equal.
    const wallH = h * LAYOUT.ENV.wallFrac;
    const half = w / 2;
    const dims = crowdGridDims(half, fansH, LAYOUT.ENV.crowdRows);

    // Grass fills the whole screen (flat colour → never looks stretched).
    this._grassBg
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: LAYOUT.ENV.grassColor });

    const tileScale = dims.cellH / 32 || 1;

    // Top wall: fills the gap between y=0 and the fans (score bar floats above).
    this._topWall.x = 0;
    this._topWall.y = 0;
    this._topWall.width = w;
    this._topWall.height = top;
    this._topWall.tileScale.set(tileScale);

    // Horizontal wall: full width, sitting directly below the fan rows.
    this._wall.x = 0;
    this._wall.y = top + fansH;
    this._wall.width = w;
    this._wall.height = wallH;
    this._wall.tileScale.set(tileScale);

    // Scoreboard panel — left side of the wall (clear of the centred goal sprite),
    // sized as a fraction of the screen width.
    if (this._scorePanel) {
      const panelW = w * 0.17;
      const panelScale = panelW / 164;
      this._scorePanel.scale.set(panelScale);
      this._scorePanel.x = w * 0.03;
      this._scorePanel.y = this._wall.y + (wallH - 82 * panelScale) / 2;
    }

    // Vertical divider: two cells wide, spanning only the fan rows (down to the
    // horizontal wall), centred on the seam between the two hinchadas.
    const wallW = (dims.cellW || 0) * 2;
    this._divider.x = half - wallW / 2;
    this._divider.y = top;
    this._divider.width = wallW;
    this._divider.height = fansH;
    this._divider.tileScale.set(tileScale);

    // Rebuild the fan grid only when the cell count changed (resize is rare; this
    // keeps the deterministic hair stable instead of re-randomising every frame).
    const key = `${dims.colsPerHalf}x${dims.rows}`;
    if (key !== this._gridKey) {
      this._buildCrowdGrid(dims);
      this._gridKey = key;
    }
    this._positionCrowdGrid(dims, top, half);
  }

  // Creates the fan sprites: a grid per side (human left, AI right). Each fan is
  // background + body + shirt (tinted per team) + a deterministic hair variant.
  private _buildCrowdGrid(dims: ReturnType<typeof crowdGridDims>): void {
    if (!this._crowd || !this._standTextures) return;
    const tex = this._standTextures;
    this._crowd.removeChildren();
    this._humanShirts = [];
    this._aiShirts = [];
    if (dims.colsPerHalf <= 0) return;

    const sides = [
      { tint: this._crowdTints.human, shirts: this._humanShirts },
      { tint: this._crowdTints.ai, shirts: this._aiShirts },
    ] as const;

    for (let side = 0; side < 2; side++) {
      for (let row = 0; row < dims.rows; row++) {
        for (let col = 0; col < dims.colsPerHalf; col++) {
          const fan = this._makeFan(
            tex,
            row,
            col,
            sides[side].tint,
            sides[side].shirts,
          );
          fan.label = `fan-${side}-${row}-${col}`;
          this._crowd.addChild(fan);
        }
      }
    }
  }

  // One composed fan: four stacked 32-native sprites in a unit-sized container
  // (positioned/scaled later). The shirt is registered for per-team re-tinting.
  private _makeFan(
    tex: StandLayers,
    row: number,
    col: number,
    tint: number,
    shirts: Sprite[],
  ): Container {
    const fan = new Container();
    const hair = tex.fanHair[hairIndexForCell(row, col)];
    const shirt = new Sprite(tex.fanShirt);
    shirt.tint = tint;
    shirts.push(shirt);
    for (const layer of [
      new Sprite(tex.fanBackground),
      new Sprite(tex.fanBody),
      shirt,
      new Sprite(hair),
    ]) {
      layer.width = 32;
      layer.height = 32;
      fan.addChild(layer);
    }
    return fan;
  }

  // Places/scales every fan cell onto the screen-space grid. Human cells fill
  // [0, half), AI cells fill [half, w). Columns fill each half exactly, so the
  // cell can be slightly non-square (scaled per axis) but never clipped.
  private _positionCrowdGrid(
    dims: ReturnType<typeof crowdGridDims>,
    top: number,
    half: number,
  ): void {
    if (!this._crowd || dims.colsPerHalf <= 0) return;
    const perSide = dims.rows * dims.colsPerHalf;
    const sx = dims.cellW / 32;
    const sy = dims.cellH / 32;
    this._crowd.children.forEach((fan, i) => {
      const side = Math.floor(i / perSide); // 0 human, 1 AI
      const local = i % perSide;
      const row = Math.floor(local / dims.colsPerHalf);
      const col = local % dims.colsPerHalf;
      fan.scale.set(sx, sy);
      fan.x = (side === 0 ? 0 : half) + col * dims.cellW;
      fan.y = top + row * dims.cellH;
    });
  }

  private _applyRoleColors(role: "striker" | "goalkeeper"): void {
    if (role === "striker") {
      this._strikerChar?.setLayerTint("body", this._humanKitColor);
      this._keeperChar?.setLayerTint("body", this._aiKeeperColor);
    } else {
      this._strikerChar?.setLayerTint("body", this._aiKitColor);
      this._keeperChar?.setLayerTint("body", this._humanKeeperColor);
    }
    this.setCrowdColors(this._humanKitColor, this._aiKitColor);
  }

  // Recolours the crowd shirts. Human = left hinchada, AI = right hinchada.
  setCrowdColors(human: number, ai: number): void {
    this._crowdTints = { human, ai };
    for (const s of this._humanShirts) s.tint = human;
    for (const s of this._aiShirts) s.tint = ai;
  }

  // ─── Private: full re-render from view-model ──────────────────────────────

  private _render(vm: PenaltyViewModel): void {
    const prevRole = this._currentHumanRole;
    this._currentHumanRole = vm.humanRole;
    if (prevRole !== this._currentHumanRole) {
      this._applyRoleColors(this._currentHumanRole);
    }
    this._adsLeftTxt.text = `ADS: ${this._presenter?.adRewardUsesLeft() ?? 0}`;
    // Don't reflect vm.score on the wall scoreboard while "revealing" — it
    // already holds the post-resolution value at that point, but the duel
    // animation hasn't shown the outcome yet. Update once the reveal ends.
    if (this._scorePanelHomeTxt && vm.phase !== "revealing") {
      this._scorePanelHomeTxt.text = `${vm.score.humanGoals}`;
      this._scorePanelAwayTxt.text = `${vm.score.aiGoals}`;
      this._scorePanelHomeGlowTxt.text = this._scorePanelHomeTxt.text;
      this._scorePanelAwayGlowTxt.text = this._scorePanelAwayTxt.text;
    }

    // Rebuild the hover registry from scratch — the hand re-adds its cards.
    this._hoverables = [];
    this._hideTooltip();
    this._renderHand(vm);

    // Reflect the chosen aim side on the goal boxes.
    for (const z of this._sideZones) {
      this._paintSideZone(
        z.gfx,
        z.w,
        z.h,
        vm.selection.side === z.side ? "selected" : "idle",
      );
    }

    (this.confirmButton.getChildAt(0) as Graphics).alpha = vm.canConfirm
      ? 1
      : 0.4;

    const isRevealing = vm.phase === "revealing";
    const isShowingResult = vm.phase === "showing-result";
    const isGameOver = vm.phase === "game-over";
    const isDraw = vm.phase === "draw";

    this.resultPanel.visible = isShowingResult;
    if (isShowingResult && this._lastPhase !== "showing-result") {
      this._fadeInResultPanel();
      if (vm.lastOutcome?.goal) {
        sfx.play(SOUND_ALIASES.shoutFan);
      } else if (vm.lastOutcome) {
        sfx.play(SOUND_ALIASES.save);
      }
    }
    this.gameOverPanel.visible = isGameOver || isDraw;

    this.sidePicker.visible = vm.phase === "selecting";
    this.cardRow.visible = vm.phase === "selecting" || isRevealing;
    this.actionRow.visible = vm.phase === "selecting" || isRevealing;
    this.confirmButton.visible = vm.phase === "selecting";

    if (!isRevealing) {
      this.duelPanel.visible = false;
      this.darkenOverlay.visible = false;
      if (this._coinSprite) this._coinSprite.visible = false;
    }

    if (isRevealing && vm.lastOutcome) {
      this._populateDuelPanel(vm);
    }

    if (isRevealing && this._lastPhase !== "revealing") {
      this._startRevealAnimation(vm);
    }

    if (vm.phase === "selecting" && this._lastPhase !== "selecting") {
      this._resetScene();
    }

    this._lastPhase = vm.phase;

    if (isShowingResult && vm.lastOutcome) {
      this._resultTxt.text = vm.lastOutcome.goal ? "GOAL" : "MISS";
      this._resultTxt.style.fill = vm.lastOutcome.goal ? 0x55ff77 : 0xff5566;
    }

    if (isGameOver) {
      const humanWon = vm.score.humanGoals > vm.score.aiGoals;
      this._gameOverTxt.text = "FULL TIME";
      this._winnerTxt.text = humanWon ? "Winner: You" : "Winner: AI";
      this._finalScoreTxt.text = `${vm.score.humanGoals} - ${vm.score.aiGoals}`;
    }

    if (isDraw) {
      this._gameOverTxt.text = "FULL TIME — DRAW";
      this._winnerTxt.text = "";
      this._finalScoreTxt.text = `${vm.score.humanGoals} - ${vm.score.aiGoals}`;
    }
  }

  // Renders passives on the left half of the screen and actives on the right,
  // both as flat horizontal rows (no rotation). Each group has a label above.
  private _renderHand(vm: PenaltyViewModel): void {
    this.cardRow.removeChildren();
    this.actionRow.removeChildren();

    const { cardW, cardH, gap, y: cardY, zoneW, divider } = LAYOUT.HAND;
    const rightZoneX = zoneW + divider;

    interface HandEntry {
      card: Card;
      selected: boolean;
      enabled: boolean;
      accent: number;
      onPick: () => void;
      onAdClick?: () => void;
    }

    const renderGroup = (
      entries: HandEntry[],
      zoneX: number,
      container: Container,
    ): void => {
      if (entries.length === 0) return;

      const totalW = entries.length * cardW + (entries.length - 1) * gap;
      const firstCX = zoneX + (zoneW - totalW) / 2 + cardW / 2;

      entries.forEach((e, i) => {
        const cx = firstCX + i * (cardW + gap);
        const card3d = this._makeCardVisual({
          card: e.card,
          cx,
          cy: cardY,
          rot: 0,
          zIndex: i,
          w: cardW,
          h: cardH,
          selected: e.selected,
          enabled: e.enabled,
          accent: e.accent,
          onPick: e.onPick,
          onAdClick: e.onAdClick,
        });
        container.addChild(card3d);
      });
    };

    const canUseAd = this._presenter?.canUseAdReward() ?? false;

    const passiveEntries: HandEntry[] = vm.humanHand.passives.map((card) => ({
      card,
      selected: vm.selection.passive === card,
      enabled: card.canPlay(),
      accent: 0x66ddff,
      onPick: () => this._presenter?.selectPassive(card),
      onAdClick:
        !card.canPlay() && canUseAd
          ? () => void this._presenter?.watchAdForPassive(card)
          : undefined,
    }));

    const activeEntries: HandEntry[] = vm.humanHand.actives.map((card) => ({
      card,
      selected: vm.selection.active === card,
      enabled: card.canActivate(),
      accent: 0xffaa55,
      onPick: () => this._presenter?.selectActive(card),
      onAdClick:
        !card.canActivate() && canUseAd
          ? () => void this._presenter?.watchAdForActive(card)
          : undefined,
    }));

    renderGroup(passiveEntries, 0, this.cardRow);
    renderGroup(activeEntries, rightZoneX, this.actionRow);
  }

  // Builds one interactive card for the hand fan: a dark rounded body (NO
  // outline — only the hover glow), value badges at the top (kept in the part
  // of the card the fan never overlaps), the artwork below, and a rich tooltip.
  // The container uses a CENTRE pivot so scale/rotation pivot on the card centre.
  private _makeCardVisual(opts: {
    card: Card;
    cx: number;
    cy: number;
    rot: number;
    zIndex: number;
    w: number;
    h: number;
    selected: boolean;
    enabled: boolean;
    accent: number;
    onPick: () => void;
    onAdClick?: () => void;
  }): Container {
    const { card, cx, cy, rot, zIndex, w, h, selected, enabled, accent } = opts;
    const container = new Container();
    container.pivot.set(w / 2, h / 2);
    container.x = cx;
    container.y = cy;
    container.rotation = rot;
    container.zIndex = zIndex;

    // Glow halo behind the card — alpha is driven by the hover tween, and kept
    // lit for the selected card (selection no longer uses a border).
    const selectedGlow = selected ? 0.45 : 0;
    const glow = new Graphics();
    glow
      .roundRect(-10, -10, w + 20, h + 20, 16)
      .fill({ color: accent, alpha: 1 });
    glow.alpha = selectedGlow;
    container.addChild(glow);

    // Card body — dark rounded fill, behind the art as a headless/no-texture
    // fallback. The artwork already carries the card's name and stats baked in.
    const body = new Graphics();
    body.roundRect(0, 0, w, h, 12).fill({ color: 0x0e1726 });
    container.addChild(body);

    // Artwork fills the WHOLE card (the art is the card). The container's aspect
    // ratio matches the art, so filling w×h introduces no distortion. A rounded
    // mask keeps the silhouette consistent with the glow.
    const url = card.imageUrl || cardArtUrl(card);
    const texture = url ? this._cardTextures.get(url) : undefined;
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = w;
      sprite.height = h;
      sprite.x = w / 2;
      sprite.y = h / 2;
      const mask = new Graphics();
      mask.roundRect(0, 0, w, h, 12).fill(0xffffff);
      container.addChild(mask);
      sprite.mask = mask;
      container.addChild(sprite);
    }

    // Hover (lift + glow) and tooltip work for every card — including ones on
    // cooldown, so the player can read why they're unavailable. Only PLAYABLE
    // cards are pickable.
    container.eventMode = "static";
    if (enabled) {
      container.cursor = "pointer";
      container.on("pointerdown", opts.onPick);
    } else {
      container.cursor = "default";
      container.alpha = 0.5;
    }
    this._registerHover(container, glow, {
      baseX: cx,
      baseY: cy,
      baseRot: rot,
      baseIndex: zIndex,
      selectedGlow,
      w,
      h,
      tooltipText: () => this._cardTooltip(card),
    });

    // AD badge — shown when card is disabled and an ad reward is available
    if (!enabled && opts.onAdClick) {
      const badgeW = 40;
      const badgeH = 20;
      const badge = new Container();
      badge.eventMode = "static";
      badge.cursor = "pointer";
      badge.x = w / 2 - badgeW / 2;
      badge.y = 4;

      const badgeBg = new Graphics();
      badgeBg.roundRect(0, 0, badgeW, badgeH, 4).fill({ color: 0xffd700 });
      badge.addChild(badgeBg);

      const badgeTxt = new Text({
        text: "AD",
        style: { fill: 0x000000, fontSize: 11, fontWeight: "bold" },
      });
      badgeTxt.anchor.set(0.5);
      badgeTxt.x = badgeW / 2;
      badgeTxt.y = badgeH / 2;
      badge.addChild(badgeTxt);

      badge.on("pointerdown", (e) => {
        e.stopPropagation();
        opts.onAdClick!();
      });

      container.addChild(badge);
    }

    return container;
  }

  // Registers a card for hover tweening and wires tooltip show/hide.
  private _registerHover(
    container: Container,
    glow: Graphics,
    opts: {
      baseX: number;
      baseY: number;
      baseRot: number;
      baseIndex: number;
      selectedGlow: number;
      w: number;
      h: number;
      tooltipText: () => string;
    },
  ): void {
    const state: HoverState = {
      container,
      glow,
      baseX: opts.baseX,
      baseY: opts.baseY,
      baseRot: opts.baseRot,
      baseIndex: opts.baseIndex,
      selectedGlow: opts.selectedGlow,
      w: opts.w,
      h: opts.h,
      cur: 0,
      target: 0,
      lift: 22,
      maxScale: 1.12,
    };
    this._hoverables.push(state);
    container.on("pointerover", () => {
      state.target = 1;
      this._showTooltip(opts.tooltipText(), container, opts.w, opts.h);
    });
    container.on("pointerout", () => {
      state.target = 0;
      this._hideTooltip();
    });
  }

  private _showTooltip(
    text: string,
    anchor: Container,
    cardW: number,
    cardH: number,
  ): void {
    this._tooltipText.text = text;
    const th = Math.max(LAYOUT.TOOLTIP.h, this._tooltipText.height + 28);
    this._tooltipBg
      .clear()
      .roundRect(0, 0, LAYOUT.TOOLTIP.w, th, 10)
      .fill({ color: 0x05101c, alpha: 0.96 })
      .stroke({ color: 0xffd166, width: 2 });

    // The card uses a centre pivot, so its global position is its CENTRE.
    // Place the bubble centred above the card's top edge, then clamp.
    const scale = anchor.scale?.y ?? 1;
    const gp = anchor.getGlobalPosition();
    const local = this.toLocal(gp);
    let tx = local.x - LAYOUT.TOOLTIP.w / 2;
    let ty = local.y - (cardH * scale) / 2 - th - 12;
    tx = Math.max(8, Math.min(tx, LAYOUT.CANVAS_W - LAYOUT.TOOLTIP.w - 8));
    if (ty < 8) ty = local.y + (cardH * scale) / 2 + 12;
    this._tooltip.x = tx;
    this._tooltip.y = ty;
    this._tooltip.visible = true;

    // Avoid an unused-parameter lint while keeping the signature symmetric.
    void cardW;
  }

  private _hideTooltip(): void {
    if (this._tooltip) this._tooltip.visible = false;
  }

  // Rich, relevant tooltip: power/cooldown/effect/probabilities by card type.
  private _cardTooltip(card: Card): string {
    if (card instanceof PassiveCard) return this._passiveTooltip(card);
    if (card instanceof ActiveCard) return this._activeTooltip(card);
    return `${card.name}\n${card.description}`;
  }

  private _passiveTooltip(card: PassiveCard): string {
    const lines = [card.name, card.description, "", `Tier: ${card.tier}`];

    let powerLine = `Power: ${card.power}`;
    if (card.bonusPower > 0) powerLine += ` (+${card.bonusPower} bonus)`;
    if (card.effectivePower === 0) powerLine += ` (nullified)`;
    lines.push(powerLine);

    const cd = card.cooldown === 0 ? "None" : `${card.cooldown} shots`;
    const state = card.canPlay()
      ? "Ready"
      : `On cooldown — ${card.shotsRemaining()} shot(s) left`;
    lines.push(`Cooldown: ${cd} — ${state}`);

    lines.push(
      `Counter chance (${card.tier}): ${TIER_STATS[card.tier].counterChance}%`,
    );
    return lines.join("\n");
  }

  private _activeTooltip(card: ActiveCard): string {
    const lines = [card.name, card.description, ""];
    const odds = `vs Normal ${TIER_STATS.Normal.counterChance}%  ·  Special ${TIER_STATS.Special.counterChance}%  ·  Epic ${TIER_STATS.Epic.counterChance}%`;

    if (card instanceof CheatingCard) {
      lines.push("Effect: sets goal chance to rival's counter value");
      lines.push(odds);
    } else if (card instanceof IntimidateCard) {
      lines.push("Effect: forces rival miss chance");
      lines.push(odds);
      lines.push(`Side mismatch: −${INTIMIDATE_MISMATCH_PENALTY}%`);
    } else if (card instanceof NullifyCard) {
      lines.push("Effect: nullifies rival passive power (set to 0)");
    }

    lines.push(card.used ? "Status: USED" : "One-time use");
    return lines.join("\n");
  }

  // Scales a sprite to fit inside (boxW × boxH) preserving aspect ratio.
  private _fitContain(sprite: Sprite, boxW: number, boxH: number): void {
    const tw = sprite.texture.width || 1;
    const th = sprite.texture.height || 1;
    const s = Math.min(boxW / tw, boxH / th);
    sprite.scale.set(s);
  }

  private _populateDuelPanel(vm: PenaltyViewModel): void {
    const ev = vm.lastOutcome!.evidence;
    const humanIsStriker = vm.humanRole === "striker";

    const humanPassiveId = humanIsStriker
      ? ev.strikerPassiveId
      : ev.goalkeeperPassiveId;
    const aiPassiveId = humanIsStriker
      ? ev.goalkeeperPassiveId
      : ev.strikerPassiveId;

    // Show the actual cards that were played, not just text.
    const humanSide: "striker" | "goalkeeper" = humanIsStriker
      ? "striker"
      : "goalkeeper";
    const aiSide: "striker" | "goalkeeper" = humanIsStriker
      ? "goalkeeper"
      : "striker";
    this._setDuelSprite(this._duelHumanSprite, humanPassiveId, vm);
    this._setDuelSprite(this._duelAiSprite, aiPassiveId, vm);
    this._setDuelActive(this._duelHumanActiveSprite, humanSide, ev, vm);
    this._setDuelActive(this._duelAiActiveSprite, aiSide, ev, vm);
  }

  // Paints the played passive card's artwork into a duel slot (contained).
  private _setDuelSprite(
    sprite: Sprite,
    cardId: number,
    vm: PenaltyViewModel,
  ): void {
    const url = vm.cardImages?.get(cardId);
    const texture = url ? this._cardTextures.get(url) : undefined;
    if (!texture) {
      sprite.visible = false;
      return;
    }
    sprite.texture = texture;
    sprite.visible = true;
    this._fitContain(sprite, 310, 400);
  }

  // Shows the active card a side fired (if any) as a small corner badge.
  private _setDuelActive(
    sprite: Sprite,
    side: "striker" | "goalkeeper",
    ev: { activesFired: ReadonlyArray<{ by: string; cardId: number }> },
    vm: PenaltyViewModel,
  ): void {
    const fired = ev.activesFired.find((a) => a.by === side);
    const url = fired ? vm.cardImages?.get(fired.cardId) : undefined;
    const texture = url ? this._cardTextures.get(url) : undefined;
    if (!texture) {
      sprite.visible = false;
      return;
    }
    sprite.texture = texture;
    sprite.visible = true;
    this._fitContain(sprite, 80, 96);
  }

  private _resetScene(): void {
    if (!this._strikerChar || !this._keeperChar) return;

    this._strikerChar.reset();
    this._strikerChar.x = LAYOUT.STRIKER_POS.x;
    this._strikerChar.y = LAYOUT.STRIKER_POS.y;

    this._keeperChar.reset();
    this._keeperChar.x = LAYOUT.KEEPER_POS.x;
    this._keeperChar.y = LAYOUT.KEEPER_POS.y;
    if (this._keeperChar.scale) {
      this._keeperChar.scale.x = Math.abs(this._keeperChar.scale.x);
    }

    this._ballSprite.x = LAYOUT.BALL_POS.x;
    this._ballSprite.y = LAYOUT.BALL_POS.y;
    this._ballSprite.rotation = 0;
    if (this._ballSprite.zIndex !== undefined) this._ballSprite.zIndex = 1;

    this._applyRoleColors(this._currentHumanRole);
  }

  private _startRevealAnimation(vm: PenaltyViewModel): void {
    this._vsTxt.visible = true;
    this._duelBgFlash.alpha = 0;
    const evidence = vm.lastOutcome?.evidence;
    if (!evidence) {
      queueMicrotask(() => this._presenter?.acknowledgeReveal());
      return;
    }

    const noopChar = makeNoopCharacter();
    const coinSprite = this._coinSprite;
    const coinFrames = this._coinFrames;
    const coin =
      coinSprite && coinFrames
        ? {
            get visible() {
              return coinSprite.visible;
            },
            set visible(v: boolean) {
              coinSprite.visible = v;
            },
            setFrame(f: 0 | 1) {
              coinSprite.texture = coinFrames[f];
            },
          }
        : null;

    this._animation = new PenaltyAnimation({
      striker: this._strikerChar ?? noopChar,
      goalkeeper: this._keeperChar ?? noopChar,
      ball: this._ballSprite,
      ballPositions: {
        start: { x: LAYOUT.BALL_POS.x, y: LAYOUT.BALL_POS.y },
        left: LAYOUT.BALL_TARGET_LEFT,
        center: LAYOUT.BALL_TARGET_CENTER,
        right: LAYOUT.BALL_TARGET_RIGHT,
      },
      strikerPos: { x: LAYOUT.STRIKER_POS.x, y: LAYOUT.STRIKER_POS.y },
      keeperPos: { x: LAYOUT.KEEPER_POS.x, y: LAYOUT.KEEPER_POS.y },
      cardDuelPanel: this.duelPanel,
      darkenOverlay: this.darkenOverlay,
      evidence,
      isGoal: vm.lastOutcome!.goal,
      humanIsStriker: vm.humanRole === "striker",
      coin,
      humanCard: this._duelHumanSprite,
      humanActiveCard: this._duelHumanActiveSprite.visible
        ? this._duelHumanActiveSprite
        : null,
      aiCard: this._duelAiSprite,
      aiActiveCard: this._duelAiActiveSprite.visible
        ? this._duelAiActiveSprite
        : null,
      humanCardRestX: LAYOUT.DUEL_PANEL.x + LAYOUT.DUEL_PANEL.w / 4,
      aiCardRestX: LAYOUT.DUEL_PANEL.x + (LAYOUT.DUEL_PANEL.w * 3) / 4,
      humanColor: this._humanKitColor,
      aiColor: this._aiKitColor,
      onBallKick: () => {
        sfx.play(SOUND_ALIASES.kickBall);
      },
      onCoinStart: () => {
        this._vsTxt.visible = false;
        sfx.play(SOUND_ALIASES.coinFlip);
      },
      onCoinEnd: () => {
        sfx.stop(SOUND_ALIASES.coinFlip);
      },
      onDuelStart: () => {
        sfx.play(SOUND_ALIASES.drumRoll);
      },
      onClash: (winnerIsHuman: boolean) => this._onDuelClash(winnerIsHuman),
      onComplete: () => {
        this._animation = null;
        this._presenter?.acknowledgeReveal();
      },
    });
    this._animation.start();
    this._applyRoleColors(this._currentHumanRole);
  }

  private _onDuelClash(winnerIsHuman: boolean): void {
    this._vsTxt.visible = false;
    sfx.play(SOUND_ALIASES.punch);
    const winnerColor = winnerIsHuman ? this._humanKitColor : this._aiKitColor;

    // Flood the entire screen with the winner's color, then fade out
    this._duelBgFlash.clear();
    this._duelBgFlash
      .rect(0, 0, LAYOUT.CANVAS_W, LAYOUT.CANVAS_H)
      .fill({ color: winnerColor, alpha: 1 });
    this._duelBgFlash.alpha = 0.7;

    // Repaint left/right backgrounds with the winner's color — full screen height
    const w = LAYOUT.CANVAS_W;
    this._duelBgLeft.clear();
    this._duelBgLeft
      .rect(0, 0, w / 2, LAYOUT.CANVAS_H)
      .fill({ color: winnerColor, alpha: 0.5 });

    this._duelBgRight.clear();
    this._duelBgRight
      .rect(w / 2, 0, w / 2, LAYOUT.CANVAS_H)
      .fill({ color: winnerColor, alpha: 0.5 });

    // Animate flash alpha from 0.7 → 0 over ~400ms (skip in headless envs)
    if (typeof requestAnimationFrame !== "undefined") {
      let elapsed = 0;
      const ticker = Ticker.shared;
      const fadeFlash = (dt: Ticker) => {
        elapsed += dt.deltaMS;
        this._duelBgFlash.alpha = Math.max(0, 0.7 * (1 - elapsed / 400));
        if (elapsed >= 400) ticker.remove(fadeFlash);
      };
      ticker.add(fadeFlash);
    }
  }

  /** Fade the full-screen GOAL/MISS result panel in from alpha 0 → 1 (skip in headless envs). */
  private _fadeInResultPanel(): void {
    this.resultPanel.alpha = 0;
    if (typeof requestAnimationFrame === "undefined") {
      this.resultPanel.alpha = 1;
      return;
    }
    const ticker = Ticker.shared;
    let elapsed = 0;
    const fadeIn = (dt: Ticker) => {
      elapsed += dt.deltaMS;
      this.resultPanel.alpha = Math.min(1, elapsed / 120);
      if (elapsed >= 120) ticker.remove(fadeIn);
    };
    ticker.add(fadeIn);
  }

  // ─── Private: resize — reposition panels ─────────────────────────────────

  private _repositionPanels(sx: number, sy: number): void {
    const panels: Container[] = [
      this.scoreDisplay,
      this.playerArea,
      this.sidePicker,
      this.cardRow,
      this.actionRow,
      this.confirmButton,
      this.darkenOverlay,
      this.duelPanel,
      this.resultPanel,
      this.gameOverPanel,
    ];
    for (const p of panels) {
      p.x = 0;
      p.y = 0;
      p.scale.set(sx, sy);
    }
    // Score and Confirm have non-zero base positions
    this.scoreDisplay.x = LAYOUT.SCORE.x * sx;
    this.scoreDisplay.y = LAYOUT.SCORE.y * sy;
    this.confirmButton.x = LAYOUT.CONFIRM_BTN.x * sx;
    this.confirmButton.y = LAYOUT.CONFIRM_BTN.y * sy;
    // Reset confirm scale (it was just zeroed by the loop)
    this.confirmButton.scale.set(sx, sy);
    // Coin lives in the root container (above duelPanel) — position and scale manually.
    if (this._coinSprite) {
      this._coinSprite.x = LAYOUT.GOAL.cx * sx;
      this._coinSprite.y = 410 * sy;
      this._coinSprite.scale.set(7 * sx, 7 * sy);
    }
  }

  // ─── Private: helpers ─────────────────────────────────────────────────────

  private _makeButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    options?: { textColor?: number; border?: boolean },
  ): Container {
    const btn = new Container();
    btn.x = x;
    btn.y = y;
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerdown", () => sfx.play(SOUND_ALIASES.buttonClick));

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color });
    if (options?.border) {
      // Same pixel-art ink border used by HomeScreen's gold CTA button.
      const INK = 0x070b14;
      bg.rect(0, 0, w, 2).fill(INK);
      bg.rect(0, h - 2, w, 2).fill(INK);
      bg.rect(0, 0, 2, h).fill(INK);
      bg.rect(w - 2, 0, 2, h).fill(INK);
    }
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: {
        fill: options?.textColor ?? 0xffffff,
        fontFamily: "Minecraft",
        fontSize: 18,
        align: "center",
      },
    });
    txt.anchor.set(0.5);
    txt.x = w / 2;
    txt.y = h / 2;
    btn.addChild(txt);

    return btn;
  }
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function makeNoopCharacter(): LayeredCharacter {
  return {
    reset() {},
    setFrame() {},
    play() {},
    setRotationRadians() {},
    tick() {},
    setLayerTint() {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
