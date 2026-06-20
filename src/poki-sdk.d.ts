/** Minimal surface of the global PokiSDK object injected by the script tag in index.html. */
export interface PokiSDKApi {
  init(): Promise<void>;
  setDebug(enabled: boolean): void;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(callback?: () => void): Promise<void>;
  rewardedBreak(callback?: () => void): Promise<boolean>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
  }
}

export {};
