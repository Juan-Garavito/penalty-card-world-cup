import { describe, it, expect, vi } from "vitest";
import { PenaltyAnimation, ANIM_TIMING } from "./PenaltyAnimation.ts";
import type { ResolutionEvidence } from "../entities/Match/ResolutionOutcome.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BALL_LANDING_MS =
  ANIM_TIMING.BALL_FLIGHT_START + ANIM_TIMING.BALL_FLIGHT_DURATION + 1;

const DUEL_END_MS =
  ANIM_TIMING.BALL_FLIGHT_START +
  ANIM_TIMING.BALL_FLIGHT_DURATION +
  ANIM_TIMING.CARD_DUEL_DURATION +
  1;

const COIN_END_MS = DUEL_END_MS + ANIM_TIMING.COIN_SPIN_DURATION + 1;

function makeNoopChar() {
  return {
    reset() {},
    setFrame() {},
    play() {},
    setRotationRadians() {},
    tick() {},
    setLayerTint() {},
    x: 0,
    y: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: { x: 1, y: 1 } as any,
  } as never;
}

function makeNoopBall() {
  return { x: 0, y: 0, zIndex: 0 } as never;
}

function makeEvidence(overrides?: Partial<ResolutionEvidence>): ResolutionEvidence {
  return {
    kickSide: "left",
    diveSide: "right",
    sidesMatched: false,
    directGoal: true,
    strikerPassiveId: -1,
    goalkeeperPassiveId: -1,
    activesFired: [],
    nullifiedActives: [],
    consumedOnMiss: [],
    finalPGoal: null,
    roll: null,
    strikerCurrentPower: null,
    goalkeeperCurrentPower: null,
    ...overrides,
  };
}

interface CoinSpy {
  visible: boolean;
  lastFrame: 0 | 1;
  setFrame(f: 0 | 1): void;
}

function makeCoinSpy(): CoinSpy {
  return {
    visible: false,
    lastFrame: 0,
    setFrame(f: 0 | 1) {
      this.lastFrame = f;
    },
  };
}

function makeCtx(overrides?: {
  isGoal?: boolean;
  humanIsStriker?: boolean;
  evidence?: ResolutionEvidence;
  coin?: CoinSpy | null;
}) {
  const cardDuelPanel = { visible: false };
  const darkenOverlay = { visible: false, alpha: 1 };
  const coin = overrides?.coin !== undefined ? overrides.coin : makeCoinSpy();
  const onComplete = vi.fn();

  const ctx = {
    striker: makeNoopChar(),
    goalkeeper: makeNoopChar(),
    ball: makeNoopBall(),
    ballPositions: {
      start: { x: 0, y: 0 },
      left: { x: -100, y: -100 },
      center: { x: 0, y: -100 },
      right: { x: 100, y: -100 },
    },
    strikerPos: { x: 0, y: 0 },
    keeperPos: { x: 0, y: 0 },
    cardDuelPanel,
    darkenOverlay,
    evidence: overrides?.evidence ?? makeEvidence(),
    isGoal: overrides?.isGoal ?? true,
    humanIsStriker: overrides?.humanIsStriker ?? true,
    onComplete,
    coin,
    // Card duel refs — null in tests (animation gracefully no-ops)
    humanCard: null,
    humanActiveCard: null,
    aiCard: null,
    aiActiveCard: null,
    humanCardRestX: 204,
    aiCardRestX: 564,
    humanColor: 0xffffff,
    aiColor: 0xffffff,
    onBallKick: null,
    onCoinStart: null,
    onCoinEnd: null,
    onDuelStart: null,
    onClash: null,
  };

  return { ctx, cardDuelPanel, darkenOverlay, coin: coin as CoinSpy | null, onComplete };
}

// ─── Duel panel visibility ────────────────────────────────────────────────────

