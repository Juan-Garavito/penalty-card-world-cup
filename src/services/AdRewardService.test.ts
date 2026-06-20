import { describe, it, expect, vi } from "vitest";
import { AdRewardService } from "./AdRewardService.ts";
import type { IAdService } from "./IAdService.ts";
import type { Tournament } from "../entities/Tournament/Tournament.ts";

function makeTournament(usesLeft: number): Tournament {
  return {
    adRewardUsesLeft: usesLeft,
  } as unknown as Tournament;
}

function makeAdapter(resolves: boolean): IAdService {
  return { showAd: vi.fn().mockResolvedValue(resolves) };
}

describe("AdRewardService — SCEN-AD-CANUSE-TRUE", () => {
  it("canUse() returns true when adRewardUsesLeft > 0", () => {
    const tournament = makeTournament(1);
    const service = new AdRewardService(makeAdapter(true), tournament);
    expect(service.canUse()).toBe(true);
  });
});

describe("AdRewardService — SCEN-AD-CANUSE-FALSE", () => {
  it("canUse() returns false when adRewardUsesLeft === 0", () => {
    const tournament = makeTournament(0);
    const service = new AdRewardService(makeAdapter(true), tournament);
    expect(service.canUse()).toBe(false);
  });
});

describe("AdRewardService — SCEN-AD-EXHAUSTED", () => {
  it("requestReward() returns 'exhausted' when canUse()=false and adapter NOT called", async () => {
    const adapter = makeAdapter(true);
    const tournament = makeTournament(0);
    const service = new AdRewardService(adapter, tournament);
    const result = await service.requestReward();
    expect(result).toBe("exhausted");
    expect(adapter.showAd).not.toHaveBeenCalled();
  });
});

describe("AdRewardService — SCEN-AD-GRANTED", () => {
  it("requestReward() returns 'granted' and decrements usesLeft when adapter returns true", async () => {
    const adapter = makeAdapter(true);
    const tournament = makeTournament(2);
    const service = new AdRewardService(adapter, tournament);
    const result = await service.requestReward();
    expect(result).toBe("granted");
    expect(tournament.adRewardUsesLeft).toBe(1);
  });
});

describe("AdRewardService — SCEN-AD-DENIED", () => {
  it("requestReward() returns 'denied' and does NOT decrement when adapter returns false", async () => {
    const adapter = makeAdapter(false);
    const tournament = makeTournament(2);
    const service = new AdRewardService(adapter, tournament);
    const result = await service.requestReward();
    expect(result).toBe("denied");
    expect(tournament.adRewardUsesLeft).toBe(2);
  });
});
