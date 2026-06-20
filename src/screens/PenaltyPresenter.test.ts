import { describe, it, expect, vi } from "vitest";
import { PenaltyPresenter } from "./PenaltyPresenter.ts";
import { AdRewardService } from "../services/AdRewardService.ts";
import { PenaltyShootout } from "../entities/Match/PenaltyShootout.ts";
import { HumanPlayer } from "../entities/Players/HumanPlayer.ts";
import { IAPlayer } from "../entities/Players/IAPlayer.ts";
import { Striker } from "../entities/Footballers/Striker.ts";
import { Goalkeeper } from "../entities/Footballers/Goalkeeper.ts";
import { ShootCard } from "../entities/Cards/passive/ShootCard.ts";
import { SaveCard } from "../entities/Cards/passive/SaveCard.ts";
import { CheatingCard } from "../entities/Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../entities/Cards/active/IntimidateCard.ts";
import { NullifyCard } from "../entities/Cards/active/NullifyCard.ts";
import { AdrenalineBoost } from "../entities/Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../entities/Cards/powerup/FocusPill.ts";
import { IAStrategy } from "../entities/Players/IAStrategy.ts";
import { TurnContext } from "../entities/Players/TurnContext.ts";
import { PassiveCard } from "../entities/Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../entities/Cards/active/ActiveCard.ts";
import { Side } from "../entities/Players/Side.ts";

// Deterministic strategy: always picks first card, no active, always "center"
class AlwaysCenterStrategy implements IAStrategy {
  pick(context: TurnContext): PassiveCard {
    return context.availableCards[0];
  }
  pickActive(
    _role: "shooter" | "goalkeeper",
    _pool: ActiveCard[],
  ): ActiveCard | undefined {
    return undefined;
  }
  pickSide(_role: "shooter" | "goalkeeper"): Side {
    return "center";
  }
}

// Helper to build a fresh shootout + human player for each test
function buildFixture() {
  const humanShootCards = [
    new ShootCard(1, "Strike Normal", "A standard kick.", "", "Normal"),
    new ShootCard(2, "Strike Special", "A powerful kick.", "", "Special"),
    new ShootCard(3, "Strike Epic", "An unstoppable kick.", "", "Epic"),
  ];
  const humanSaveCards = [
    new SaveCard(4, "Save Normal", "A standard save.", "", "Normal"),
    new SaveCard(5, "Save Special", "A skilled save.", "", "Special"),
    new SaveCard(6, "Save Epic", "A legendary save.", "", "Epic"),
  ];
  const humanCheating = new CheatingCard(7, "Cheat", "Bends the rules.", "");
  const humanNullify1 = new NullifyCard(8, "Nullify", "Cancels a card.", "");
  const humanIntimidate = new IntimidateCard(
    9,
    "Intimidate",
    "Breaks focus.",
    "",
  );
  const humanNullify2 = new NullifyCard(10, "Nullify B", "Cancels a card.", "");
  const humanAdrenaline = new AdrenalineBoost(
    11,
    "Adrenaline",
    "Power boost.",
    "",
  );
  const humanFocus = new FocusPill(12, "Focus", "Immune to actives.", "");

  const humanStriker = new Striker(
    humanShootCards,
    [humanCheating, humanNullify1],
    [humanAdrenaline],
  );
  const humanGoalkeeper = new Goalkeeper(
    humanSaveCards,
    [humanIntimidate, humanNullify2],
    [humanFocus],
  );
  const humanPlayer = new HumanPlayer("human-1", humanGoalkeeper, humanStriker);

  const iaShootCards = [
    new ShootCard(101, "IA Strike Normal", "", "", "Normal"),
    new ShootCard(102, "IA Strike Special", "", "", "Special"),
    new ShootCard(103, "IA Strike Epic", "", "", "Epic"),
  ];
  const iaSaveCards = [
    new SaveCard(104, "IA Save Normal", "", "", "Normal"),
    new SaveCard(105, "IA Save Special", "", "", "Special"),
    new SaveCard(106, "IA Save Epic", "", "", "Epic"),
  ];
  const iaCheating = new CheatingCard(107, "IA Cheat", "", "");
  const iaNullify1 = new NullifyCard(108, "IA Nullify", "", "");
  const iaIntimidate = new IntimidateCard(109, "IA Intimidate", "", "");
  const iaNullify2 = new NullifyCard(110, "IA Nullify B", "", "");
  const iaAdrenaline = new AdrenalineBoost(111, "IA Adrenaline", "", "");
  const iaFocus = new FocusPill(112, "IA Focus", "", "");

  const iaStriker = new Striker(
    iaShootCards,
    [iaCheating, iaNullify1],
    [iaAdrenaline],
  );
  const iaGoalkeeper = new Goalkeeper(
    iaSaveCards,
    [iaIntimidate, iaNullify2],
    [iaFocus],
  );
  const iaPlayer = new IAPlayer(
    "ia-1",
    iaGoalkeeper,
    iaStriker,
    new AlwaysCenterStrategy(),
  );

  const shootout = new PenaltyShootout(
    humanPlayer,
    iaPlayer,
    { shootCards: humanShootCards, saveCards: humanSaveCards },
    { shootCards: iaShootCards, saveCards: iaSaveCards },
  );

  return {
    shootout,
    humanPlayer,
    iaPlayer,
    humanPlayerId: "human-1",
    humanShootCards,
    humanSaveCards,
    humanCheating,
    humanNullify1,
    humanIntimidate,
    humanNullify2,
    humanAdrenaline,
    humanFocus,
  };
}

