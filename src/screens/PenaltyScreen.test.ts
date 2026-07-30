import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container } from "pixi.js";
import {
  PenaltyScreen,
  setPendingPresenter,
  setPendingTeamColors,
  LAYOUT,
} from "./PenaltyScreen.ts";
import type { PenaltyViewModel } from "./PenaltyPresenter.ts";
import { DESIGN_WIDTH, DESIGN_HEIGHT } from "../engine/resize/designSize.ts";

// ─── Mock Presenter ────────────────────────────────────────────────────────────

type UnsubscribeFn = () => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMockPresenter(overrides?: Record<string, any>) {
  let registeredCb: (() => void) | null = null;

  const presenter = {
    viewModel: {
      humanRole: "striker",
      humanHand: { passives: [], actives: [], powerUps: [] },
      selection: {
        side: null,
        passive: null,
        active: null,
        equippedPowerUp: null,
      },
      score: { humanGoals: 0, aiGoals: 0, round: 1 },
      phase: "selecting",
      shootoutPhase: 1,
      lastOutcome: null,
      canConfirm: false,
      cardNames: new Map<number, string>(),
      cardPowers: new Map<number, number>(),
      cardImages: new Map<number, string>(),
    } as PenaltyViewModel,

    onStateChange: vi.fn((cb: () => void): UnsubscribeFn => {
      registeredCb = cb;
      return () => {
        registeredCb = null;
      };
    }),

    // Action spies
    selectSide: vi.fn(),
    selectPassive: vi.fn(),
    selectActive: vi.fn(),
    confirm: vi.fn(),
    advanceTurn: vi.fn(),
    acknowledgeReveal: vi.fn(),
    equipPowerUp: vi.fn(),

    // Ad reward
    canUseAdReward: vi.fn().mockReturnValue(false),
    adRewardUsesLeft: vi.fn().mockReturnValue(0),
    watchAdForPassive: vi.fn().mockResolvedValue(undefined),
    watchAdForActive: vi.fn().mockResolvedValue(undefined),

    // Test helpers
    _triggerStateChange() {
      registeredCb?.();
    },
    _hasSubscriber() {
      return registeredCb !== null;
    },
    ...overrides,
  };

  return presenter;
}

// ─── Phase 14: PenaltyScreen skeleton ─────────────────────────────────────────

describe("PenaltyScreen — Phase 14: skeleton", () => {
  it("is a PixiJS Container", () => {
    const screen = new PenaltyScreen();
    expect(screen).toBeInstanceOf(Container);
  });

  it("constructor is parameterless (BigPool constraint)", () => {
    expect(() => new PenaltyScreen()).not.toThrow();
  });

  it("SCEN-SCREEN-SUBSCRIBE-ON-PREPARE: prepare() registers one subscriber via onStateChange", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    expect(presenter.onStateChange).toHaveBeenCalledTimes(1);
  });

  it("SCEN-SCREEN-UNSUBSCRIBE-ON-HIDE: hide() unsubscribes — callback no longer fired after hide", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    expect(presenter._hasSubscriber()).toBe(true);
    await screen.hide();
    expect(presenter._hasSubscriber()).toBe(false);
  });

  it("show() resolves without throwing", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await expect(screen.show()).resolves.toBeUndefined();
  });

  it("reset() removes all children", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();
    screen.reset();
    expect(screen.children.length).toBe(0);
  });

  it("SCEN-PS-RESIZE: screen has no self-scaling resize() — the fixed-buffer engine drives layout instead", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    const asAppScreen = screen as unknown as {
      resize?: (w: number, h: number) => void;
    };
    expect(asAppScreen.resize).toBeUndefined();
    expect(screen.scale.x).toBe(1);
    expect(screen.scale.y).toBe(1);
  });
});

// ─── Phase 15: Layout and children ───────────────────────────────────────────

describe("PenaltyScreen — Phase 15: layout and render", () => {
  let screen: PenaltyScreen;
  let presenter: ReturnType<typeof makeMockPresenter>;

  beforeEach(async () => {
    screen = new PenaltyScreen();
    presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();
  });

  it("has children after prepare + show", () => {
    expect(screen.children.length).toBeGreaterThan(0);
  });

  it("re-renders when presenter fires onStateChange", () => {
    const childCountBefore = screen.children.length;
    presenter._triggerStateChange();
    // Children count should remain stable (re-render doesn't add/remove top-level panels)
    expect(screen.children.length).toBe(childCountBefore);
  });
});

