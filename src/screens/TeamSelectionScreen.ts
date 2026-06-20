import { Container, Filter, Graphics, Text, Ticker } from "pixi.js";
import type {
  WorldCupTeam,
  Confederation,
} from "../entities/Tournament/WorldCupTeam.ts";
import {
  WORLD_CUP_2026_TEAMS as TEAMS,
  getGroupForTeam,
} from "../entities/Tournament/TeamData.ts";
import { FlagRenderer } from "./utils/FlagRenderer.ts";
import { makeText, confColor, drawPixelBorder } from "./utils/UIComponents.ts";
import { createCRTFilter } from "./filters/CRTFilter.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";

// ─── Layout ──────────────────────────────────────────────────────────────────

const W = 1280;
const H = 720;

const LEFT_W = 380;
const RIGHT_W = 900;
const RIGHT_X = LEFT_W;

const TAB_H = 36;
const GRID_COLS = 6;
const SCROLL_BAR_W = 8;
const GRID_TOP = TAB_H + 4;
const GRID_VIEWPORT_H = H - GRID_TOP;
const GRID_AVAILABLE_W = RIGHT_W - SCROLL_BAR_W - 4;
const CELL_W = Math.floor(GRID_AVAILABLE_W / GRID_COLS);
const CELL_H = 72;

const CONF_TABS: Array<{ label: string; value: Confederation | "ALL" }> = [
  { label: "ALL", value: "ALL" },
  { label: "UEFA", value: "UEFA" },
  { label: "CONMEBOL", value: "CONMEBOL" },
  { label: "CAF", value: "CAF" },
  { label: "AFC", value: "AFC" },
  { label: "CONCACAF", value: "CONCACAF" },
  { label: "OFC", value: "OFC" },
];

// ─── Pending slots ────────────────────────────────────────────────────────────

let _pendingOnSelect: ((teamId: string) => void) | null = null;