// ─── Phase 2: Initial ViewModel ───────────────────────────────────────────────

describe("PenaltyPresenter — SCEN-VM-INITIAL", () => {
  it("has phase === 'selecting', all selection null, canConfirm false, score 0/0/1, lastOutcome null", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const vm = presenter.viewModel;

    expect(vm.phase).toBe("selecting");
    expect(vm.selection.side).toBeNull();
    expect(vm.selection.passive).toBeNull();
    expect(vm.selection.active).toBeNull();
    expect(vm.selection.equippedPowerUp).toBeNull();
    expect(vm.canConfirm).toBe(false);
    expect(vm.score).toEqual({ humanGoals: 0, aiGoals: 0, round: 1 });
    expect(vm.lastOutcome).toBeNull();
  });
});

// ─── Phase 3: selectSide ──────────────────────────────────────────────────────

describe("PenaltyPresenter — SCEN-SELECT-SIDE", () => {
  it("selectSide sets selection.side and fires onStateChange once", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.selectSide("left");
    expect(presenter.viewModel.selection.side).toBe("left");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("SCEN-STATE-CHANGE-FIRED-ONCE: callback invoked exactly once per selectSide call", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.selectSide("right");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ─── Phase 4: selectPassive ───────────────────────────────────────────────────

describe("PenaltyPresenter — selectPassive", () => {
  it("selectPassive sets selection.passive and fires callback once", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.selectPassive(humanShootCards[0]);
    expect(presenter.viewModel.selection.passive).toBe(humanShootCards[0]);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ─── Phase 5: selectActive toggle ────────────────────────────────────────────

describe("PenaltyPresenter — SCEN-SELECT-ACTIVE-TOGGLE", () => {
  it("calling selectActive twice with same card → null", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanCheating } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectActive(humanCheating);
    expect(presenter.viewModel.selection.active).toBe(humanCheating);
    presenter.selectActive(humanCheating);
    expect(presenter.viewModel.selection.active).toBeNull();
  });

  it("calling selectActive(null) → null", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanCheating } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectActive(humanCheating);
    presenter.selectActive(null);
    expect(presenter.viewModel.selection.active).toBeNull();
  });

  it("calling selectActive with different card → replaces", () => {
    const {
      shootout,
      humanPlayer,
      humanPlayerId,
      iaPlayer,
      humanCheating,
      humanNullify1,
    } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectActive(humanCheating);
    presenter.selectActive(humanNullify1);
    expect(presenter.viewModel.selection.active).toBe(humanNullify1);
  });
});

// ─── Phase 6: canConfirm derivation ──────────────────────────────────────────

describe("PenaltyPresenter — SCEN-CAN-CONFIRM-GUARD", () => {
  it("side set but passive null → canConfirm false", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    expect(presenter.viewModel.canConfirm).toBe(false);
  });

  it("passive set but side null → canConfirm false", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectPassive(humanShootCards[0]);
    expect(presenter.viewModel.canConfirm).toBe(false);
  });

  it("both side and passive set → canConfirm true", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    expect(presenter.viewModel.canConfirm).toBe(true);
  });
});