describe("PenaltyAnimation — duel panel visibility", () => {
  it("SCEN-PA-SIDESMATCH-DUEL: shows duel panel when sidesMatched=true", () => {
    const { ctx, cardDuelPanel, darkenOverlay } = makeCtx({
      evidence: makeEvidence({ sidesMatched: true }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(BALL_LANDING_MS);
    expect(cardDuelPanel.visible).toBe(true);
    expect(darkenOverlay.visible).toBe(false);
  });

  it("SCEN-PA-MISMATCH-NO-INTIMIDATE-DARKEN: darken shown when sidesMatched=false and no intimidateMismatchRoll", () => {
    const { ctx, cardDuelPanel, darkenOverlay } = makeCtx({
      evidence: makeEvidence({ sidesMatched: false }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(BALL_LANDING_MS);
    expect(cardDuelPanel.visible).toBe(false);
    expect(darkenOverlay.visible).toBe(true);
  });

  it("SCEN-PA-INTIMIDATE-MISMATCH-DUEL: shows duel panel when intimidateMismatchRoll present even without sidesMatched", () => {
    const { ctx, cardDuelPanel, darkenOverlay } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(BALL_LANDING_MS);
    expect(cardDuelPanel.visible).toBe(true);
    expect(darkenOverlay.visible).toBe(false);
  });
});

// ─── Coin spin — visibility ───────────────────────────────────────────────────

describe("PenaltyAnimation — coin spin visibility", () => {
  it("SCEN-PA-COIN-HIDDEN-INITIALLY: coin is hidden before duel ends", () => {
    const { ctx, coin } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(BALL_LANDING_MS);
    expect(coin!.visible).toBe(false);
  });

  it("SCEN-PA-COIN-VISIBLE-AFTER-DUEL: coin becomes visible after duel when intimidateMismatchRoll present", () => {
    const { ctx, coin } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(DUEL_END_MS);
    expect(coin!.visible).toBe(true);
  });

  it("SCEN-PA-COIN-VISIBLE-GK-INTIMIDATE-SIDES-MATCHED: coin shows when goalkeeper fired Intimidate even with sidesMatched", () => {
    const { ctx, coin } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: true,
        activesFired: [{ cardId: 5, by: "goalkeeper", effect: "intimidate" }],
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(DUEL_END_MS);
    expect(coin!.visible).toBe(true);
  });

  it("SCEN-PA-COIN-VISIBLE-STRIKER-CHEATING: coin shows when striker fired Cheating", () => {
    const { ctx, coin } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: true,
        activesFired: [{ cardId: 3, by: "striker", effect: "cheat" }],
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(DUEL_END_MS);
    expect(coin!.visible).toBe(true);
  });

  it("SCEN-PA-COIN-HIDDEN-NO-ACTIVE: coin stays hidden when no active fired", () => {
    const { ctx, coin } = makeCtx({
      evidence: makeEvidence({ sidesMatched: true, activesFired: [] }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(COIN_END_MS);
    expect(coin!.visible).toBe(false);
  });

  it("SCEN-PA-COIN-HIDDEN-NULL-COIN: no error when coin is null (asset not loaded)", () => {
    const { ctx } = makeCtx({
      coin: null,
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    expect(() => anim.tick(COIN_END_MS)).not.toThrow();
  });
});

// ─── Coin spin — final frame ──────────────────────────────────────────────────

describe("PenaltyAnimation — coin final frame", () => {
  it("SCEN-PA-COIN-GOAL-FRAME: coin lands on frame 0 when isGoal=true", () => {
    const { ctx, coin } = makeCtx({
      isGoal: true,
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(COIN_END_MS);
    expect(coin!.lastFrame).toBe(0);
  });

  it("SCEN-PA-COIN-MISS-FRAME: coin lands on frame 1 when isGoal=false", () => {
    const { ctx, coin } = makeCtx({
      isGoal: false,
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.2, missed: true },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    anim.tick(COIN_END_MS);
    expect(coin!.lastFrame).toBe(1);
  });
});

// ─── End-beat timing ─────────────────────────────────────────────────────────

describe("PenaltyAnimation — onComplete timing", () => {
  it("SCEN-PA-COMPLETE-DARKEN: onComplete fires after darken + end-beat (no coin)", () => {
    const { ctx, onComplete } = makeCtx({
      evidence: makeEvidence({ sidesMatched: false }), // no intimidate
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    const endMs =
      ANIM_TIMING.BALL_FLIGHT_START +
      ANIM_TIMING.BALL_FLIGHT_DURATION +
      ANIM_TIMING.END_BEAT_DURATION +
      1;
    anim.tick(endMs);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("SCEN-PA-COMPLETE-COIN: onComplete fires after duel + coin + end-beat", () => {
    const { ctx, onComplete } = makeCtx({
      evidence: makeEvidence({
        sidesMatched: false,
        intimidateMismatchRoll: { threshold: 60, roll: 0.8, missed: false },
      }),
    });
    const anim = new PenaltyAnimation(ctx);
    anim.start();
    // Should NOT fire at duel-end + end-beat time (coin extends the timeline)
    const earlyMs =
      ANIM_TIMING.BALL_FLIGHT_START +
      ANIM_TIMING.BALL_FLIGHT_DURATION +
      ANIM_TIMING.CARD_DUEL_DURATION +
      ANIM_TIMING.END_BEAT_DURATION +
      1;
    anim.tick(earlyMs);
    expect(onComplete).toHaveBeenCalledTimes(0);

    // Should fire after full coin + clash + end-beat
    const fullMs = COIN_END_MS + ANIM_TIMING.CLASH_DURATION + ANIM_TIMING.END_BEAT_DURATION + 1;
    anim.tick(fullMs - earlyMs); // remaining delta
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