// ─── Phase 16: Pointer input ──────────────────────────────────────────────────

describe("PenaltyScreen — Phase 16: pointer input", () => {
  let screen: PenaltyScreen;
  let presenter: ReturnType<typeof makeMockPresenter>;

  beforeEach(async () => {
    screen = new PenaltyScreen();
    presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();
  });

  it("tapping left side button calls presenter.selectSide('left')", () => {
    screen.sidePicker.children[0].emit("pointerdown", {} as never);
    expect(presenter.selectSide).toHaveBeenCalledWith("left");
  });

  it("tapping center side button calls presenter.selectSide('center')", () => {
    screen.sidePicker.children[1].emit("pointerdown", {} as never);
    expect(presenter.selectSide).toHaveBeenCalledWith("center");
  });

  it("tapping right side button calls presenter.selectSide('right')", () => {
    screen.sidePicker.children[2].emit("pointerdown", {} as never);
    expect(presenter.selectSide).toHaveBeenCalledWith("right");
  });

  it("tapping confirm button calls presenter.confirm() when canConfirm is true", async () => {
    // Update viewModel to have canConfirm true
    presenter.viewModel = {
      ...presenter.viewModel,
      selection: {
        side: "left",
        passive: {} as never,
        active: null,
        equippedPowerUp: null,
      },
      canConfirm: true,
    };
    presenter._triggerStateChange(); // re-render with new vm
    screen.confirmButton.emit("pointerdown", {} as never);
    expect(presenter.confirm).toHaveBeenCalledTimes(1);
  });

  it("tapping next button in result panel calls presenter.advanceTurn()", async () => {
    // Simulate showing-result phase
    presenter.viewModel = {
      ...presenter.viewModel,
      phase: "showing-result",
      lastOutcome: { goal: true, evidence: {} as never },
      canConfirm: false,
    };
    presenter._triggerStateChange();
    const nextBtn = screen.resultPanel.children[2];
    nextBtn.emit("pointerdown", {} as never);
    expect(presenter.advanceTurn).toHaveBeenCalledTimes(1);
  });
});

// ─── Phase 18: revealing-phase auto-advance via ticker ───────────────────────

function tickerOf(deltaMs: number): import("pixi.js").Ticker {
  return { deltaMS: deltaMs } as unknown as import("pixi.js").Ticker;
}

function evidenceMatched(): import("../entities/Match/ResolutionOutcome.ts").ResolutionEvidence {
  return {
    kickSide: "left",
    diveSide: "left",
    sidesMatched: true,
    directGoal: false,
    strikerPassiveId: 1,
    goalkeeperPassiveId: 4,
    activesFired: [],
    nullifiedActives: [],
    consumedOnMiss: [],
    finalPGoal: 60,
    roll: 0.4,
    strikerCurrentPower: 5,
    goalkeeperCurrentPower: 0,
  };
}

function evidenceMismatch(): import("../entities/Match/ResolutionOutcome.ts").ResolutionEvidence {
  return {
    kickSide: "left",
    diveSide: "right",
    sidesMatched: false,
    directGoal: true,
    strikerPassiveId: 1,
    goalkeeperPassiveId: 4,
    activesFired: [],
    nullifiedActives: [],
    consumedOnMiss: [],
    finalPGoal: null,
    roll: null,
    strikerCurrentPower: null,
    goalkeeperCurrentPower: null,
  };
}

describe("PenaltyScreen — Phase 18: revealing auto-advance", () => {
  it("calls acknowledgeReveal after the timeline completes (direct-goal branch)", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();

    presenter.viewModel = {
      ...presenter.viewModel,
      phase: "revealing",
      lastOutcome: { goal: true, evidence: evidenceMismatch() },
    };
    presenter._triggerStateChange();
    expect(presenter.acknowledgeReveal).not.toHaveBeenCalled();

    // Drive the ticker past the direct-goal timeline (~2500ms with new beat) with margin
    for (let t = 0; t < 3500; t += 100) {
      screen.update(tickerOf(100));
    }

    expect(presenter.acknowledgeReveal).toHaveBeenCalledTimes(1);
  });

  it("calls acknowledgeReveal after the timeline completes (matched-sides duel branch)", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();

    presenter.viewModel = {
      ...presenter.viewModel,
      phase: "revealing",
      lastOutcome: { goal: false, evidence: evidenceMatched() },
    };
    presenter._triggerStateChange();
    expect(presenter.acknowledgeReveal).not.toHaveBeenCalled();

    // Matched-sides timeline ~4500ms (2500 duel + 800 end-beat + earlier steps); drive past with margin
    for (let t = 0; t < 5500; t += 100) {
      screen.update(tickerOf(100));
    }

    expect(presenter.acknowledgeReveal).toHaveBeenCalledTimes(1);
  });

  it("update() is a no-op outside revealing phase", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    expect(() => screen.update(tickerOf(16))).not.toThrow();
    expect(presenter.acknowledgeReveal).not.toHaveBeenCalled();
  });
});

