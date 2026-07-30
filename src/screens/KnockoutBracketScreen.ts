import { Container, Filter, Graphics, Text, Ticker } from "pixi.js";
import type {
  Tournament,
  KnockoutBracket,
  KnockoutRound,
} from "../entities/Tournament/Tournament.ts";
import type {
  TournamentMatch,
  TournamentPhase,
} from "../entities/Tournament/TournamentMatch.ts";
import type { WorldCupTeam } from "../entities/Tournament/WorldCupTeam.ts";
import { FlagRenderer } from "./utils/FlagRenderer.ts";
import { makeText } from "./utils/UIComponents.ts";
import { getTeamById } from "../entities/Tournament/TeamData.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../engine/resize/designSize.ts";

// ─── Layout (fixed landscape 1280x720 buffer — see designSize.ts) ─────────────

const W = DESIGN_WIDTH;
const H = DESIGN_HEIGHT;
const TOP_BAR_H = 40;
const COL_LABEL_Y = TOP_BAR_H + 6; // 46
const CONTENT_TOP = COL_LABEL_Y + 24; // 70 — room for the label row + buffer
const CONTENT_BOT = H - 48; // 672 — 48px reserved for the bottom action button
const MATCH_W = 150;
const COL_GAP = 60;
const FLAG_W = 15;
const FLAG_H = 10;
const TEAM_ROW_H = 15;

// Larger panels for rounds with spare vertical room (r16/qf/sf/final/3rd)
const MATCH_H_COMPACT = 34; // r32 — 16 matches, vertical space is the limit
const MATCH_H_LARGE = 68; // r16, qf, sf, final, 3rd place
const FLAG_W_LARGE = 20;
const FLAG_H_LARGE = 13;
const TEAM_ROW_H_LARGE = 22;

// Column x anchors (left edge of each panel). Landscape gives 1280px of
// width vs. the old portrait canvas's 768 — columns spread out with wider
// panels (150 vs 120) and a generous 60px gap instead of being squeezed.
const COL_X: Record<string, number> = {
  r32: 40,
  r16: 40 + (MATCH_W + COL_GAP), // 250
  qf: 40 + 2 * (MATCH_W + COL_GAP), // 460
  sf: 40 + 3 * (MATCH_W + COL_GAP), // 670
  final: 40 + 4 * (MATCH_W + COL_GAP), // 880
  champ: 40 + 5 * (MATCH_W + COL_GAP), // 1090
};

// Match panel height per round
const MATCH_H_BY_PHASE: Record<string, number> = {
  r32: MATCH_H_COMPACT,
  r16: MATCH_H_LARGE,
  qf: MATCH_H_LARGE,
  sf: MATCH_H_LARGE,
  final: MATCH_H_LARGE,
};

