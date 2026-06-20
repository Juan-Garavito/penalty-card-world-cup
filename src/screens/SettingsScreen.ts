import { Container, Graphics, Text } from "pixi.js";
import { engine } from "../engine/instance.ts";
import { sfx } from "../engine/audio/audio.ts";
import { SOUND_ALIASES } from "../engine/audio/sounds.ts";
import {
  loadAudioSettings,
  saveAudioSettings,
  applyAudioSettings,
} from "../engine/audio/audioSettings.ts";
import type { AudioSettings } from "../engine/audio/audioSettings.ts";

// ─── Layout (virtual canvas, matches HomeScreen's 1280×720) ──────────────────

const W = 1280;
const H = 720;

const PANEL = { x: W / 2 - 260, y: H / 2 - 180, w: 520, h: 360 };

const BAR_SEGMENTS = 10;
const BAR_SEGMENT_W = 28;
const BAR_SEGMENT_GAP = 4;
const BAR_SEGMENT_H = 24;
const BAR_WIDTH = BAR_SEGMENTS * (BAR_SEGMENT_W + BAR_SEGMENT_GAP) - BAR_SEGMENT_GAP;

const MUTE_BTN_W = 120;
const MUTE_BTN_H = 28;

const COLOR = {
  overlay: 0x000000,
  panelBg: 0x1b315a,
  panelBorder: 0x070b14,
  title: 0xf5b73d,
  label: 0xf6eccf,
  barFilled: 0xf5b73d,
  barEmpty: 0x2c4a82,
  barMuted: 0x4a4a4a,
  muteOn: 0x6b1f1f,
  muteOff: 0x1a6b2f,
  closeBg: 0x224488,
};

export class SettingsScreen extends Container {
  private _settings: AudioSettings = loadAudioSettings();

  prepare(): void {
    this.removeChildren();

    this._buildOverlay();
    const panel = this._buildPanel();
    this.addChild(panel);
  }

  async show(): Promise<void> {}

  async hide(): Promise<void> {}

  reset(): void {
    this.removeChildren();
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
      text: "SETTINGS",
      style: { fontFamily: "Minecraft", fontSize: 28, fill: COLOR.title },
    });
    title.anchor.set(0.5, 0);
    title.x = PANEL.w / 2;
    title.y = 24;
    panel.addChild(title);

    panel.addChild(this._buildVolumeRow("MUSIC", 110, "music"));
    panel.addChild(this._buildVolumeRow("SFX", 200, "sfx"));
    panel.addChild(this._buildCloseButton());

    return panel;
  }

  private _buildVolumeRow(
    label: string,
    y: number,
    channel: "music" | "sfx",
  ): Container {
    const row = new Container();
    row.y = y;

    const lbl = new Text({
      text: label,
      style: { fontFamily: "Minecraft", fontSize: 18, fill: COLOR.label },
    });
    lbl.x = 32;
    lbl.y = 0;
    row.addChild(lbl);

    const bar = new Container();
    bar.x = 32;
    bar.y = 32;
    row.addChild(bar);

    const segments: Graphics[] = [];
    for (let i = 0; i < BAR_SEGMENTS; i++) {
      const seg = new Graphics();
      seg.x = i * (BAR_SEGMENT_W + BAR_SEGMENT_GAP);
      seg.eventMode = "static";
      seg.cursor = "pointer";
      seg.on("pointerdown", () => {
        sfx.play(SOUND_ALIASES.buttonClick);
        this._setVolume(channel, (i + 1) / BAR_SEGMENTS);
        this._refreshRow(channel, segments, muteBtn, muteLbl);
      });
      bar.addChild(seg);
      segments.push(seg);
    }

    const muteBtn = new Graphics();
    muteBtn.x = 32 + BAR_WIDTH + 24;
    muteBtn.y = 32 + (BAR_SEGMENT_H - MUTE_BTN_H) / 2;
    muteBtn.eventMode = "static";
    muteBtn.cursor = "pointer";
    row.addChild(muteBtn);

    const muteLbl = new Text({
      text: "",
      style: { fontFamily: "Minecraft", fontSize: 14, fill: COLOR.label },
    });
    muteLbl.anchor.set(0.5);
    muteLbl.x = muteBtn.x + MUTE_BTN_W / 2;
    muteLbl.y = muteBtn.y + MUTE_BTN_H / 2;
    row.addChild(muteLbl);

    muteBtn.on("pointerdown", () => {
      sfx.play(SOUND_ALIASES.buttonClick);
      this._toggleMute(channel);
      this._refreshRow(channel, segments, muteBtn, muteLbl);
    });

    this._refreshRow(channel, segments, muteBtn, muteLbl);
    return row;
  }

  private _refreshRow(
    channel: "music" | "sfx",
    segments: Graphics[],
    muteBtn: Graphics,
    muteLbl: Text,
  ): void {
    const volume =
      channel === "music" ? this._settings.musicVolume : this._settings.sfxVolume;
    const muted =
      channel === "music" ? this._settings.musicMuted : this._settings.sfxMuted;
    const filledCount = Math.round(volume * BAR_SEGMENTS);

    segments.forEach((seg, i) => {
      const color = muted
        ? COLOR.barMuted
        : i < filledCount
          ? COLOR.barFilled
          : COLOR.barEmpty;
      seg.clear();
      seg.rect(0, 0, BAR_SEGMENT_W, BAR_SEGMENT_H).fill(color);
    });

    muteBtn.clear();
    muteBtn.rect(0, 0, MUTE_BTN_W, MUTE_BTN_H).fill(muted ? COLOR.muteOn : COLOR.muteOff);
    muteLbl.text = muted ? "UNMUTE" : "MUTE";
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

  // ─── Settings mutation ────────────────────────────────────────────────────

  private _setVolume(channel: "music" | "sfx", volume: number): void {
    if (channel === "music") {
      this._settings.musicVolume = volume;
    } else {
      this._settings.sfxVolume = volume;
    }
    this._persist();
  }

  private _toggleMute(channel: "music" | "sfx"): void {
    if (channel === "music") {
      this._settings.musicMuted = !this._settings.musicMuted;
    } else {
      this._settings.sfxMuted = !this._settings.sfxMuted;
    }
    this._persist();
  }

  private _persist(): void {
    applyAudioSettings(this._settings);
    saveAudioSettings(this._settings);
  }
}
