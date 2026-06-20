import { Container, Filter, Graphics, Ticker } from "pixi.js";
import type { Tournament } from "../entities/Tournament/Tournament.ts";
import type { TournamentMatch } from "../entities/Tournament/TournamentMatch.ts";
import type { TournamentGroup } from "../entities/Tournament/TournamentGroup.ts";
import { getMatchday } from "../entities/Tournament/GroupSimulator.ts";
import { computeStandings, rankThirdPlaceTeams } from "../entities/Tournament/StandingsCalculator.ts";
import { FlagRenderer } from "./utils/FlagRenderer.ts";
import { makeText } from "./utils/UIComponents.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";

// ─── Layout ──────────────────────────────────────────────────────────────────

const W = 1280;
const H = 720;

const TOP_BAR_H = 40;
const SECTION_H = 28;
const TABS_H = 36;
const CONTENT_TOP = TOP_BAR_H + SECTION_H + TABS_H; // 104

const LEFT_W = 556;
const DIVIDER_X = 556;
const RIGHT_X = 562;
const RIGHT_W = W - RIGHT_X - 16;

const TAB_W = Math.floor(W / 12); // 106

const ROW_H = 36;
const RESULT_ROW_H = 26;
const HEADER_ROW_H = 22;

// Standings column x-positions (relative to left panel x=0)
const COL_BAR_W = 6;
const COL_RANK_X = 10;
const COL_FLAG_X = 36;
const COL_NAME_X = 72;
const COL_P_X = 254;
const COL_W_X = 284;
const COL_D_X = 314;
const COL_L_X = 344;
const COL_GF_X = 376;
const COL_GA_X = 406;
const COL_GD_X = 436;
const COL_PTS_X = 510;

// ─── Pending slots ────────────────────────────────────────────────────────────

let _pendingTournament: Tournament | null = null;
let _pendingOnPlayMatch: ((match: TournamentMatch) => void) | null = null;
let _pendingOnGroupComplete: (() => void) | null = null;
let _pendingOnGroupEliminated: ((groupId: string) => void) | null = null;

export function setPendingTournament(t: Tournament): void {
  _pendingTournament = t;
}
export function setPendingOnPlayMatch(cb: (match: TournamentMatch) => void): void {
  _pendingOnPlayMatch = cb;
}
export function setPendingOnGroupComplete(cb: () => void): void {
  _pendingOnGroupComplete = cb;
}
export function setPendingOnGroupEliminated(cb: (groupId: string) => void): void {
  _pendingOnGroupEliminated = cb;
}

let _pendingOnViewBracket: (() => void) | null = null;