export function setPendingOnSelect(cb: (teamId: string) => void): void {
  _pendingOnSelect = cb;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export class TeamSelectionScreen extends Container {
  private _onSelect: ((teamId: string) => void) | null = null;
  private _crtFilter: Filter | null = null;
  private _crtTicker: ((t: Ticker) => void) | null = null;
  private _selectedTeam: WorldCupTeam | null = null;
  private _activeConf: Confederation | "ALL" = "ALL";

  private _gridContainer!: Container;
  private _tabsContainer!: Container;
  private _scrollViewport!: Container;
  private _scrollY = 0;
  private _scrollTrack!: Graphics;
  private _scrollThumb!: Graphics;

  private _leftPanel!: Container;
  private _previewFlag!: Graphics;
  private _previewName!: Text;
  private _previewConfDot!: Graphics;
  private _previewConfLabel!: Text;
  private _previewPwrFill!: Graphics;
  private _previewPwrValue!: Text;
  private _previewCode!: Text;
  private _previewGroup!: Text;
  private _ctaBtn!: Container;
  private _ctaLabel!: Text;

  constructor() {
    super();
  }

  prepare(): void {
    this._onSelect = _pendingOnSelect;
    _pendingOnSelect = null;
    this._buildUI();
  }

  async show(): Promise<void> {}

  async hide(): Promise<void> {}

  reset(): void {
    if (this._crtTicker) {
      Ticker.shared.remove(this._crtTicker);
      this._crtTicker = null;
    }
    this.removeChildren();
    this.filters = [];
    this._onSelect = null;
    this._selectedTeam = null;
    this._activeConf = "ALL";
    this._scrollY = 0;
    this._crtFilter = null;
  }

  resize(w: number, h: number): void {
    this.scale.set(w / W, h / H);
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  private _buildUI(): void {
    // Full-screen dotted background
    const bgBase = new Graphics();
    bgBase.rect(0, 0, W, H).fill(0x0a1120);
    this.addChild(bgBase);
    const bgDots = new Graphics();
    this._drawDottedBg(bgDots, W, H);
    this.addChild(bgDots);

    // Left panel
    this._leftPanel = this._buildLeftPanel();
    this.addChild(this._leftPanel);

    // Right panel base
    const rightBg = new Graphics();
    rightBg.rect(RIGHT_X, 0, RIGHT_W, H).fill(0x0a1120);
    rightBg.eventMode = "static";
    rightBg.on("wheel", (e: WheelEvent) => this._onWheel(e));
    this.addChild(rightBg);

    // "SELECT YOUR NATION" title
    const title = makeText("SELECT YOUR NATION", "title", 9, 0xf6eccf);
    title.x = RIGHT_X + 16;
    title.y = 10;
    this.addChild(title);

    // Confederation tabs
    this._tabsContainer = new Container();
    this._tabsContainer.x = RIGHT_X;
    this._tabsContainer.y = GRID_TOP - TAB_H;
    this.addChild(this._tabsContainer);
    this._buildTabs();

    // Scroll viewport with mask
    this._scrollViewport = new Container();
    this._scrollViewport.x = RIGHT_X;
    this._scrollViewport.y = GRID_TOP;
    const mask = new Graphics();
    mask
      .rect(RIGHT_X, GRID_TOP, RIGHT_W - SCROLL_BAR_W - 4, GRID_VIEWPORT_H)
      .fill(0xffffff);
    this._scrollViewport.mask = mask;
    this.addChild(mask);
    this.addChild(this._scrollViewport);

    // Scrollbar graphics initialized before _buildGrid calls _updateScrollbar
    this._scrollTrack = new Graphics();
    this._scrollThumb = new Graphics();
    this.addChild(this._scrollTrack);
    this.addChild(this._scrollThumb);

    // Flag grid
    this._gridContainer = new Container();
    this._gridContainer.label = "flag-grid";
    this._scrollViewport.addChild(this._gridContainer);
    this._buildGrid();
    this._buildScrollbar();

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
      // no WebGL context — skip filter
    }
  }

  private _buildLeftPanel(): Container {
    const panel = new Container();
    const firstTeam = TEAMS[0];

    const bg = new Graphics();
    bg.rect(0, 0, LEFT_W, H).fill(0x142544);
    panel.addChild(bg);

    // Pixel-border frame behind flag
    const flagFrameG = new Graphics();
    drawPixelBorder(flagFrameG, LEFT_W / 2 - 96, 148, 192, 128, 0x2c4a82);
    panel.addChild(flagFrameG);

    // Large flag preview
    this._previewFlag = FlagRenderer.make(firstTeam.flagSpec, 192, 128);
    this._previewFlag.x = LEFT_W / 2 - 96;
    this._previewFlag.y = 148;
    panel.addChild(this._previewFlag);

    // Team name
    this._previewName = makeText(
      firstTeam.name.toUpperCase(),
      "title",
      10,
      0xf6eccf,
    );
    this._previewName.anchor.set(0.5, 0);
    this._previewName.x = LEFT_W / 2;
    this._previewName.y = 298;
    panel.addChild(this._previewName);

    // Confederation dot
    this._previewConfDot = new Graphics();
    const ccolor = confColor(firstTeam.confederation);
    this._previewConfDot.rect(LEFT_W / 2 - 80, 328, 14, 14).fill(ccolor);
    panel.addChild(this._previewConfDot);

    // Confederation label
    this._previewConfLabel = makeText(
      firstTeam.confederation,
      "body",
      20,
      0xf6eccf,
    );
    this._previewConfLabel.anchor.set(0, 0.5);
    this._previewConfLabel.x = LEFT_W / 2 - 62;
    this._previewConfLabel.y = 335;
    panel.addChild(this._previewConfLabel);

    // Rating label
    const ratingLbl = makeText("RATING", "body", 16, 0xcdbf9a);
    ratingLbl.x = LEFT_W / 2 - 120;
    ratingLbl.y = 364;
    panel.addChild(ratingLbl);

    // Rating value
    this._previewPwrValue = makeText(
      String(firstTeam.power),
      "body",
      16,
      0xf6eccf,
    );
    this._previewPwrValue.anchor.set(1, 0);
    this._previewPwrValue.x = LEFT_W / 2 + 120;
    this._previewPwrValue.y = 364;
    panel.addChild(this._previewPwrValue);

    // Power bar bg
    const pwrBg = new Graphics();
    pwrBg.rect(LEFT_W / 2 - 120, 384, 240, 8).fill(0x1b315a);
    panel.addChild(pwrBg);

    // Power fill
    this._previewPwrFill = new Graphics();
    const fillW = Math.round((firstTeam.power / 100) * 240);
    this._previewPwrFill.rect(LEFT_W / 2 - 120, 384, fillW, 8).fill(0xf5b73d);
    panel.addChild(this._previewPwrFill);

    // Code row
    const codeLbl = makeText("CODE", "body", 14, 0xcdbf9a);
    codeLbl.x = 32;
    codeLbl.y = 414;
    panel.addChild(codeLbl);

    this._previewCode = makeText(firstTeam.abbreviation, "body", 16, 0xf6eccf);
    this._previewCode.x = 32;
    this._previewCode.y = 432;
    panel.addChild(this._previewCode);

    // Group row
    const groupLbl = makeText("GROUP", "body", 14, 0xcdbf9a);
    groupLbl.x = 200;
    groupLbl.y = 414;
    panel.addChild(groupLbl);

    this._previewGroup = makeText(
      getGroupForTeam(firstTeam.id),
      "body",
      16,
      0xf6eccf,
    );
    this._previewGroup.x = 200;
    this._previewGroup.y = 432;
    panel.addChild(this._previewGroup);

    // CTA button
    this._ctaBtn = new Container();
    const btnW = LEFT_W - 48;
    this._ctaBtn.x = 24;
    this._ctaBtn.y = H - 72;
    this._ctaBtn.eventMode = "static";
    this._ctaBtn.cursor = "pointer";
    this._ctaBtn.on("pointerdown", () => {
      if (this._selectedTeam && this._onSelect) {
        sfx.play(SOUND_ALIASES.buttonClick);
        this._onSelect(this._selectedTeam.id);
      }
    });

    const ctaBg = new Graphics();
    ctaBg.rect(0, 0, btnW, 44).fill(0xf5b73d);
    this._ctaBtn.addChild(ctaBg);

    this._ctaLabel = makeText(
      `PLAY AS ${firstTeam.abbreviation} ►`,
      "title",
      9,
      0x070b14,
    );
    this._ctaLabel.anchor.set(0.5, 0.5);
    this._ctaLabel.x = btnW / 2;
    this._ctaLabel.y = 22;
    this._ctaBtn.addChild(this._ctaLabel);

    panel.addChild(this._ctaBtn);

    return panel;
  }

  private _buildTabs(): void {
    this._tabsContainer.removeChildren();
    const tabW = Math.floor(RIGHT_W / CONF_TABS.length);

    CONF_TABS.forEach((tab, i) => {
      const isActive = tab.value === this._activeConf;
      const fillColor = isActive ? 0xf5b73d : 0x1b315a;
      const textColor = isActive ? 0x070b14 : 0xf6eccf;

      const bg = new Graphics();
      bg.rect(i * tabW, 0, tabW - 1, TAB_H).fill(fillColor);
      this._tabsContainer.addChild(bg);

      const lbl = makeText(tab.label, "body", 18, textColor);
      lbl.anchor.set(0.5, 0.5);
      lbl.x = i * tabW + tabW / 2;
      lbl.y = TAB_H / 2;
      lbl.eventMode = "static";
      lbl.cursor = "pointer";
      lbl.on("pointerdown", () => {
        sfx.play(SOUND_ALIASES.buttonClick);
        this._activeConf = tab.value;
        this._scrollY = 0;
        this._buildTabs();
        this._buildGrid();
      });
      this._tabsContainer.addChild(lbl);
    });
  }

  private _buildGrid(): void {
    this._gridContainer.removeChildren();
    this._gridContainer.y = this._scrollY;
    const teams = this._filteredTeams();

    teams.forEach((team, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);

      const cell = new Container();
      cell.x = col * CELL_W;
      cell.y = row * CELL_H;
      cell.eventMode = "static";
      cell.cursor = "pointer";

      const isSelected = this._selectedTeam?.id === team.id;
      const cellBg = new Graphics();
      cellBg.rect(0, 0, CELL_W, CELL_H).fill(isSelected ? 0x1b315a : 0x0a1120);
      cell.addChild(cellBg);

      const flagW = 56;
      const flagH = 36;
      const flag = FlagRenderer.make(team.flagSpec, flagW, flagH);
      flag.x = Math.floor((CELL_W - flagW) / 2);
      flag.y = 10;
      cell.addChild(flag);

      const abbr = makeText(team.abbreviation, "body", 14, 0xf6eccf);
      abbr.anchor.set(0.5, 0);
      abbr.x = CELL_W / 2;
      abbr.y = 50;
      cell.addChild(abbr);

      if (isSelected) {
        const borderG = new Graphics();
        const B = 2;
        borderG.rect(0, 0, CELL_W, B).fill(0xf5b73d);
        borderG.rect(0, CELL_H - B, CELL_W, B).fill(0xf5b73d);
        borderG.rect(0, 0, B, CELL_H).fill(0xf5b73d);
        borderG.rect(CELL_W - B, 0, B, CELL_H).fill(0xf5b73d);
        cell.addChild(borderG);
      }

      cell.on("pointerdown", () => this._selectTeam(team));
      this._gridContainer.addChild(cell);
    });

    this._updateScrollbar();
  }

  private _buildScrollbar(): void {
    const trackX = RIGHT_X + RIGHT_W - SCROLL_BAR_W - 2;
    this._scrollTrack.clear();
    this._scrollTrack
      .rect(trackX, GRID_TOP, SCROLL_BAR_W, GRID_VIEWPORT_H)
      .fill(0x1b315a);
    this._updateScrollbar();
  }

  private _updateScrollbar(): void {
    const teams = this._filteredTeams();
    const totalRows = Math.ceil(teams.length / GRID_COLS);
    const contentH = totalRows * CELL_H;

    this._scrollThumb.clear();
    if (contentH <= GRID_VIEWPORT_H) return;

    const ratio = GRID_VIEWPORT_H / contentH;
    const thumbH = Math.max(20, Math.floor(ratio * GRID_VIEWPORT_H));
    const maxScroll = contentH - GRID_VIEWPORT_H;
    const thumbY =
      GRID_TOP +
      Math.floor((-this._scrollY / maxScroll) * (GRID_VIEWPORT_H - thumbH));
    this._scrollThumb.rect(trackX, thumbY, SCROLL_BAR_W, thumbH).fill(0xf5b73d);
  }

  private _onWheel(e: WheelEvent): void {
    const teams = this._filteredTeams();
    const totalRows = Math.ceil(teams.length / GRID_COLS);
    const contentH = totalRows * CELL_H;
    const maxScroll = Math.max(0, contentH - GRID_VIEWPORT_H);

    this._scrollY = Math.max(
      -maxScroll,
      Math.min(0, this._scrollY - e.deltaY * 0.5),
    );
    this._gridContainer.y = this._scrollY;
    this._updateScrollbar();
  }

  private _selectTeam(team: WorldCupTeam): void {
    this._selectedTeam = team;

    // Update flag
    this._leftPanel.removeChild(this._previewFlag);
    this._previewFlag = FlagRenderer.make(team.flagSpec, 192, 128);
    this._previewFlag.x = LEFT_W / 2 - 96;
    this._previewFlag.y = 148;
    this._leftPanel.addChildAt(this._previewFlag, 2);

    // Update name
    this._previewName.text = team.name.toUpperCase();

    // Update confederation
    this._previewConfDot.clear();
    this._previewConfDot
      .rect(LEFT_W / 2 - 80, 328, 14, 14)
      .fill(confColor(team.confederation));
    this._previewConfLabel.text = team.confederation;

    // Update power
    this._previewPwrFill.clear();
    const fillW = Math.round((team.power / 100) * 240);
    this._previewPwrFill.rect(LEFT_W / 2 - 120, 384, fillW, 8).fill(0xf5b73d);
    this._previewPwrValue.text = String(team.power);

    // Update code + group
    this._previewCode.text = team.abbreviation;
    this._previewGroup.text = getGroupForTeam(team.id);

    // Update CTA
    this._ctaLabel.text = `PLAY AS ${team.abbreviation} ►`;

    this._buildGrid();
  }

  private _filteredTeams(): WorldCupTeam[] {
    if (this._activeConf === "ALL") return [...TEAMS];
    return TEAMS.filter((t) => t.confederation === this._activeConf);
  }

  private _drawDottedBg(g: Graphics, w: number, h: number): void {
    const SPACING = 20;
    const DOT = 2;
    for (let x = 0; x < w; x += SPACING) {
      for (let y = 0; y < h; y += SPACING) {
        g.rect(x, y, DOT, DOT).fill(0x0d1830);
      }
    }
  }
}