// ─── Phase 7: equipPowerUp ────────────────────────────────────────────────────

describe("PenaltyPresenter — REQ-POWERUP-EQUIP", () => {
  it("SCEN-POWERUP-EQUIP-GUARD: canEquip false → throws, equipTo never called", () => {
    const {
      shootout,
      humanPlayer,
      humanPlayerId,
      iaPlayer,
      humanAdrenaline,
      humanShootCards,
    } = buildFixture();
    humanAdrenaline.used = true; // force canEquip() === false
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const equipToSpy = vi.spyOn(humanAdrenaline, "equipTo");
    expect(() =>
      presenter.equipPowerUp(humanAdrenaline, humanShootCards[0]),
    ).toThrow();
    expect(equipToSpy).not.toHaveBeenCalled();
  });

  it("SCEN-POWERUP-MUTATES-PASSIVE: usable PowerUpCard → equipTo called, equippedPowerUp set", () => {
    const {
      shootout,
      humanPlayer,
      humanPlayerId,
      iaPlayer,
      humanAdrenaline,
      humanShootCards,
    } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const equipToSpy = vi.spyOn(humanAdrenaline, "equipTo");
    presenter.equipPowerUp(humanAdrenaline, humanShootCards[0]);
    expect(equipToSpy).toHaveBeenCalledTimes(1);
    expect(equipToSpy).toHaveBeenCalledWith(humanShootCards[0]);
    expect(presenter.viewModel.selection.equippedPowerUp).toBe(humanAdrenaline);
  });
});

// ─── Phase 8: onStateChange subscription ─────────────────────────────────────

describe("PenaltyPresenter — REQ-ON-STATE-CHANGE", () => {
  it("SCEN-UNSUBSCRIBE: after unsubscribe, callback no longer fired", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    const unsubscribe = presenter.onStateChange(cb);
    unsubscribe();
    presenter.selectSide("center");
    expect(cb).not.toHaveBeenCalled();
  });

  it("two subscribers both receive notification", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    presenter.onStateChange(cb1);
    presenter.onStateChange(cb2);
    presenter.selectSide("center");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ─── Phase 9: confirm() ───────────────────────────────────────────────────────

describe("PenaltyPresenter — confirm()", () => {
  it("SCEN-CONFIRM-BLOCKED-IF-NO-SIDE: throws if canConfirm false", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(() => presenter.confirm()).toThrow();
  });

  it("SCEN-GAME-OVER-NO-CONFIRM: throws if phase === 'game-over'", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    // Force game-over by hacking the _vm phase (not via public API — we'll use a game-over shootout)
    // We set selection valid, confirm, then patch — but easier: just test the error path via a subclass approach
    // Instead let's confirm with a real game-over by playing enough rounds
    // Actually the simplest approach: we'll just test it via the error path described in design
    // We need to simulate game over, use Phase 12 test instead — for now just test the guard
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    expect(() => presenter.confirm()).not.toThrow(); // should succeed here
    // After confirm, phase is revealing — confirm again should throw (canConfirm is false after confirm)
    expect(() => presenter.confirm()).toThrow();
  });

  it("SCEN-CONFIRM-WIRES-HUMAN-PLAYER: calls setPendingSide, setPendingSelection, shootout.advance", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const setSideSpy = vi.spyOn(humanPlayer, "setPendingSide");
    const setSelectionSpy = vi.spyOn(humanPlayer, "setPendingSelection");
    const advanceSpy = vi.spyOn(shootout, "advance");
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    expect(setSideSpy).toHaveBeenCalledTimes(1);
    expect(setSideSpy).toHaveBeenCalledWith("left");
    expect(setSelectionSpy).toHaveBeenCalledTimes(1);
    expect(setSelectionSpy).toHaveBeenCalledWith(humanShootCards[0]);
    expect(advanceSpy).toHaveBeenCalledTimes(1);
  });

  it("SCEN-PHASE-AFTER-CONFIRM: phase → 'revealing', lastOutcome not null", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    expect(presenter.viewModel.phase).toBe("revealing");
    expect(presenter.viewModel.lastOutcome).not.toBeNull();
  });

  it("acknowledgeReveal transitions revealing → showing-result", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    expect(presenter.viewModel.phase).toBe("showing-result");
  });

  it("acknowledgeReveal is a no-op outside revealing phase", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.acknowledgeReveal();
    expect(cb).not.toHaveBeenCalled();
    expect(presenter.viewModel.phase).toBe("selecting");
  });
});

