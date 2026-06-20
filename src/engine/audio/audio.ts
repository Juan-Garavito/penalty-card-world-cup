import type { PlayOptions, Sound } from "@pixi/sound";
import { sound } from "@pixi/sound";
import { animate } from "motion";

/**
 * Handles music background, playing only one audio file in loop at time,
 * and fade/stop the music if a new one is requested. Also provide volume
 * control for music background only, leaving other sounds volumes unchanged.
 */
export class BGM {
  /** Volume multiplier applied while ducked (e.g. during active gameplay). */
  private static readonly DUCK_FACTOR = 0.2;

  /** Alias of the current music being played */
  public currentAlias?: string;
  /** Current music instance being played */
  public current?: Sound;
  /** Current volume set */
  private volume = 1;
  /** Whether the music is currently ducked to a quiet background level */
  private ducked = false;

  /** Play a background music, fading out and stopping the previous, if there is one */
  public async play(alias: string, options?: PlayOptions) {
    // Do nothing if the requested music is already being played
    if (this.currentAlias === alias) return;
    // Do nothing if the alias was never registered (e.g. registerSounds() not called yet, or in tests)
    if (!sound.exists(alias)) return;

    // Fade out then stop current music
    if (this.current) {
      const current = this.current;
      animate(current, { volume: 0 }, { duration: 1, ease: "linear" }).then(
        () => {
          current.stop();
        },
      );
    }

    // Find out the new instance to be played
    this.current = sound.find(alias);

    // Play and fade in the new music
    this.currentAlias = alias;
    this.current.play({ loop: true, ...options });
    this.current.volume = 0;
    animate(
      this.current,
      { volume: this.volume },
      { duration: 1, ease: "linear" },
    );
  }

  /** Get background music volume */
  public getVolume() {
    return this.volume;
  }

  /** Set background music volume */
  public setVolume(v: number) {
    this.volume = v;
    if (this.current) {
      this.current.volume = this.ducked
        ? this.volume * BGM.DUCK_FACTOR
        : this.volume;
    }
  }

  /** Pause the currently playing music, if any. */
  public pause() {
    this.current?.pause();
  }

  /** Resume the currently playing music, if it was paused. */
  public resume() {
    this.current?.resume();
  }

  /** Lower the music to a quiet background level (e.g. while a match is being played). */
  public duck() {
    this.ducked = true;
    if (this.current) {
      animate(
        this.current,
        { volume: this.volume * BGM.DUCK_FACTOR },
        { duration: 0.5, ease: "linear" },
      );
    }
  }

  /** Restore the music to its normal volume after duck(). */
  public unduck() {
    this.ducked = false;
    if (this.current) {
      animate(
        this.current,
        { volume: this.volume },
        { duration: 0.5, ease: "linear" },
      );
    }
  }
}

/**
 * Handles short sound special effects, mainly for having its own volume settings.
 * The volume control is only a workaround to make it work only with this type of sound,
 * with a limitation of not controlling volume of currently playing instances - only the new ones will
 * have their volume changed. But because most of sound effects are short sounds, this is generally fine.
 */
export class SFX {
  /** Volume scale for new instances */
  private volume = 1;

  /** Play an one-shot sound effect */
  public play(alias: string, options?: PlayOptions) {
    if (!sound.exists(alias)) return;
    const volume = this.volume * (options?.volume ?? 1);
    sound.play(alias, { ...options, volume });
  }

  /** Set sound effects volume */
  public getVolume() {
    return this.volume;
  }

  /** Set sound effects volume. Does not affect instances that are currently playing */
  public setVolume(v: number) {
    this.volume = v;
  }

  /** Stop all currently playing instances of a sound effect. */
  public stop(alias: string) {
    if (!sound.exists(alias)) return;
    sound.stop(alias);
  }
}

/**
 * Shared singletons used across the app. Screens import these directly to play
 * music/SFX without needing a reference to the Application instance — the
 * CreationAudioPlugin exposes the same instances via `app.audio.bgm`/`sfx`.
 */
export const bgm = new BGM();
export const sfx = new SFX();
