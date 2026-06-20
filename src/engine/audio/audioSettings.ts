import { bgm, sfx } from "./audio";

const STORAGE_KEY = "penaltyWC.audioSettings";

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  musicMuted: false,
  sfxMuted: false,
};

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/** Load persisted audio settings, falling back to defaults when missing or invalid. */
export function loadAudioSettings(): AudioSettings {
  if (!hasLocalStorage()) return { ...DEFAULT_AUDIO_SETTINGS };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** Persist audio settings to localStorage. */
export function saveAudioSettings(settings: AudioSettings): void {
  if (!hasLocalStorage()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota/private-mode errors — settings simply won't persist.
  }
}

/** Apply audio settings to the shared `bgm`/`sfx` controllers. */
export function applyAudioSettings(settings: AudioSettings): void {
  bgm.setVolume(settings.musicMuted ? 0 : settings.musicVolume);
  sfx.setVolume(settings.sfxMuted ? 0 : settings.sfxVolume);
}