// ─── Phase 10: advanceTurn() ──────────────────────────────────────────────────

describe("PenaltyPresenter — advanceTurn()", () => {
  it("SCEN-ADVANCE-TURN-CLEARS-SELECTION: clears all selection, phase → 'selecting', callback fired", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.advanceTurn();
    const vm = presenter.viewModel;
    expect(vm.selection.side).toBeNull();
    expect(vm.selection.passive).toBeNull();
    expect(vm.selection.active).toBeNull();
    expect(vm.selection.equippedPowerUp).toBeNull();
    expect(vm.phase).toBe("selecting");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("SCEN-ADVANCE-TURN-SWAPS-ROLE: round 1 striker → round 2 goalkeeper", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    // Round 1: human is striker (playerA is shooter initially)
    expect(presenter.viewModel.humanRole).toBe("striker");
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    presenter.advanceTurn();
    // Round 2: human is goalkeeper (roles swapped)
    expect(presenter.viewModel.humanRole).toBe("goalkeeper");
    expect(
      presenter.viewModel.humanHand.passives.every(
        (c) => c instanceof SaveCard,
      ),
    ).toBe(true);
  });

  it("advanceTurn increments round counter", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    presenter.advanceTurn();
    expect(presenter.viewModel.score.round).toBe(2);
  });

  it("advanceTurn is no-op if phase !== 'showing-result'", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    const cb = vi.fn();
    presenter.onStateChange(cb);
    presenter.advanceTurn(); // phase is 'selecting', should be no-op
    expect(cb).not.toHaveBeenCalled();
    expect(presenter.viewModel.phase).toBe("selecting");
  });
});

// ─── Phase 11: humanHand role filter ─────────────────────────────────────────

describe("PenaltyPresenter — REQ-ROLE-ADAPTATION", () => {
  it("SCEN-ROLE-FILTER-STRIKER: no SaveCard in passives, no IntimidateCard in actives when striker", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(presenter.viewModel.humanRole).toBe("striker");
    const { passives, actives } = presenter.viewModel.humanHand;
    expect(passives.some((c) => c instanceof SaveCard)).toBe(false);
    expect(actives.some((c) => c instanceof IntimidateCard)).toBe(false);
  });

  it("SCEN-ROLE-FILTER-GOALKEEPER: no ShootCard in passives, no CheatingCard in actives when goalkeeper", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    // Advance to goalkeeper role
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    presenter.advanceTurn();
    expect(presenter.viewModel.humanRole).toBe("goalkeeper");
    const { passives, actives } = presenter.viewModel.humanHand;
    expect(passives.some((c) => c instanceof ShootCard)).toBe(false);
    expect(actives.some((c) => c instanceof CheatingCard)).toBe(false);
  });
});

// ─── T-06: Draw path + shootoutPhase propagation (draw-format) ───────────────

// Stub shootout that emits GameOver with winner === null (draw)
class StubDrawShootout {
  private _advanced = false;

  get state(): import("../entities/Match/MatchState.ts").MatchState {
    if (this._advanced) {
      return { phase: "GameOver", winner: null };
    }
    return {
      phase: "WaitingForDecisions",
      shooterId: "human-1",
      goalkeeperId: "ia-1",
    };
  }

  get lastOutcome():
    | import("../entities/Match/ResolutionOutcome.ts").ResolutionOutcome
    | null {
    if (!this._advanced) return null;
    return {
      goal: false,
      evidence: {
        kickSide: "left",
        diveSide: "right",
        sidesMatched: false,
        directGoal: false,
        strikerPassiveId: 1,
        goalkeeperPassiveId: 104,
        activesFired: [],
        nullifiedActives: [],
        consumedOnMiss: [],
        finalPGoal: null,
        roll: null,
        strikerCurrentPower: null,
        goalkeeperCurrentPower: null,
      },
    };
  }

  get score(): { playerA: number; playerB: number } {
    return { playerA: 2, playerB: 2 };
  }