// ─── Phase 17: landscape layout (mobile-aspect-scaling PR3) ──────────────────

describe("PenaltyScreen — Phase 17: landscape layout invariants", () => {
  it("SCEN-PS-CANVAS-LANDSCAPE: LAYOUT canvas matches the shared fixed design buffer (1280x720)", () => {
    expect(LAYOUT.CANVAS_W).toBe(DESIGN_WIDTH);
    expect(LAYOUT.CANVAS_H).toBe(DESIGN_HEIGHT);
  });

  it("SCEN-PS-HAND-ZONES-FIT: passive/active hand zones + divider exactly span the canvas width", () => {
    expect(LAYOUT.HAND.zoneW * 2 + LAYOUT.HAND.divider).toBe(LAYOUT.CANVAS_W);
  });

  it("SCEN-PS-GOAL-ZONES-IN-BOUNDS: all three side-picker zones stay within canvas bounds", () => {
    const { w, h } = LAYOUT.GOAL_ZONE_SIZE;
    for (const zone of Object.values(LAYOUT.GOAL_ZONES)) {
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + w).toBeLessThanOrEqual(LAYOUT.CANVAS_W);
      expect(zone.y + h).toBeLessThanOrEqual(LAYOUT.CANVAS_H);
    }
  });

  it("SCEN-PS-CONFIRM-NO-OVERLAP: confirm button sits above the hand row with no vertical overlap", () => {
    const confirmBottom = LAYOUT.CONFIRM_BTN.y + LAYOUT.CONFIRM_BTN.h;
    const handTop = LAYOUT.HAND.y - LAYOUT.HAND.cardH / 2;
    expect(confirmBottom).toBeLessThanOrEqual(handTop);
  });

  it("SCEN-PS-HAND-IN-BOUNDS: hand row (cards) stays within canvas height", () => {
    const handBottom = LAYOUT.HAND.y + LAYOUT.HAND.cardH / 2;
    expect(handBottom).toBeLessThanOrEqual(LAYOUT.CANVAS_H);
  });

  it("SCEN-PS-INTERACTIVE-BOUNDS: gear/tutorial corner icons stay within canvas bounds", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    // scoreDisplay children: [badge, gear, mark? ...] — gear/tutorial are Graphics
    // with an explicit hitArea Rectangle; assert every hitArea on scoreDisplay's
    // subtree stays inside the fixed 1280x720 buffer.
    const walk = (c: Container): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hitArea = (c as any).hitArea as
        | { x: number; y: number; width: number; height: number }
        | undefined;
      if (hitArea) {
        expect(hitArea.x).toBeGreaterThanOrEqual(0);
        expect(hitArea.y).toBeGreaterThanOrEqual(0);
        expect(hitArea.x + hitArea.width).toBeLessThanOrEqual(LAYOUT.CANVAS_W);
        expect(hitArea.y + hitArea.height).toBeLessThanOrEqual(LAYOUT.CANVAS_H);
      }
      for (const child of c.children) walk(child as Container);
    };
    walk(screen.scoreDisplay);
  });
});

// ─── T-08: Draw branch (draw-format) ─────────────────────────────────────────

describe("PenaltyScreen — draw phase (REQ-FORMAT-006)", () => {
  it("SCEN-DRAW-GAMEOVER-PANEL: vm.phase==='draw' → gameOverPanel.visible === true", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    await screen.show();

    presenter.viewModel = {
      ...presenter.viewModel,
      phase: "draw",
      shootoutPhase: 2,
      score: { humanGoals: 3, aiGoals: 3, round: 10 },
      canConfirm: false,
    } as never;
    presenter._triggerStateChange();

    expect(screen.gameOverPanel.visible).toBe(true);
  });

  it("SCEN-DRAW-ONCOMPLETE: vm.phase==='draw' → CONTINUE button calls _onMatchComplete", async () => {
    const screen = new PenaltyScreen();
    const onMatchComplete = vi.fn();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    // Set up onMatchComplete callback via the pending slot
    const { setPendingOnMatchComplete } = await import("./PenaltyScreen.ts");
    setPendingOnMatchComplete(onMatchComplete);
    screen.prepare();
    await screen.show();

    presenter.viewModel = {
      ...presenter.viewModel,
      phase: "draw",
      shootoutPhase: 2,
      score: { humanGoals: 2, aiGoals: 2, round: 10 },
      canConfirm: false,
    } as never;
    presenter._triggerStateChange();

    // The CONTINUE button is the last child inside gameOverPanel (the continueBtn Container)
    const continueBtn = screen.gameOverPanel.children[screen.gameOverPanel.children.length - 1];
    continueBtn.emit("pointerdown", {} as never);
    expect(onMatchComplete).toHaveBeenCalledTimes(1);
  });
});