export function setPendingOnViewBracketFromGroups(cb: () => void): void {
  _pendingOnViewBracket = cb;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export class GroupStageScreen extends Container {
  private _tournament: Tournament | null = null;
  private _onPlayMatch: ((match: TournamentMatch) => void) | null = null;
  private _onGroupComplete: (() => void) | null = null;
  private _onGroupEliminated: ((groupId: string) => void) | null = null;
  private _onViewBracket: (() => void) | null = null;
  private _group: TournamentGroup | null = null;
  private _displayGroupIdx = 0;
  private _playerGroupIdx = 0;

  // CRT filter
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;

  // Sub-containers rebuilt on tab change
  private _leftContent!: Container;
  private _rightContent!: Container;

  constructor() {
    super();
  }

  prepare(): void {
    this._tournament = _pendingTournament;
    _pendingTournament = null;
    this._onPlayMatch = _pendingOnPlayMatch;
    _pendingOnPlayMatch = null;
    this._onGroupComplete = _pendingOnGroupComplete;
    _pendingOnGroupComplete = null;
    this._onGroupEliminated = _pendingOnGroupEliminated;
    _pendingOnGroupEliminated = null;
    this._onViewBracket = _pendingOnViewBracket;
    _pendingOnViewBracket = null;

    if (!this._tournament) return;

    // Find the player's group
    const playerTeamId = this._tournament.playerTeam.id;
    this._playerGroupIdx = this._tournament.groups.findIndex((g) =>
      g.teams.some((t) => t.id === playerTeamId),
    );
    if (this._playerGroupIdx === -1) return;
    this._displayGroupIdx = this._playerGroupIdx;
    this._group = this._tournament.groups[this._playerGroupIdx];

    // Initialize match slots for every group so all tabs show their fixtures
    for (const group of this._tournament.groups) {
      this._initGroupMatches(group, playerTeamId);
    }

    this._buildUI();
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
    this._onGroupComplete = null;
    this._onGroupEliminated = null;
    this._onViewBracket = null;
    this._group = null;
    this._displayGroupIdx = 0;
    this._playerGroupIdx = 0;
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  private _initGroupMatches(group: TournamentGroup, playerTeamId: string): void {
    const teams = group.teams;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const id = `${group.id}-${teams[i].id}-vs-${teams[j].id}`;
        if (group.matches.find((m) => m.id === id)) continue;
        group.matches.push({
          id,
          home: teams[i],
          away: teams[j],
          homeGoals: null,
          awayGoals: null,
          winner: null,
          phase: "group",
          isPlayerMatch: teams[i].id === playerTeamId || teams[j].id === playerTeamId,
        });
      }
    }
  }

  // ─── Build UI ─────────────────────────────────────────────────────────────

  private _buildUI(): void {
    // Clean up CRT ticker from previous build
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.filters = [];
    this._crtFilter = null;

    this.removeChildren();

    const tournament = this._tournament!;

    // ── Base backgrounds (rendered first — behind nav, tabs, and content) ──
    const screenBg = new Graphics();
    screenBg.rect(0, 0, W, H).fill(0x0A1120);
    this.addChild(screenBg);

    const leftBg = new Graphics();
    leftBg.rect(0, CONTENT_TOP, LEFT_W, H - CONTENT_TOP).fill(0x142544);
    this.addChild(leftBg);

    // ── Navigation bar, section header, group letter tabs ──
    this._buildTopBar(tournament);
    this._buildSectionHeader();
    this._buildGroupTabs(tournament);

    // ── Content containers (on top of everything) ──
    this._leftContent = new Container();
    this._leftContent.y = CONTENT_TOP;
    this.addChild(this._leftContent);

    this._rightContent = new Container();
    this._rightContent.x = RIGHT_X;
    this._rightContent.y = CONTENT_TOP;
    this.addChild(this._rightContent);

    this._rebuildPanelContents();

    // Vertical divider
    const divider = new Graphics();
    divider.rect(DIVIDER_X, CONTENT_TOP, 2, H - CONTENT_TOP).fill(0x2C4A82);
    this.addChild(divider);

    // CRT filter (at the very end)
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

  // ─── Top bar ─────────────────────────────────────────────────────────────

  private _buildTopBar(tournament: Tournament): void {
    // Background
    const bg = new Graphics();
    bg.rect(0, 0, W, TOP_BAR_H).fill(0x0A1120);
    this.addChild(bg);

    // Bottom border
    const border = new Graphics();
    border.rect(0, TOP_BAR_H - 1, W, 1).fill(0x2C4A82);
    this.addChild(border);

    // Nav tab(s) centered
    const NAV_TAB_W = 120;
    const NAV_GAP = 4;

    const navTabs: Array<{ label: string; active: boolean; onClick: (() => void) | null }> = [
      { label: "GROUPS", active: true, onClick: null },
      { label: "BRACKET", active: false, onClick: this._onViewBracket },
    ];

    const totalNavW = navTabs.length * NAV_TAB_W + (navTabs.length - 1) * NAV_GAP;
    const navStartX = (W - totalNavW) / 2;

    navTabs.forEach((tab, i) => {
      const tabContainer = new Container();
      tabContainer.x = navStartX + i * (NAV_TAB_W + NAV_GAP);
      tabContainer.y = 0;

      if (tab.active) {
        const tabBg = new Graphics();
        tabBg.rect(0, 0, NAV_TAB_W, TOP_BAR_H).fill(0xF5B73D);
        tabContainer.addChild(tabBg);
      }

      const tabText = makeText(tab.label, "body", 14, tab.active ? 0x17171F : 0x6B5E47);
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

    // Player team flag + abbreviation at far right
    const playerTeam = tournament.playerTeam;
    const playerFlag = FlagRenderer.make(playerTeam.flagSpec, 24, 16);
    playerFlag.x = W - 16 - 56;
    playerFlag.y = (TOP_BAR_H - 16) / 2;
    this.addChild(playerFlag);

    const playerAbbr = makeText(playerTeam.abbreviation, "body", 14, 0xF6ECCF);
    playerAbbr.anchor.set(1, 0);
    playerAbbr.x = W - 16;
    playerAbbr.y = (TOP_BAR_H - 14) / 2;
    this.addChild(playerAbbr);
  }

  // ─── Section header ───────────────────────────────────────────────────────

  private _buildSectionHeader(): void {
    // "GROUP STAGE" label
    const heading = makeText("GROUP STAGE", "title", 9, 0xF5B73D);
    heading.x = 16;
    heading.y = TOP_BAR_H + 6;
    this.addChild(heading);

    // Right legend
    const legendY = TOP_BAR_H + 8;

    const greenRect = new Graphics();
    greenRect.rect(W - 180, legendY, 12, 12).fill(0x18A04A);
    this.addChild(greenRect);

    const advanceText = makeText("ADVANCE", "body", 16, 0xF6ECCF);
    advanceText.x = W - 164;
    advanceText.y = legendY;
    this.addChild(advanceText);

    const goldRect = new Graphics();
    goldRect.rect(W - 80, legendY, 12, 12).fill(0xF5B73D);
    this.addChild(goldRect);

    const playoffText = makeText("BEST 3", "body", 16, 0xF6ECCF);
    playoffText.x = W - 64;
    playoffText.y = legendY;
    this.addChild(playoffText);
  }

  // ─── Group tabs ───────────────────────────────────────────────────────────

  private _buildGroupTabs(tournament: Tournament): void {
    const groups = tournament.groups;
    groups.forEach((group, idx) => {
      const isActive = idx === this._displayGroupIdx;
      const isPlayerGroup = idx === this._playerGroupIdx;

      const fillColor = (isActive || isPlayerGroup) ? 0xF5B73D : 0x1B315A;
      const textColor = (isActive || isPlayerGroup) ? 0x17171F : 0xF6ECCF;

      const tab = new Container();
      tab.x = idx * TAB_W;
      tab.y = TOP_BAR_H + SECTION_H;
      tab.eventMode = "static";
      tab.cursor = "pointer";
      tab.on("pointerdown", () => {
        sfx.play(SOUND_ALIASES.buttonClick);
        this._displayGroupIdx = idx;
        this._buildUI();
      });

      const bg = new Graphics();
      bg.rect(0, 0, TAB_W - 1, TABS_H).fill(fillColor);
      tab.addChild(bg);

      const lbl = makeText(group.id, "body", 18, textColor);
      lbl.anchor.set(0.5, 0.5);
      lbl.x = (TAB_W - 1) / 2;
      lbl.y = TABS_H / 2;
      tab.addChild(lbl);

      this.addChild(tab);
    });
  }

  // ─── Panel contents ───────────────────────────────────────────────────────

  private _rebuildPanelContents(): void {
    this._leftContent.removeChildren();
    this._rightContent.removeChildren();

    const tournament = this._tournament!;
    const playerTeamId = tournament.playerTeam.id;
    const displayGroup = tournament.groups[this._displayGroupIdx];
    const isPlayerGroup = this._displayGroupIdx === this._playerGroupIdx;

    this._buildStandings(displayGroup, playerTeamId);
    this._buildResultsPanel(displayGroup, playerTeamId);

    if (isPlayerGroup) {
      this._buildButtons(this._group!, playerTeamId);
    }
  }

  // ─── Standings ────────────────────────────────────────────────────────────

  private _buildStandings(group: TournamentGroup, playerTeamId: string): void {
    // Header row at y=0
    const headerCols: Array<{ text: string; x: number; color: number }> = [
      { text: "#", x: COL_RANK_X, color: 0x2C4A82 },
      { text: "TEAM", x: COL_FLAG_X, color: 0x2C4A82 },
      { text: "P", x: COL_P_X, color: 0x2C4A82 },
      { text: "W", x: COL_W_X, color: 0x2C4A82 },
      { text: "D", x: COL_D_X, color: 0x2C4A82 },
      { text: "L", x: COL_L_X, color: 0x2C4A82 },
      { text: "GF", x: COL_GF_X, color: 0x2C4A82 },
      { text: "GA", x: COL_GA_X, color: 0x2C4A82 },
      { text: "GD", x: COL_GD_X, color: 0x2C4A82 },
      { text: "PTS", x: COL_PTS_X, color: 0xF5B73D },
    ];

    for (const col of headerCols) {
      const t = makeText(col.text, "body", 14, col.color);
      t.x = col.x;
      t.y = 0;
      this._leftContent.addChild(t);
    }

    // Divider after header
    const div0 = new Graphics();
    div0.rect(0, HEADER_ROW_H, LEFT_W, 1).fill(0x2C4A82);
    this._leftContent.addChild(div0);

    const standings = computeStandings(group);

    // Rows container — labeled for test discovery
    const rowsContainer = new Container();
    rowsContainer.label = "standings-rows";
    rowsContainer.y = HEADER_ROW_H + 4;
    this._leftContent.addChild(rowsContainer);

    standings.forEach((row, i) => {
      const isPlayer = row.team.id === playerTeamId;
      const rowY = i * (ROW_H + 1);

      const rowContainer = new Container();
      rowContainer.y = rowY;

      // Player row highlight bg
      if (isPlayer) {
        const rowBg = new Graphics();
        rowBg.rect(0, 0, LEFT_W, ROW_H).fill(0x1B315A);
        rowContainer.addChild(rowBg);
      }

      // Left color bar
      if (i === 0 || i === 1) {
        const bar = new Graphics();
        bar.rect(0, 0, COL_BAR_W, ROW_H).fill(0x18A04A);
        rowContainer.addChild(bar);
      } else if (i === 2) {
        const bar = new Graphics();
        bar.rect(0, 0, COL_BAR_W, ROW_H).fill(0xF5B73D);
        rowContainer.addChild(bar);
      }

      // Rank
      const rank = makeText(String(i + 1), "body", 16, 0xF6ECCF);
      rank.x = COL_RANK_X;
      rank.y = (ROW_H - 16) / 2;
      rowContainer.addChild(rank);

      // Flag
      const flag = FlagRenderer.make(row.team.flagSpec, 32, 20);
      flag.x = COL_FLAG_X;
      flag.y = (ROW_H - 20) / 2;
      rowContainer.addChild(flag);

      // Full team name
      const nameColor = isPlayer ? 0xF5B73D : 0xF6ECCF;
      const nameText = makeText(row.team.name.toUpperCase(), "body", 16, nameColor);
      nameText.x = COL_NAME_X;
      nameText.y = (ROW_H - 16) / 2;
      nameText.style.wordWrap = true;
      nameText.style.wordWrapWidth = 175;
      rowContainer.addChild(nameText);

      // Played
      const pText = makeText(String(row.played), "body", 16, 0xF6ECCF);
      pText.x = COL_P_X;
      pText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(pText);

      // Won
      const wText = makeText(String(row.won), "body", 16, 0xF6ECCF);
      wText.x = COL_W_X;
      wText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(wText);

      // Drawn
      const dText = makeText(String(row.drawn), "body", 16, 0xF6ECCF);
      dText.x = COL_D_X;
      dText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(dText);

      // Lost
      const lText = makeText(String(row.lost), "body", 16, 0xF6ECCF);
      lText.x = COL_L_X;
      lText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(lText);

      // Goals for
      const gfText = makeText(String(row.goalsFor), "body", 16, 0xF6ECCF);
      gfText.x = COL_GF_X;
      gfText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(gfText);

      // Goals against
      const gaText = makeText(String(row.goalsAgainst), "body", 16, 0xF6ECCF);
      gaText.x = COL_GA_X;
      gaText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(gaText);

      // Goal difference
      const gd = row.goalsFor - row.goalsAgainst;
      const gdColor = gd > 0 ? 0x18A04A : gd < 0 ? 0xE23B3B : 0xF6ECCF;
      const gdStr = gd > 0 ? `+${gd}` : String(gd);
      const gdText = makeText(gdStr, "body", 16, gdColor);
      gdText.x = COL_GD_X;
      gdText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(gdText);

      // Points
      const ptsText = makeText(String(row.points), "body", 16, 0xF5B73D);
      ptsText.x = COL_PTS_X;
      ptsText.y = (ROW_H - 16) / 2;
      rowContainer.addChild(ptsText);

      rowsContainer.addChild(rowContainer);

      // Divider after row
      const divider = new Graphics();
      divider.rect(0, rowY + ROW_H, LEFT_W, 1).fill(0x2C4A82);
      rowsContainer.addChild(divider);
    });
  }

  // ─── Results panel ────────────────────────────────────────────────────────

  private _buildResultsPanel(group: TournamentGroup, playerTeamId: string): void {
    // Header
    const header = makeText(`GROUP ${group.id} · RESULTS`, "body", 18, 0xF5B73D);
    header.x = 8;
    header.y = 4;
    this._rightContent.addChild(header);

    // Header divider
    const headerDiv = new Graphics();
    headerDiv.rect(0, HEADER_ROW_H, RIGHT_W, 1).fill(0x2C4A82);
    this._rightContent.addChild(headerDiv);

    // Sort matches by matchday
    const sorted = [...group.matches].sort((a, b) => {
      return getMatchday(group, a) - getMatchday(group, b);
    });

    sorted.forEach((match, i) => {
      const rowY = HEADER_ROW_H + 4 + i * (RESULT_ROW_H + 1);
      const played = match.homeGoals !== null && match.awayGoals !== null;

      const row = new Container();
      row.y = rowY;

      // Home abbreviation
      const homeAbbr = makeText(match.home.abbreviation, "body", 16, 0xF6ECCF);
      homeAbbr.x = 8;
      homeAbbr.y = (RESULT_ROW_H - 16) / 2;
      row.addChild(homeAbbr);

      // Home flag
      const homeFlag = FlagRenderer.make(match.home.flagSpec, 24, 16);
      homeFlag.x = 40;
      homeFlag.y = (RESULT_ROW_H - 16) / 2;
      row.addChild(homeFlag);

      // Score or "vs"
      let scoreText: string;
      let scoreColor: number;

      if (played) {
        scoreText = `${match.homeGoals} - ${match.awayGoals}`;
        const playerIsHome = match.home.id === playerTeamId;
        const playerIsAway = match.away.id === playerTeamId;

        if (playerIsHome || playerIsAway) {
          const playerGoals = playerIsHome ? match.homeGoals! : match.awayGoals!;
          const opponentGoals = playerIsHome ? match.awayGoals! : match.homeGoals!;
          if (playerGoals > opponentGoals) scoreColor = 0x18A04A;
          else if (playerGoals === opponentGoals) scoreColor = 0xF5B73D;
          else scoreColor = 0xE23B3B;
        } else {
          scoreColor = 0xF6ECCF;
        }
      } else {
        scoreText = "vs";
        scoreColor = 0x2C4A82;
      }

      const score = makeText(scoreText, "body", 16, scoreColor);
      score.anchor.set(0.5, 0);
      score.x = RIGHT_W / 2;
      score.y = (RESULT_ROW_H - 16) / 2;
      row.addChild(score);

      // Away flag
      const awayFlag = FlagRenderer.make(match.away.flagSpec, 24, 16);
      awayFlag.x = RIGHT_W - 40 - 24;
      awayFlag.y = (RESULT_ROW_H - 16) / 2;
      row.addChild(awayFlag);

      // Away abbreviation
      const awayAbbr = makeText(match.away.abbreviation, "body", 16, 0xF6ECCF);
      awayAbbr.anchor.set(1, 0);
      awayAbbr.x = RIGHT_W - 8;
      awayAbbr.y = (RESULT_ROW_H - 16) / 2;
      row.addChild(awayAbbr);

      this._rightContent.addChild(row);
    });
  }

  // ─── Action buttons ───────────────────────────────────────────────────────

  private _buildButtons(group: TournamentGroup, _playerTeamId: string): void {
    const nextMatch = group.matches
      .filter((m) => m.isPlayerMatch && m.homeGoals === null)
      .sort((a, b) => getMatchday(group, a) - getMatchday(group, b))[0];
    const allPlayerDone = group.matches
      .filter((m) => m.isPlayerMatch)
      .every((m) => m.homeGoals !== null);

    const btnY = H - 60;

    if (nextMatch) {
      const btn = this._makeButton("PLAY NEXT MATCH", 0x18A04A, btnY, 240, 48, () => {
        this._onPlayMatch?.(nextMatch);
      });
      btn.x = RIGHT_X + (RIGHT_W - 240) / 2;
      btn.y = H - 60;
      this.addChild(btn);
    }

    if (allPlayerDone) {
      const standings = computeStandings(group);
      const rank = standings.findIndex((r) => r.team.id === this._tournament!.playerTeam.id);

      let qualified: boolean;
      if (rank <= 1) {
        qualified = true;
      } else if (rank === 3) {
        qualified = false;
      } else {
        const bestThirds = rankThirdPlaceTeams(this._tournament!.groups);
        qualified = bestThirds.some((s) => s.team.id === this._tournament!.playerTeam.id);
      }

      if (qualified) {
        const btn = this._makeButton("CONTINUE TO KNOCKOUT", 0x2F6FE0, btnY, 280, 48, () => {
          this._onGroupComplete?.();
        });
        btn.x = RIGHT_X + (RIGHT_W - 280) / 2;
        btn.y = H - 60;
        this.addChild(btn);
      } else {
        const ordinals = ["1st", "2nd", "3rd", "4th"];
        const ordinal = ordinals[rank] ?? `${rank + 1}th`;
        const lbl = makeText(
          `ELIMINATED — Finished ${ordinal} in Group ${group.id}`,
          "body",
          20,
          0xE23B3B,
        );
        lbl.anchor.set(0.5, 0);
        lbl.x = RIGHT_X + RIGHT_W / 2;
        lbl.y = H - 100;
        this.addChild(lbl);

        const btn = this._makeButton("VIEW BRACKET", 0xB62B2B, btnY, 200, 48, () => {
          this._onGroupEliminated?.(group.id);
        });
        btn.x = RIGHT_X + (RIGHT_W - 200) / 2;
        btn.y = H - 60;
        this.addChild(btn);
      }
    }
  }

  private _makeButton(
    label: string,
    color: number,
    _y: number,
    w: number,
    h: number,
    onClick: () => void,
  ): Container {
    const btn = new Container();
    btn.eventMode = "static";
    btn.cursor = "pointer";
    btn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      onClick();
    });

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(color);
    btn.addChild(bg);

    const lbl = makeText(label, "body", 20, 0xF6ECCF);
    lbl.anchor.set(0.5, 0.5);
    lbl.x = w / 2;
    lbl.y = h / 2;
    btn.addChild(lbl);

    return btn;
  }
}