  get shootoutPhase(): 1 | 2 | "sd" {
    return 2;
  }

  advance(): void {
    this._advanced = true;
  }
}

// Stub shootout that exposes a configurable shootoutPhase for propagation testing
class StubPhaseShootout {
  constructor(private readonly _shootoutPhase: 1 | 2 | "sd") {}

  get state(): import("../entities/Match/MatchState.ts").MatchState {
    return {
      phase: "WaitingForDecisions",
      shooterId: "human-1",
      goalkeeperId: "ia-1",
    };
  }

  get lastOutcome(): null { return null; }
  get score(): { playerA: number; playerB: number } { return { playerA: 0, playerB: 0 }; }
  get shootoutPhase(): 1 | 2 | "sd" { return this._shootoutPhase; }
  advance(): void {}
}

describe("PenaltyPresenter — REQ-FORMAT-007: shootoutPhase propagation", () => {
  it("vm.shootoutPhase reflects shootout.shootoutPhase === 1 initially", () => {
    const { humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout: new StubPhaseShootout(1) as unknown as import("../entities/Match/PenaltyShootout.ts").PenaltyShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(presenter.viewModel.shootoutPhase).toBe(1);
  });

  it("vm.shootoutPhase reflects shootout.shootoutPhase === 2", () => {
    const { humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout: new StubPhaseShootout(2) as unknown as import("../entities/Match/PenaltyShootout.ts").PenaltyShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(presenter.viewModel.shootoutPhase).toBe(2);
  });

  it("vm.shootoutPhase reflects shootout.shootoutPhase === 'sd'", () => {
    const { humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout: new StubPhaseShootout("sd") as unknown as import("../entities/Match/PenaltyShootout.ts").PenaltyShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(presenter.viewModel.shootoutPhase).toBe("sd");
  });
});

describe("PenaltyPresenter — REQ-FORMAT-006 + REQ-FORMAT-007: draw path", () => {
  it("SCEN-DRAW-PHASE: after acknowledgeReveal with winner===null vm.phase === 'draw'", () => {
    const { humanPlayer, humanPlayerId, iaPlayer, humanShootCards } = buildFixture();
    const stubShootout = new StubDrawShootout() as unknown as import("../entities/Match/PenaltyShootout.ts").PenaltyShootout;
    const presenter = new PenaltyPresenter({
      shootout: stubShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();
    expect(presenter.viewModel.phase).toBe("draw");
  });

  it("SCEN-DRAW-SHOOTOUT-PHASE: vm.shootoutPhase matches stub getter after draw", () => {
    const { humanPlayer, humanPlayerId, iaPlayer, humanShootCards } = buildFixture();
    const stubShootout = new StubDrawShootout() as unknown as import("../entities/Match/PenaltyShootout.ts").PenaltyShootout;
    const presenter = new PenaltyPresenter({
      shootout: stubShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    // During reveal vm.shootoutPhase should still reflect the shootout getter
    expect(presenter.viewModel.shootoutPhase).toBe(2);
  });
});

// ─── Phase 12: game-over phase ────────────────────────────────────────────────

// Minimal stub: satisfies only the surface PenaltyPresenter reads after advance().
// - state: starts at WaitingForDecisions; becomes GameOver after first advance()
// - lastOutcome: returns a minimal valid ResolutionOutcome
// - score: always 0/0 (presenter only displays it)
// - advance(): does NOT call player.decide() — presenter already called setPendingSide/Selection before calling advance()
class StubGameOverShootout {
  private _advanced = false;

  get state(): import("../entities/Match/MatchState.ts").MatchState {
    if (this._advanced) {
      return { phase: "GameOver", winner: "human-1" };
    }
    return {
      phase: "WaitingForDecisions",
      shooterId: "human-1",
      goalkeeperId: "ia-1",
    };
  }

  get lastOutcome():
    | import("../entities/Match/ResolutionOutcome.ts").ResolutionOutcome
    | null {
    if (!this._advanced) return null;
    return {
      goal: true,
      evidence: {
        kickSide: "left",
        diveSide: "right",
        sidesMatched: false,
        directGoal: true,
        strikerPassiveId: 1,
        goalkeeperPassiveId: 104,
        activesFired: [],
        nullifiedActives: [],
        consumedOnMiss: [],
        finalPGoal: null,
        roll: null,
        strikerCurrentPower: null,
        goalkeeperCurrentPower: null,
      },
    };
  }

  get score(): { playerA: number; playerB: number } {
    return { playerA: 1, playerB: 0 };
  }

  advance(): void {
    this._advanced = true;
  }
}

describe("PenaltyPresenter — REQ-GAME-OVER", () => {
  it("SCEN-GAME-OVER-EXPOSED: confirm() transitions to 'game-over' when shootout reaches GameOver", () => {
    const { humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const stubShootout =
      new StubGameOverShootout() as unknown as PenaltyShootout;
    const presenter = new PenaltyPresenter({
      shootout: stubShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });

    // One selection + confirm is enough: stub reports GameOver after first advance()
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    // Reveal panel sits between resolving and game-over; dismiss it to land on game-over
    presenter.acknowledgeReveal();

    expect(presenter.viewModel.phase).toBe("game-over");
  });

  it("SCEN-GAME-OVER-NO-CONFIRM: confirm() throws when phase === 'game-over'", () => {
    const { humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const stubShootout =
      new StubGameOverShootout() as unknown as PenaltyShootout;
    const presenter = new PenaltyPresenter({
      shootout: stubShootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });

    // Drive into game-over via the mocked shootout
    presenter.selectSide("left");
    presenter.selectPassive(humanShootCards[0]);
    presenter.confirm();
    presenter.acknowledgeReveal();

    expect(presenter.viewModel.phase).toBe("game-over");
    // Now confirm() must throw because phase === "game-over"
    expect(() => presenter.confirm()).toThrow("Match is over");
  });
});

// ─── Ad Reward Presenter ──────────────────────────────────────────────────────

function makeAdRewardService(overrides: {
  canUse?: boolean;
  result?: "granted" | "denied" | "exhausted";
}): AdRewardService {
  const service = {
    canUse: vi.fn().mockReturnValue(overrides.canUse ?? true),
    requestReward: vi.fn().mockResolvedValue(overrides.result ?? "granted"),
  } as unknown as AdRewardService;
  return service;
}

describe("PenaltyPresenter — SCEN-AD-PRES-CANUSE", () => {
  it("canUseAdReward() returns true when service.canUse() is true", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
      adRewardService: makeAdRewardService({ canUse: true }),
    });
    expect(presenter.canUseAdReward()).toBe(true);
  });
});

describe("PenaltyPresenter — SCEN-AD-PRES-NOSERVICE", () => {
  it("canUseAdReward() returns false when no service", () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer } = buildFixture();
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
    });
    expect(presenter.canUseAdReward()).toBe(false);
  });
});

describe("PenaltyPresenter — SCEN-AD-PRES-WATCHPASSIVE-GRANTED", () => {
  it("watchAdForPassive calls card.rewindCooldown on 'granted'", async () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const card = humanShootCards[0];
    const rewindSpy = vi.spyOn(card, "rewindCooldown");
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
      adRewardService: makeAdRewardService({ result: "granted" }),
    });
    await presenter.watchAdForPassive(card);
    expect(rewindSpy).toHaveBeenCalledWith(card.cooldown);
  });
});

describe("PenaltyPresenter — SCEN-AD-PRES-WATCHACTIVE-GRANTED", () => {
  it("watchAdForActive calls card.reset() on 'granted'", async () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanCheating } =
      buildFixture();
    const resetSpy = vi.spyOn(humanCheating, "reset");
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
      adRewardService: makeAdRewardService({ result: "granted" }),
    });
    await presenter.watchAdForActive(humanCheating);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});

describe("PenaltyPresenter — SCEN-AD-PRES-WATCHPASSIVE-DENIED", () => {
  it("watchAdForPassive does NOT call rewindCooldown on 'denied'", async () => {
    const { shootout, humanPlayer, humanPlayerId, iaPlayer, humanShootCards } =
      buildFixture();
    const card = humanShootCards[0];
    const rewindSpy = vi.spyOn(card, "rewindCooldown");
    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
      adRewardService: makeAdRewardService({ result: "denied" }),
    });
    await presenter.watchAdForPassive(card);
    expect(rewindSpy).not.toHaveBeenCalled();
  });
});