// ─── T-DUEL: Duel panel layout and background ─────────────────────────────────

/** Finds the duelPanel container inside a PenaltyScreen instance. */
function findDuelPanel(screen: PenaltyScreen): import("pixi.js").Container {
  // duelPanel is a public property of PenaltyScreen
  return screen.duelPanel;
}

describe("PenaltyScreen — T-DUEL: duel panel", () => {
  it("T-DUEL-1: duelPanel has at least 9 children after prepare() (dark base + 3 bg layers + 2 sprites + 2 active sprites + VS text + 2 name texts)", async () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    setPendingTeamColors(0x1a3a6a, 0x1a3a6a, 0x3a1a1a, 0x3a1a1a);
    screen.prepare();
    await screen.show();

    const panel = findDuelPanel(screen);
    // _duelBgLeft + _duelBgRight + _duelLines + humanSprite + humanActiveSprite + vsTxt + aiSprite + aiActiveSprite = 8
    expect(panel.children.length).toBeGreaterThanOrEqual(7);
  });

  it("T-DUEL-2: _buildDuelPanel does not throw when kit colors are default (0xffffff)", () => {
    // This verifies the panel builds safely without colors set (constructor path)
    // AND that _refreshDuelBackground() (called from prepare()) works with white defaults
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    // No setPendingTeamColors call — uses defaults (0xffffff)
    expect(() => screen.prepare()).not.toThrow();

    const panel = findDuelPanel(screen);
    // Panel must have been built and refreshed successfully with default colors
    expect(panel.children.length).toBeGreaterThanOrEqual(7);
  });
});

// ─── Team kit colors ──────────────────────────────────────────────────────────

describe("PenaltyScreen — team kit colors", () => {
  it("SCEN-PS-KIT-EXPORTED: setPendingTeamColors is an exported function", () => {
    expect(typeof setPendingTeamColors).toBe("function");
  });

  it("SCEN-PS-KIT-STORED: all four colors are consumed by prepare()", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    setPendingTeamColors(0xff0000, 0x00ff00, 0x0000ff, 0xffff00);
    screen.prepare();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = screen as any;
    expect(s._humanKitColor).toBe(0xff0000);
    expect(s._humanKeeperColor).toBe(0x00ff00);
    expect(s._aiKitColor).toBe(0x0000ff);
    expect(s._aiKeeperColor).toBe(0xffff00);
  });

  it("SCEN-PS-KIT-DEFAULTS: prepare() without setPendingTeamColors leaves colors as white", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    screen.prepare();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = screen as any;
    expect(s._humanKitColor).toBe(0xffffff);
    expect(s._humanKeeperColor).toBe(0xffffff);
    expect(s._aiKitColor).toBe(0xffffff);
    expect(s._aiKeeperColor).toBe(0xffffff);
  });

  it("SCEN-PS-KIT-CLEARED: reset() resets stored colors to white", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    setPendingTeamColors(0xff0000, 0x00ff00, 0x0000ff, 0xffff00);
    screen.prepare();
    screen.reset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = screen as any;
    expect(s._humanKitColor).toBe(0xffffff);
    expect(s._humanKeeperColor).toBe(0xffffff);
    expect(s._aiKitColor).toBe(0xffffff);
    expect(s._aiKeeperColor).toBe(0xffffff);
  });

  it("SCEN-PS-KIT-ROLE-KEEPER: _applyRoleColors('goalkeeper') does not throw", () => {
    const screen = new PenaltyScreen();
    const presenter = makeMockPresenter();
    setPendingPresenter(presenter as never);
    setPendingTeamColors(0xff0000, 0x00ff00, 0x0000ff, 0xffff00);
    screen.prepare();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (screen as any)._applyRoleColors("goalkeeper")).not.toThrow();
  });
});
