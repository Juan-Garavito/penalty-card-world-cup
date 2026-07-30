import { Container, Filter, Graphics, Ticker } from "pixi.js";
import type { TournamentMatch } from "../entities/Tournament/TournamentMatch.ts";
import type { WorldCupTeam } from "../entities/Tournament/WorldCupTeam.ts";
import { FlagRenderer } from "./utils/FlagRenderer.ts";
import { makeText } from "./utils/UIComponents.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { bgm, sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../engine/resize/designSize.ts";

const W = DESIGN_WIDTH;
const H = DESIGN_HEIGHT;

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG         = 0x0A1120;
const PANEL      = 0x142544;
const PANEL_LN   = 0x2C4A82;
const GOLD       = 0xF5B73D;
const CREAM      = 0xF6ECCF;
const WIN_COLOR  = 0x55FF77;
const LOSE_COLOR = 0xFF5566;

// ─── Layout ──────────────────────────────────────────────────────────────────

const HEADER_H   = 40;
const BANNER_H   = 40;
const CONTENT_BOT = 648; // leaves room for the continue button
const MAX_ROW_H   = 72;
const GROUP_HEADER_H = 20;
const GRID_GAP   = 8;

// ─── Config ───────────────────────────────────────────────────────────────────

export interface MatchResultsGroup {
  groupId: string;
  matches: TournamentMatch[];
}

export interface MatchResultsConfig {
  matchGroups: MatchResultsGroup[];
  playerTeamId: string;
  roundTitle: string;
  onContinue: () => void;
  champion?: WorldCupTeam;
}

// ─── Pending slot ─────────────────────────────────────────────────────────────

let _pendingConfig: MatchResultsConfig | null = null;

