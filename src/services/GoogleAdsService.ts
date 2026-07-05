import type { IAdService } from "./IAdService.ts";
import { isGoogleAdsAvailable } from "./GoogleAdsLifecycle.ts";
import { bgm } from "../engine/audio/audio.ts";

const AD_TIMEOUT_MS = 8000;

/** Rewarded-ad adapter backed by Google's Ad Placement API (`adBreak({ type: "reward" })`). */
export class GoogleAdsService implements IAdService {
  async showAd(): Promise<boolean> {
    if (!isGoogleAdsAvailable()) return false;
    bgm.pause();
    return new Promise((resolve) => {
      let done = false;
      const finish = (rewarded: boolean) => {
        if (done) return;
        done = true;
        bgm.resume();
        resolve(rewarded);
      };
      setTimeout(() => finish(false), AD_TIMEOUT_MS);
      window.adBreak!({
        type: "reward",
        name: "rewarded-ad",
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: () => finish(true),
        adDismissed: () => finish(false),
        adBreakDone: () => finish(false),
      });
    });
  }
}
