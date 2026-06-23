import { sound } from "@pixi/sound";

const SOUNDS_BASE = "assets/sounds";

/** Aliases used to play registered sounds via `bgm`/`sfx` (see ./audio.ts). */
export const SOUND_ALIASES = {
  musicBg: "music-bg",
  kickBall: "kick-ball",
  shoutFan: "shout-fan",
  buttonClick: "button-click",
  whistle: "whistle",
  coinFlip: "coin-flip",
  drumRoll: "drum-roll",
  punch: "punch",
  winner: "winner",
  save: "save",
} as const;

/** Register all game sounds with @pixi/sound. Call once at startup. */
export function registerSounds(): void {
  sound.add(SOUND_ALIASES.musicBg, `${SOUNDS_BASE}/music.background.m4a`);
  sound.add(SOUND_ALIASES.kickBall, `${SOUNDS_BASE}/kick-ball.sound.mp3`);
  sound.add(SOUND_ALIASES.shoutFan, `${SOUNDS_BASE}/shout-fan.sound.m4a`);
  sound.add(SOUND_ALIASES.buttonClick, `${SOUNDS_BASE}/button.sound.wav`);
  sound.add(SOUND_ALIASES.whistle, `${SOUNDS_BASE}/whistle.sound.m4a`);
  sound.add(SOUND_ALIASES.coinFlip, `${SOUNDS_BASE}/coin.sound.m4a`);
  sound.add(SOUND_ALIASES.drumRoll, `${SOUNDS_BASE}/drum.sound.m4a`);
  sound.add(SOUND_ALIASES.punch, `${SOUNDS_BASE}/punch.sound.mp3`);
  sound.add(SOUND_ALIASES.winner, `${SOUNDS_BASE}/winner.sound.m4a`);
  sound.add(SOUND_ALIASES.save, `${SOUNDS_BASE}/ou.sound.m4a`);
}