export function setPendingMatchResults(cfg: MatchResultsConfig): void {
  _pendingConfig = cfg;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export class MatchResultsScreen extends Container {
  private _config: MatchResultsConfig | null = null;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // CRT filter
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;

  constructor() {
    super();
  }

  prepare(): void {
    this._config = _pendingConfig;
    _pendingConfig = null;
    if (!this._config) return;

    this._buildUI();

    if (this._config.champion) {
      sfx.play(SOUND_ALIASES.winner);
      bgm.pause();
    }

    this._keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter") this._onContinue();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._keyHandler);
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
    if (this._keyHandler) {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", this._keyHandler);
      }
      this._keyHandler = null;
    }
    this._config = null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _onContinue(): void {
    if (this._keyHandler) {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", this._keyHandler);
      }
      this._keyHandler = null;
    }
    this._config?.onContinue();
  }

  private _buildUI(): void {
    const cfg = this._config!;

    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill({ color: BG });
    this.addChild(bg);

    // Header
    const header = makeText(`${cfg.roundTitle} — RESULTS`, "title", 18, GOLD);
    header.anchor.set(0.5, 0);
    header.x = W / 2;
    header.y = 10;
    this.addChild(header);

    // Champion banner (elimination summary) or player result banner
    let hasBanner = false;
    if (cfg.champion) {
      this.addChild(this._buildChampionBanner(cfg.champion));
      hasBanner = true;
    } else {
      const playerMatch = this._findPlayerMatch(cfg);
      if (playerMatch && playerMatch.homeGoals !== null) {
        this.addChild(this._buildPlayerResultBanner(playerMatch, cfg.playerTeamId));
        hasBanner = true;
      }
    }

    // Match grid — fills the remaining space, splitting into columns when
    // there are many groups (matchday results) or many matches (e.g. R32).
    const contentTop = hasBanner ? HEADER_H + BANNER_H + 16 : HEADER_H + 16;
    this._buildGroups(cfg, contentTop);

    this.addChild(this._buildContinueBtn());

    // CRT filter (guarded for non-browser/headless test environments)
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
      // no WebGL context
    }
  }

  private _findPlayerMatch(cfg: MatchResultsConfig): TournamentMatch | undefined {
    for (const { matches } of cfg.matchGroups) {
      const m = matches.find(
        (m) => m.home.id === cfg.playerTeamId || m.away.id === cfg.playerTeamId,
      );
      if (m) return m;
    }
  }

  private _buildChampionBanner(champion: WorldCupTeam): Container {
    const banner = new Container();
    banner.y = HEADER_H + 8;

    const bg = new Graphics();
    bg.rect(0, 0, W, BANNER_H).fill({ color: PANEL }).stroke({ color: GOLD, width: 2 });
    banner.addChild(bg);

    const flag = FlagRenderer.make(champion.flagSpec, 32, 22);
    flag.x = W / 2 - 140;
    flag.y = (BANNER_H - 22) / 2;
    banner.addChild(flag);

    const txt = makeText(`CHAMPION: ${champion.name}`, "title", 16, GOLD);
    txt.anchor.set(0, 0.5);
    txt.x = W / 2 - 96;
    txt.y = BANNER_H / 2;
    banner.addChild(txt);

    return banner;
  }

  private _buildPlayerResultBanner(match: TournamentMatch, playerTeamId: string): Container {
    const isHome = match.home.id === playerTeamId;
    const hg = match.homeGoals!;
    const ag = match.awayGoals!;
    const playerGoals = isHome ? hg : ag;
    const oppGoals = isHome ? ag : hg;

    let label: string;
    let color: number;
    if (playerGoals > oppGoals) {
      label = `YOU WIN  ${playerGoals} – ${oppGoals}`;
      color = WIN_COLOR;
    } else if (playerGoals < oppGoals) {
      label = `YOU LOSE  ${playerGoals} – ${oppGoals}`;
      color = LOSE_COLOR;
    } else {
      label = `YOU DRAW  ${playerGoals} – ${oppGoals}`;
      color = GOLD;
    }

    const banner = new Container();
    banner.y = HEADER_H + 8;

    const bg = new Graphics();
    bg.rect(0, 0, W, BANNER_H).fill({ color: PANEL }).stroke({ color, width: 2 });
    banner.addChild(bg);

    const txt = makeText(label, "title", 16, color);
    txt.anchor.set(0.5, 0.5);
    txt.x = W / 2;
    txt.y = BANNER_H / 2;
    banner.addChild(txt);

    return banner;
  }

  // ─── Grid ────────────────────────────────────────────────────────────────

  private _buildGroups(cfg: MatchResultsConfig, contentTop: number): void {
    const groups = cfg.matchGroups;

    // Decide how many columns of group blocks to lay out.
    let cols: number;
    if (groups.length >= 6) cols = 3;
    else if (groups.length >= 3) cols = 2;
    else cols = 1;

    // A single group with many matches (e.g. Round of 32 = 16) is split
    // across columns instead, so rows stay a readable size.
    let blocks: MatchResultsGroup[];
    let showLabels = groups.length > 1;
    if (groups.length === 1 && groups[0].matches.length > 8) {
      cols = 2;
      showLabels = false;
      const half = Math.ceil(groups[0].matches.length / 2);
      blocks = [
        { groupId: groups[0].groupId, matches: groups[0].matches.slice(0, half) },
        { groupId: groups[0].groupId, matches: groups[0].matches.slice(half) },
      ];
    } else {
      blocks = groups;
    }

    const rowsPerCol = Math.ceil(blocks.length / cols);
    const colW = Math.floor((W - GRID_GAP * (cols + 1)) / cols);
    const sectionH = Math.floor((CONTENT_BOT - contentTop) / rowsPerCol);

    blocks.forEach((grp, idx) => {
      const col = Math.floor(idx / rowsPerCol);
      const row = idx % rowsPerCol;
      const x = GRID_GAP + col * (colW + GRID_GAP);
      const y = contentTop + row * sectionH;
      const isPlayerGroup = grp.matches.some(
        (m) => m.home.id === cfg.playerTeamId || m.away.id === cfg.playerTeamId,
      );
      this.addChild(
        this._buildGroupBlock(grp, cfg.playerTeamId, x, y, colW, sectionH - GRID_GAP, isPlayerGroup, showLabels),
      );
    });
  }

  private _buildGroupBlock(
    grp: MatchResultsGroup,
    playerTeamId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    isPlayerGroup: boolean,
    showLabel: boolean,
  ): Container {
    const block = new Container();
    block.x = x;
    block.y = y;

    const headerH = showLabel ? GROUP_HEADER_H : 0;
    const rowH = Math.min(MAX_ROW_H, Math.floor((h - headerH) / Math.max(1, grp.matches.length)));
    const usedH = headerH + rowH * grp.matches.length;
    const offsetY = Math.max(0, Math.floor((h - usedH) / 2));

    if (showLabel) {
      const lbl = makeText(`GROUP ${grp.groupId}`, "body", 14, isPlayerGroup ? GOLD : CREAM);
      lbl.x = 4;
      lbl.y = offsetY;
      block.addChild(lbl);
    }

    grp.matches.forEach((match, i) => {
      const isPlayer = match.home.id === playerTeamId || match.away.id === playerTeamId;
      block.addChild(
        this._buildMatchRow(match, playerTeamId, 0, offsetY + headerH + i * rowH, w, rowH, isPlayer),
      );
    });

    return block;
  }

  private _buildMatchRow(
    match: TournamentMatch,
    playerTeamId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    isPlayer: boolean,
  ): Container {
    const row = new Container();
    row.x = x;
    row.y = y;

    const pad = 4;
    const rowW = w - pad * 2;
    const rowH = h - pad;

    const bg = new Graphics();
    if (isPlayer) {
      bg.roundRect(pad, 0, rowW, rowH, 4).fill({ color: 0x1B315A }).stroke({ color: GOLD, width: 1.5 });
    } else {
      bg.roundRect(pad, 0, rowW, rowH, 4).fill({ color: PANEL }).stroke({ color: PANEL_LN, width: 1 });
    }
    row.addChild(bg);

    const flagW = Math.min(28, Math.floor(rowH * 0.4));
    const flagH = Math.floor((flagW * 2) / 3);
    const fontSize = Math.max(10, Math.min(16, Math.floor(rowH * 0.22)));

    // Home team (left)
    const homeFlag = FlagRenderer.make(match.home.flagSpec, flagW, flagH);
    homeFlag.x = pad + 8;
    homeFlag.y = (rowH - flagH) / 2;
    row.addChild(homeFlag);

    const homeName = makeText(match.home.abbreviation, "body", fontSize, CREAM);
    homeName.x = pad + 8 + flagW + 6;
    homeName.y = (rowH - fontSize) / 2;
    row.addChild(homeName);

    // Score / VS (center)
    if (match.homeGoals !== null && match.awayGoals !== null) {
      const scoreColor = this._scoreColor(match, playerTeamId);
      const score = makeText(`${match.homeGoals} - ${match.awayGoals}`, "title", fontSize + 4, scoreColor);
      score.anchor.set(0.5, 0.5);
      score.x = pad + rowW / 2;
      score.y = rowH / 2;
      row.addChild(score);
    } else {
      const vs = makeText("VS", "body", fontSize, PANEL_LN);
      vs.anchor.set(0.5, 0.5);
      vs.x = pad + rowW / 2;
      vs.y = rowH / 2;
      row.addChild(vs);
    }

    // Away team (right)
    const awayName = makeText(match.away.abbreviation, "body", fontSize, CREAM);
    awayName.anchor.set(1, 0);
    awayName.x = pad + rowW - 8 - flagW - 6;
    awayName.y = (rowH - fontSize) / 2;
    row.addChild(awayName);

    const awayFlag = FlagRenderer.make(match.away.flagSpec, flagW, flagH);
    awayFlag.x = pad + rowW - 8 - flagW;
    awayFlag.y = (rowH - flagH) / 2;
    row.addChild(awayFlag);

    return row;
  }

  private _scoreColor(match: TournamentMatch, playerTeamId: string): number {
    const playerIsHome = match.home.id === playerTeamId;
    const playerIsAway = match.away.id === playerTeamId;
    if (!playerIsHome && !playerIsAway) return GOLD;
    const hg = match.homeGoals!;
    const ag = match.awayGoals!;
    if (hg === ag) return GOLD;
    const playerWon = (playerIsHome && hg > ag) || (playerIsAway && ag > hg);
    return playerWon ? WIN_COLOR : LOSE_COLOR;
  }

  private _buildContinueBtn(): Container {
    const w = 220;
    const h = 48;
    const btn = new Container();
    btn.x = W / 2 - w / 2;
    btn.y = H - h - 16;
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      this._onContinue();
    });

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 6).fill({ color: GOLD });
    btn.addChild(bg);

    const lbl = makeText("CONTINUE", "title", 16, 0x17171F);
    lbl.anchor.set(0.5);
    lbl.x = w / 2;
    lbl.y = h / 2;
    btn.addChild(lbl);

    return btn;
  }
}