// Vertical spacing (center-to-center) per round — each round roughly doubles
// the previous one's spacing so the bracket visually converges, same
// proportions as the old portrait layout, recalibrated for the smaller
// available content height (602px vs. the old 900px).
const SPACING: Record<string, number> = {
  r32: 37,
  r16: 74,
  qf: 148,
  sf: 296,
  final: 296,
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG = 0x0a1120;
const PANEL = 0x142544;
const PANEL_LN = 0x2c4a82;
const GOLD = 0xf5b73d;
const CREAM = 0xf6eccf;
const GREEN = 0x18a04a;

// ─── Pending slots ────────────────────────────────────────────────────────────

let _pendingTournament: Tournament | null = null;
let _pendingOnPlayMatch: ((match: TournamentMatch) => void) | null = null;

// View-only pending slots
let _pendingViewOnlyBracket: KnockoutBracket | null = null;
let _pendingViewOnlyChampion: WorldCupTeam | null = null;
let _pendingViewOnlyPlayerTeamId: string | null = null;
let _pendingViewOnlyOnDone: (() => void) | null = null;

export function setPendingTournamentKnockout(t: Tournament): void {
  _pendingTournament = t;
}
export function setPendingOnPlayKnockoutMatch(
  cb: (match: TournamentMatch) => void,
): void {
  _pendingOnPlayMatch = cb;
}
export function setPendingViewOnlyKnockout(
  bracket: KnockoutBracket,
  champion: WorldCupTeam | null,
  playerTeamId: string,
  onDone: () => void,
): void {
  _pendingViewOnlyBracket = bracket;
  _pendingViewOnlyChampion = champion;
  _pendingViewOnlyPlayerTeamId = playerTeamId;
  _pendingViewOnlyOnDone = onDone;
}

let _pendingOnViewGroups: (() => void) | null = null;

export function setPendingOnViewGroupsFromKnockout(cb: () => void): void {
  _pendingOnViewGroups = cb;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export class KnockoutBracketScreen extends Container {
  private _tournament: Tournament | null = null;
  private _onPlayMatch: ((match: TournamentMatch) => void) | null = null;
  private _viewOnly = false;
  private _viewOnlyChampion: WorldCupTeam | null = null;
  private _onDone: (() => void) | null = null;
  private _onViewGroups: (() => void) | null = null;

  // CRT filter
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;

  constructor() {
    super();
  }

  prepare(): void {
    this._tournament = _pendingTournament;
    _pendingTournament = null;
    this._onPlayMatch = _pendingOnPlayMatch;
    _pendingOnPlayMatch = null;
    this._onViewGroups = _pendingOnViewGroups;
    _pendingOnViewGroups = null;

    // Consume view-only pending slots
    if (_pendingViewOnlyBracket) {
      this._viewOnly = true;
      this._viewOnlyChampion = _pendingViewOnlyChampion;
      this._tournament = {
        knockoutBracket: _pendingViewOnlyBracket,
        playerTeam: { id: _pendingViewOnlyPlayerTeamId! } as WorldCupTeam,
      } as Tournament;
      this._onDone = _pendingViewOnlyOnDone;
      _pendingViewOnlyBracket = null;
      _pendingViewOnlyChampion = null;
      _pendingViewOnlyPlayerTeamId = null;
      _pendingViewOnlyOnDone = null;
    }

    if (!this._tournament) return;
    this._build();
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
    this._tournament = null;
    this._onPlayMatch = null;
    this._onDone = null;
    this._onViewGroups = null;
    this._viewOnly = false;
    this._viewOnlyChampion = null;
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  private _build(): void {
    // Background
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill({ color: BG });
    this.addChild(bg);

    // Top bar (nav tabs + player info + section heading)
    this._buildTopBar();

    // Column labels
    const colLabelY = COL_LABEL_Y;
    const colLabelKeys: Array<{ key: string; label: string }> = [
      { key: "r32", label: "R32" },
      { key: "r16", label: "R16" },
      { key: "qf", label: "QF" },
      { key: "sf", label: "SF" },
      { key: "final", label: "FINAL" },
      { key: "champ", label: "CHAMPION" },
    ];
    for (const { key, label } of colLabelKeys) {
      const txt = makeText(label, "body", 18, PANEL_LN);
      txt.x = COL_X[key];
      txt.y = colLabelY;
      this.addChild(txt);
    }

    const bracket = this._tournament?.knockoutBracket;
    if (!bracket) return;

    const playerTeamId = this._tournament!.playerTeam.id;

    // Build main 5 columns and collect y positions for connectors
    const phaseKeys: TournamentPhase[] = ["r32", "r16", "qf", "sf", "final"];
    const panelYMap = new Map<TournamentPhase, number[]>();

    for (const phase of phaseKeys) {
      const round = bracket.rounds.find((r) => r.phase === phase);
      if (!round) {
        panelYMap.set(phase, []);
        continue;
      }
      const yList = this._buildColumn(
        round,
        COL_X[phase],
        SPACING[phase],
        MATCH_H_BY_PHASE[phase],
        playerTeamId,
      );
      panelYMap.set(phase, yList);
    }

    // Connector lines
    this._buildConnectors(panelYMap);

    // 3rd place
    this._build3rdPlace(
      bracket,
      playerTeamId,
      panelYMap.get("final")?.[0] ?? CONTENT_TOP,
    );

    // Champion label
    if (this._viewOnly && this._viewOnlyChampion) {
      this._buildChampionLabel(
        this._viewOnlyChampion,
        panelYMap.get("final")?.[0] ?? CONTENT_TOP,
      );
    }

    // Bottom action button: "PLAY AGAIN" once eliminated/finished (view-only),
    // or "PLAY" for the player's pending match in the active round otherwise.
    if (this._viewOnly) {
      this._buildPlayAgainBtn();
    } else {
      const activeRound = bracket.rounds.find(
        (r) => r.phase === this._tournament!.phase,
      );
      const pendingMatch = activeRound?.matches.find((m) => {
        const isPlayer =
          m.isPlayerMatch ||
          m.home.id === playerTeamId ||
          m.away.id === playerTeamId;
        return (
          isPlayer &&
          m.homeGoals === null &&
          m.home.id !== "tbd" &&
          m.away.id !== "tbd"
        );
      });
      if (pendingMatch) {
        this._buildPlayMatchBtn(pendingMatch);
      }
    }

    // CRT filter (guarded for non-browser environments)
    if (typeof requestAnimationFrame !== "undefined") {
      try {
        this._crtFilter = createCRTFilter();
        this.filters = [this._crtFilter];
        this._crtTicker = (t: Ticker) => {
          if (!this._crtFilter) return;
          const u = this._crtFilter.resources["crtUniforms"] as {
            uniforms: { uTime: number };
          };
          u.uniforms.uTime += t.deltaTime * 0.016;
        };
        Ticker.shared.add(this._crtTicker);
      } catch {
        // headless test env — no WebGL
      }
    }
  }

  // ─── Top bar ─────────────────────────────────────────────────────────────

  private _buildTopBar(): void {
    // Background
    const bg = new Graphics();
    bg.rect(0, 0, W, TOP_BAR_H).fill(BG);
    this.addChild(bg);

    // Bottom border
    const border = new Graphics();
    border.rect(0, TOP_BAR_H - 1, W, 1).fill(PANEL_LN);
    this.addChild(border);

    // Nav tabs centered — GROUPS (clickable when bidirectional nav is wired),
    // BRACKET (active, this screen)
    const NAV_TAB_W = 120;
    const NAV_GAP = 4;
    const navTabs: Array<{
      label: string;
      active: boolean;
      onClick: (() => void) | null;
    }> = [
      { label: "GROUPS", active: false, onClick: this._onViewGroups },
      { label: "BRACKET", active: true, onClick: null },
    ];

    const totalNavW =
      navTabs.length * NAV_TAB_W + (navTabs.length - 1) * NAV_GAP;
    const navStartX = (W - totalNavW) / 2;

    navTabs.forEach((tab, i) => {
      const tabContainer = new Container();
      tabContainer.x = navStartX + i * (NAV_TAB_W + NAV_GAP);
      tabContainer.y = 0;

      if (tab.active) {
        const tabBg = new Graphics();
        tabBg.rect(0, 0, NAV_TAB_W, TOP_BAR_H).fill(GOLD);
        tabContainer.addChild(tabBg);
      }

      const tabText = makeText(
        tab.label,
        "body",
        14,
        tab.active ? 0x17171f : 0x6b5e47,
      );
      tabText.anchor.set(0.5, 0.5);
      tabText.x = NAV_TAB_W / 2;
      tabText.y = TOP_BAR_H / 2;
      tabContainer.addChild(tabText);

      if (tab.onClick) {
        tabContainer.eventMode = "static";
        tabContainer.cursor = "pointer";
        tabContainer.on("pointerdown", () => {
          sfx.play(SOUND_ALIASES.buttonClick);
          tab.onClick?.();
        });
      }

      this.addChild(tabContainer);
    });

    // Player team flag + abbreviation at far right (resolved via TeamData since
    // the view-only fake tournament's playerTeam only carries an id)
    let teamData: WorldCupTeam | null = null;
    try {
      teamData = getTeamById(this._tournament!.playerTeam.id);
    } catch {
      teamData = null;
    }
    if (teamData) {
      const playerFlag = FlagRenderer.make(teamData.flagSpec, 24, 16);
      playerFlag.x = W - 16 - 56;
      playerFlag.y = (TOP_BAR_H - 16) / 2;
      this.addChild(playerFlag);

      const playerAbbr = makeText(teamData.abbreviation, "body", 14, CREAM);
      playerAbbr.anchor.set(1, 0);
      playerAbbr.x = W - 16;
      playerAbbr.y = (TOP_BAR_H - 14) / 2;
      this.addChild(playerAbbr);
    }
  }

  private _buildColumn(
    round: KnockoutRound,
    colX: number,
    spacing: number,
    matchH: number,
    playerTeamId: string,
  ): number[] {
    const matches = round.matches;
    const totalHeight = Math.max(0, matches.length - 1) * spacing;
    const contentH = CONTENT_BOT - CONTENT_TOP;
    const startY =
      CONTENT_TOP + Math.max(0, (contentH - totalHeight - matchH) / 2);

    const yList: number[] = [];
    matches.forEach((match, i) => {
      const panelY = startY + i * spacing;
      yList.push(panelY);
      const isPlayer =
        match.isPlayerMatch ||
        match.home.id === playerTeamId ||
        match.away.id === playerTeamId;
      const panel = this._buildMatchPanel(
        match,
        colX,
        panelY,
        isPlayer,
        matchH,
      );
      this.addChild(panel);
    });
    return yList;
  }

  private _buildMatchPanel(
    match: TournamentMatch,
    x: number,
    y: number,
    isPlayer: boolean,
    panelH: number,
  ): Container {
    const panel = new Container();
    panel.x = x;
    panel.y = y;
    if (isPlayer)
      (panel as Container & { label?: string }).label = "player-match";

    const large = panelH > MATCH_H_COMPACT;
    const rowH = large ? TEAM_ROW_H_LARGE : TEAM_ROW_H;

    // Background
    const bg = new Graphics();
    if (isPlayer) {
      bg.roundRect(0, 0, MATCH_W, panelH, 4)
        .fill({ color: 0x1b315a })
        .stroke({ color: GOLD, width: 1.5 });
    } else {
      bg.roundRect(0, 0, MATCH_W, panelH, 4)
        .fill({ color: PANEL })
        .stroke({ color: PANEL_LN, width: 1 });
    }
    panel.addChild(bg);

    // Home row
    const homeY = large ? 4 : 2;
    this._buildTeamRow(
      panel,
      match.home,
      homeY,
      match.winner === match.home,
      large,
    );

    // Divider
    const divider = new Graphics();
    divider.rect(2, homeY + rowH, MATCH_W - 4, 1).fill({ color: PANEL_LN });
    panel.addChild(divider);

    // Away row
    const awayY = homeY + rowH + 2;
    this._buildTeamRow(
      panel,
      match.away,
      awayY,
      match.winner === match.away,
      large,
    );

    // Score — one value per team row (vertical pairing), right-anchored so
    // it always stays within MATCH_W regardless of digit count.
    if (match.homeGoals !== null && match.awayGoals !== null) {
      const scoreFontSize = large ? 13 : 7;
      const scoreX = MATCH_W - (large ? 10 : 6);
      this._addScoreText(
        panel,
        match.homeGoals,
        scoreX,
        homeY + rowH / 2,
        scoreFontSize,
      );
      this._addScoreText(
        panel,
        match.awayGoals,
        scoreX,
        awayY + rowH / 2,
        scoreFontSize,
      );
    }

    return panel;
  }

  private _buildTeamRow(
    parent: Container,
    team: WorldCupTeam,
    rowY: number,
    isWinner: boolean,
    large: boolean,
  ): void {
    const row = new Container();
    row.y = rowY;
    row.alpha = isWinner ? 1.0 : 0.5;

    const flagW = large ? FLAG_W_LARGE : FLAG_W;
    const flagH = large ? FLAG_H_LARGE : FLAG_H;
    const fontSize = large ? 11 : 7;
    const rowH = large ? TEAM_ROW_H_LARGE : TEAM_ROW_H;

    // Try full team data for flag and abbreviation
    let teamData: WorldCupTeam | null = null;
    if (team.id !== "tbd") {
      try {
        teamData = getTeamById(team.id);
      } catch {
        teamData = null;
      }
    }

    if (teamData) {
      const flag = FlagRenderer.make(teamData.flagSpec, flagW, flagH);
      flag.x = 4;
      flag.y = Math.max(0, Math.floor((rowH - flagH) / 2));
      row.addChild(flag);

      const abbr = makeText(teamData.abbreviation, "body", fontSize, CREAM);
      abbr.x = flagW + 8;
      abbr.y = Math.max(0, Math.floor((rowH - fontSize) / 2));
      row.addChild(abbr);
    } else {
      const tbd = makeText("???", "body", fontSize, PANEL_LN);
      tbd.x = 4;
      tbd.y = Math.max(0, Math.floor((rowH - fontSize) / 2));
      row.addChild(tbd);
    }

    parent.addChild(row);
  }

  // Right-anchored score digit for a single team row.
  private _addScoreText(
    parent: Container,
    value: number,
    x: number,
    y: number,
    fontSize: number,
  ): void {
    const txt = makeText(`${value}`, "body", fontSize, GOLD);
    txt.anchor.set(1, 0.5);
    txt.x = x;
    txt.y = y;
    parent.addChild(txt);
  }

  private _buildConnectors(panelYMap: Map<TournamentPhase, number[]>): void {
    const roundKeys: TournamentPhase[] = ["r32", "r16", "qf", "sf", "final"];
    const g = new Graphics();
    g.setStrokeStyle({ width: 1, color: GOLD, alpha: 0.6 });

    for (let k = 0; k < 4; k++) {
      const srcPhase = roundKeys[k];
      const dstPhase = roundKeys[k + 1];
      const srcYs = panelYMap.get(srcPhase) ?? [];
      const dstYs = panelYMap.get(dstPhase) ?? [];
      const srcH = MATCH_H_BY_PHASE[srcPhase];
      const dstH = MATCH_H_BY_PHASE[dstPhase];
      const srcX = COL_X[srcPhase] + MATCH_W;
      const dstX = COL_X[dstPhase];
      const midX = (srcX + dstX) / 2;

      for (let i = 0; i < srcYs.length; i++) {
        const parentIdx = Math.floor(i / 2);
        if (parentIdx >= dstYs.length) continue;
        const srcY = srcYs[i] + srcH / 2;
        const dstY = dstYs[parentIdx] + dstH / 2;
        g.moveTo(srcX, srcY)
          .lineTo(midX, srcY)
          .lineTo(midX, dstY)
          .lineTo(dstX, dstY);
      }
    }
    g.stroke();
    this.addChild(g);
  }

  private _build3rdPlace(
    bracket: KnockoutBracket,
    playerTeamId: string,
    finalY: number,
  ): void {
    const thirdRound = bracket.rounds.find((r) => r.phase === "3rd");
    const match = thirdRound?.matches[0] ?? null;

    // Position: aligned with the FINAL panel, in the gap between the two SF panels
    const y = finalY;
    const x = COL_X["sf"];

    const label = makeText("3RD PLACE", "body", 9, PANEL_LN);
    label.x = x;
    label.y = y - 16;
    this.addChild(label);

    if (match) {
      const isPlayer =
        match.isPlayerMatch ||
        match.home.id === playerTeamId ||
        match.away.id === playerTeamId;
      const panel = this._buildMatchPanel(match, x, y, isPlayer, MATCH_H_LARGE);
      this.addChild(panel);
    }
  }

  private _buildChampionLabel(champion: WorldCupTeam, finalY: number): void {
    const x = COL_X["champ"];

    const labelTxt = makeText("WORLD CUP CHAMPION", "body", 8, PANEL_LN);
    labelTxt.x = x;
    labelTxt.y = finalY - 20;
    this.addChild(labelTxt);

    // Try to get full team data for flag and name
    let teamData: WorldCupTeam | null = null;
    try {
      teamData = getTeamById(champion.id);
    } catch {
      teamData = null;
    }

    const teamName =
      teamData?.name ?? champion.name ?? champion.abbreviation ?? "???";
    const nameTxt = makeText(teamName, "title", 14, GOLD);
    nameTxt.x = x;
    nameTxt.y = finalY;
    this.addChild(nameTxt);

    if (teamData?.flagSpec) {
      const flagW = FLAG_W_LARGE * 2;
      const flagH = FLAG_H_LARGE * 2;
      const flag = FlagRenderer.make(teamData.flagSpec, flagW, flagH);
      flag.x = x;
      flag.y = finalY + 28;
      this.addChild(flag);

      const trophy = this._drawTrophy(x + flagW + 14, finalY + 28, flagH);
      this.addChild(trophy);
    }
  }

  // Simple pixel-art trophy silhouette (cup + handles + stem + base), drawn
  // to fit within a size×size box starting at (x, y).
  private _drawTrophy(x: number, y: number, size: number): Graphics {
    const g = new Graphics();
    const bowlW = size;
    const bowlH = size * 0.5;

    // Cup bowl
    g.roundRect(x, y, bowlW, bowlH, 4).fill({ color: GOLD });

    // Handles
    const handleR = size * 0.16;
    g.circle(x - handleR * 0.6, y + bowlH * 0.35, handleR).stroke({
      color: GOLD,
      width: 3,
    });
    g.circle(x + bowlW + handleR * 0.6, y + bowlH * 0.35, handleR).stroke({
      color: GOLD,
      width: 3,
    });

    // Stem
    const stemW = size * 0.18;
    g.rect(x + (bowlW - stemW) / 2, y + bowlH, stemW, size * 0.22).fill({
      color: GOLD,
    });

    // Base
    const baseW = size * 0.6;
    const baseH = size * 0.12;
    g.roundRect(
      x + (bowlW - baseW) / 2,
      y + bowlH + size * 0.22,
      baseW,
      baseH,
      2,
    ).fill({ color: GOLD });

    return g;
  }

  private _buildPlayAgainBtn(): void {
    const w = 200;
    const h = 40;
    const btn = this._makeButton(
      "PLAY AGAIN",
      GOLD,
      W / 2 - w / 2,
      H - h - 8,
      w,
      h,
      0x17171f,
    );
    btn.on("pointerdown", () => this._onDone?.());
    this.addChild(btn);
  }

  private _buildPlayMatchBtn(match: TournamentMatch): void {
    const w = 200;
    const h = 40;
    const btn = this._makeButton("PLAY", GREEN, W / 2 - w / 2, H - h - 8, w, h);
    btn.on("pointerdown", () => this._onPlayMatch?.(match));
    this.addChild(btn);
  }

  private _makeButton(
    label: string,
    color: number,
    x: number,
    y: number,
    w: number,
    h: number,
    textColor: number = CREAM,
  ): Container {
    const btn = new Container();
    btn.x = x;
    btn.y = y;
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerdown", () => sfx.play(SOUND_ALIASES.buttonClick));

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color });
    btn.addChild(bg);

    const lbl = makeText(label, "body", 16, textColor);
    lbl.anchor.set(0.5);
    lbl.x = w / 2;
    lbl.y = h / 2;
    btn.addChild(lbl);

    return btn;
  }
}
