/** Minimal surface of the global CrazyGames SDK v3 object injected by the script tag in index.html. */

export type CrazyGamesAdType = "midgame" | "rewarded";

export interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export type CrazyGamesEnvironment = "local" | "crazygames" | "disabled";

export interface CrazyGamesSDKApi {
  init(): Promise<void>;
  environment: CrazyGamesEnvironment;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: {
    requestAd(adType: CrazyGamesAdType, callbacks: CrazyGamesAdCallbacks): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSDKApi };
  }
}

export {};
