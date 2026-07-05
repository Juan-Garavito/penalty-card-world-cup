/**
 * Minimal surface of Google's Ad Placement API (H5 Games Ads), bootstrapped by the
 * inline snippet + script tag in index.html. Unlike CrazyGames/Poki, `adBreak`/`adConfig`
 * are queue-based: both exist synchronously as soon as the inline snippet runs, regardless
 * of whether the remote SDK script (or an approved AdSense account) has actually loaded.
 */

export type GoogleAdBreakType =
  | "start"
  | "next"
  | "pause"
  | "browse"
  | "reward"
  | "preroll";

export interface GoogleAdBreakOptions {
  type: GoogleAdBreakType;
  name?: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  /** Always called, regardless of whether an ad was actually shown. */
  adBreakDone?: (placementInfo: unknown) => void;
}

export interface GoogleAdConfigOptions {
  preloadAdBreaks?: "on" | "auto";
  sound?: "on" | "off";
}

declare global {
  interface Window {
    adBreak?: (options: GoogleAdBreakOptions) => void;
    adConfig?: (options: GoogleAdConfigOptions) => void;
  }
}

export {};
