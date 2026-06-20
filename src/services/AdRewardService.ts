import type { IAdService } from "./IAdService.ts";
import type { Tournament } from "../entities/Tournament/Tournament.ts";

export type AdRewardResult = "granted" | "denied" | "exhausted";

export class AdRewardService {
  constructor(
    private readonly adapter: IAdService,
    private readonly tournament: Tournament,
  ) {}

  canUse(): boolean {
    return this.tournament.adRewardUsesLeft > 0;
  }

  usesLeft(): number {
    return this.tournament.adRewardUsesLeft;
  }

  async requestReward(): Promise<AdRewardResult> {
    if (!this.canUse()) return "exhausted";
    const granted = await this.adapter.showAd();
    if (granted) this.tournament.adRewardUsesLeft--;
    return granted ? "granted" : "denied";
  }
}
