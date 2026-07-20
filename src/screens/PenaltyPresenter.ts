import { PenaltyShootout } from "../entities/Match/PenaltyShootout.ts";
import { HumanPlayer } from "../entities/Players/HumanPlayer.ts";
import { IPlayer } from "../entities/Players/IPlayer.ts";
import { RemotePlayer } from "../entities/Players/RemotePlayer.ts";
import { PassiveCard } from "../entities/Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../entities/Cards/active/ActiveCard.ts";
import { PowerUpCard } from "../entities/Cards/powerup/PowerUpCard.ts";
import { Card } from "../entities/Cards/Card.ts";
import { Side } from "../entities/Players/Side.ts";
import { ResolutionOutcome } from "../entities/Match/ResolutionOutcome.ts";
import { PlayerCards } from "../entities/Match/PlayerCards.ts";
import {
  RemoteDecisionAdapter,
  RemoteDecisionPayload,
} from "../net/RemoteDecisionAdapter.ts";
import type { MultiplayerOutboundMessage } from "../net/MultiplayerOutboundMessage.ts";
import { cardArtUrl } from "./sprites/cardArt.ts";
import type { AdRewardService } from "../services/AdRewardService.ts";

// Design decision: inline in same file — only one consumer (PenaltyScreen)
export interface PenaltyViewModel {
  humanRole: "striker" | "goalkeeper";
  humanHand: {
    passives: PassiveCard[];
    actives: ActiveCard[];
    powerUps: PowerUpCard[];
  };
  selection: {
    side: Side | null;
    passive: PassiveCard | null;
    active: ActiveCard | null;
    equippedPowerUp: PowerUpCard | null;
  };
  score: {
    humanGoals: number;
    aiGoals: number;
    round: number;
  };
  phase:
    | "selecting"
    | "resolving"
    | "revealing"
    | "showing-result"
    | "game-over"
    | "draw";
  shootoutPhase: 1 | 2 | "sd";
  lastOutcome: ResolutionOutcome | null;
  canConfirm: boolean;
  cardNames: ReadonlyMap<number, string>;
  cardPowers: ReadonlyMap<number, number>;
  cardImages: ReadonlyMap<number, string>;
}

export class PenaltyPresenter {
  private readonly _shootout: PenaltyShootout;
  private readonly _humanPlayerId: string;
  private readonly _humanPlayer: HumanPlayer;
  private readonly _iaPlayer: IPlayer;
  private readonly _cardNames: ReadonlyMap<number, string>;
  private readonly _cardPowers: ReadonlyMap<number, number>;
  private readonly _cardImages: ReadonlyMap<number, string>;
  private _listeners: Array<() => void> = [];
  private _vm: PenaltyViewModel;
  // Where to land after the user dismisses the reveal panel
  private _pendingPostRevealPhase: "showing-result" | "game-over" | "draw" =
    "showing-result";

  private readonly _adRewardService: AdRewardService | null;

  // REQ-MULTIPLAYER-PRESENTER-ROLE: null in single-player. In multiplayer,
  // host is authoritative (runs advance()/resolver, forwards the outcome);
  // guest never resolves locally — it stages its decision, sends it, and
  // waits for the host's outcome (see confirm() and receiveRemoteX below).
  private readonly _multiplayer: {
    role: "host" | "guest";
    send: (message: MultiplayerOutboundMessage) => void;
  } | null;
  // Host-only bookkeeping: both sides' decisions must be staged before a
  // turn can resolve. Reset after each resolved turn.
  private _localDecisionStaged = false;
  private _remoteDecisionStaged = false;

  constructor(deps: {
    shootout: PenaltyShootout;
    humanPlayerId: string;
    humanPlayer: HumanPlayer;
    iaPlayer: IPlayer;
    adRewardService?: AdRewardService | null;
    multiplayer?: {
      role: "host" | "guest";
      send: (message: MultiplayerOutboundMessage) => void;
    };
  }) {
    this._shootout = deps.shootout;
    this._humanPlayerId = deps.humanPlayerId;
    this._humanPlayer = deps.humanPlayer;
    this._iaPlayer = deps.iaPlayer;
    this._adRewardService = deps.adRewardService ?? null;
    this._multiplayer = deps.multiplayer ?? null;
    this._cardNames = this._buildCardNames();
    this._cardPowers = this._buildCardPowers();
    this._cardImages = this._buildCardImages();
    this._vm = this._buildInitialViewModel();
  }

  get viewModel(): PenaltyViewModel {
    return this._vm;
  }

  onStateChange(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== cb);
    };
  }

  selectSide(side: Side): void {
    if (this._vm.phase !== "selecting") return;
    this._vm = {
      ...this._vm,
      selection: { ...this._vm.selection, side },
      canConfirm: side !== null && this._vm.selection.passive !== null,
    };
    this._emit();
  }

  selectPassive(card: PassiveCard): void {
    if (this._vm.phase !== "selecting") return;
    if (!card.canPlay()) return;
    this._vm = {
      ...this._vm,
      selection: { ...this._vm.selection, passive: card },
      canConfirm: this._vm.selection.side !== null && card !== null,
    };
    this._emit();
  }

  selectActive(card: ActiveCard | null): void {
    if (this._vm.phase !== "selecting") return;
    if (card !== null && !card.canActivate()) return;
    const next =
      card !== null && this._vm.selection.active === card ? null : card;
    this._vm = {
      ...this._vm,
      selection: { ...this._vm.selection, active: next },
    };
    this._emit();
  }

  equipPowerUp(card: PowerUpCard, target: PassiveCard): void {
    if (!card.canEquip()) throw new Error("PowerUp already used");
    if (this._vm.phase !== "selecting") return;
    card.equipTo(target);
    this._vm = {
      ...this._vm,
      selection: { ...this._vm.selection, equippedPowerUp: card },
    };
    this._emit();
  }

  confirm(): void {
    if (this._vm.phase === "game-over" || this._vm.phase === "draw")
      throw new Error("Match is over");
    // Multiplayer only: single-player always resolves synchronously within
    // this call, so phase can never still be "resolving" on re-entry. In
    // multiplayer there's a real async gap (network round trip) — without
    // this guard a re-entrant confirm() would re-stage and, on the guest,
    // send a duplicate "decision" message over the wire.
    if (this._vm.phase === "resolving")
      throw new Error("Cannot confirm: already resolving a turn");
    if (!this._vm.canConfirm)
      throw new Error("Cannot confirm: side or passive not selected");

    // Transition to resolving
    this._vm = { ...this._vm, phase: "resolving" };
    this._emit();

    // Wire human player decisions
    this._humanPlayer.setPendingSide(this._vm.selection.side!);
    this._humanPlayer.setPendingSelection(this._vm.selection.passive!);
    this._humanPlayer.setPendingActive(this._vm.selection.active ?? null);

    if (this._multiplayer === null) {
      // Single-player: resolve immediately, same as before.
      this._shootout.advance();
      this._afterResolution();
      return;
    }

    if (this._multiplayer.role === "guest") {
      // Guest never resolves locally — RNG must run once, host-side only.
      // Stage the decision on the wire and wait for the host's outcome.
      const payload: RemoteDecisionPayload = {
        chosenCardId: this._vm.selection.passive!.id,
        activeCardId: this._vm.selection.active?.id ?? null,
        side: this._vm.selection.side!,
      };
      this._multiplayer.send({ type: "decision", payload });
      return;
    }

    // Host: resolve only once both the local human's decision and the
    // guest's decision (staged via receiveRemoteDecision) are ready.
    this._localDecisionStaged = true;
    if (!this._remoteDecisionStaged) return;

    this._shootout.advance();
    this._afterResolution();
    this._multiplayer.send({
      type: "outcome",
      payload: this._shootout.lastOutcome!,
    });
    this._localDecisionStaged = false;
    this._remoteDecisionStaged = false;
  }

  // REQ-MULTIPLAYER-PRESENTER-HOST-DECISION: called when the guest's decision
  // arrives over the wire. Applies it to the RemotePlayer standing in for the
  // guest, then resolves the turn if the local human's decision is already
  // staged (see confirm()'s host branch).
  receiveRemoteDecision(payload: RemoteDecisionPayload): void {
    if (!this._multiplayer || this._multiplayer.role !== "host") {
      throw new Error("receiveRemoteDecision is only valid for the host role");
    }
    // Only RemotePlayer exposes the setPendingX buffer RemoteDecisionAdapter
    // stages onto — guard explicitly instead of an unchecked cast (matches
    // the `instanceof` guidance left on MatchBuild.iaPlayer in MatchFactory.ts)
    // so a misconfigured `role: "host"` presenter fails with a clear error
    // instead of an opaque "setPendingSelection is not a function".
    if (!(this._iaPlayer instanceof RemotePlayer)) {
      throw new Error(
        "receiveRemoteDecision requires a RemotePlayer iaPlayer",
      );
    }
    const cards: PlayerCards = {
      shootCards: this._iaPlayer.striker.shootCards,
      saveCards: this._iaPlayer.goalkeeper.saveCards,
    };
    RemoteDecisionAdapter.apply(payload, cards, this._iaPlayer);
    this._remoteDecisionStaged = true;
    if (!this._localDecisionStaged) return;

    this._shootout.advance();
    this._afterResolution();
    this._multiplayer.send({
      type: "outcome",
      payload: this._shootout.lastOutcome!,
    });
    this._localDecisionStaged = false;
    this._remoteDecisionStaged = false;
  }

  // REQ-MULTIPLAYER-PRESENTER-GUEST-OUTCOME: called when the host's resolved
  // outcome arrives over the wire. Applies it to the guest's local shootout
  // (no advance()/resolver — RNG already ran host-side) and refreshes the vm.
  receiveRemoteOutcome(outcome: ResolutionOutcome): void {
    if (!this._multiplayer || this._multiplayer.role !== "guest") {
      throw new Error("receiveRemoteOutcome is only valid for the guest role");
    }
    this._shootout.applyRemoteOutcome(outcome);
    this._afterResolution();
  }

  acknowledgeReveal(): void {
    if (this._vm.phase !== "revealing") return;
    this._vm = { ...this._vm, phase: this._pendingPostRevealPhase };
    this._emit();
  }

  advanceTurn(): void {
    if (this._vm.phase !== "showing-result") return;

    const state = this._shootout.state;

    // After regular turns, state will have shooterId; after GameOver it won't
    // but we only call advanceTurn when phase === "showing-result", not "game-over"
    const shooterId =
      "shooterId" in state ? state.shooterId : this._humanPlayerId;
    const humanRole: "striker" | "goalkeeper" =
      shooterId === this._humanPlayerId ? "striker" : "goalkeeper";
    const humanHand = this._computeHand(humanRole);

    this._vm = {
      ...this._vm,
      humanRole,
      humanHand,
      selection: {
        side: null,
        passive: null,
        active: null,
        equippedPowerUp: null,
      },
      phase: "selecting",
      canConfirm: false,
      score: { ...this._vm.score, round: this._vm.score.round + 1 },
    };
    this._emit();
  }

  canUseAdReward(): boolean {
    return this._adRewardService?.canUse() ?? false;
  }

  adRewardUsesLeft(): number {
    return this._adRewardService?.usesLeft() ?? 0;
  }

  async watchAdForPassive(card: PassiveCard): Promise<void> {
    if (!this._adRewardService) return;
    const result = await this._adRewardService.requestReward();
    if (result === "granted") {
      card.rewindCooldown(card.cooldown);
      this._emit();
    }
  }

  async watchAdForActive(card: ActiveCard): Promise<void> {
    if (!this._adRewardService) return;
    const result = await this._adRewardService.requestReward();
    if (result === "granted") {
      card.reset();
      this._emit();
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  // Shared by confirm() (single-player and host, once resolved) and
  // receiveRemoteOutcome() (guest): reads the just-resolved outcome/state off
  // the shootout and updates the vm into "revealing".
  private _afterResolution(): void {
    const outcome = this._shootout.lastOutcome;
    const state = this._shootout.state;

    // Design invariant: human is always playerA (first arg to PenaltyShootout constructor)
    // so humanGoals = shootout.score.playerA
    const humanGoals = this._shootout.score.playerA;
    const aiGoals = this._shootout.score.playerB;

    this._pendingPostRevealPhase =
      state.phase === "GameOver"
        ? state.winner === null
          ? "draw"
          : "game-over"
        : "showing-result";

    this._vm = {
      ...this._vm,
      phase: "revealing",
      shootoutPhase: this._shootout.shootoutPhase,
      lastOutcome: outcome,
      score: { ...this._vm.score, humanGoals, aiGoals },
      canConfirm: false,
    };
    this._emit();
  }

  private _buildInitialViewModel(): PenaltyViewModel {
    const state = this._shootout.state;
    // Initial state is always WaitingForDecisions with shooterId
    const shooterId =
      "shooterId" in state ? state.shooterId : this._humanPlayerId;
    const humanRole: "striker" | "goalkeeper" =
      shooterId === this._humanPlayerId ? "striker" : "goalkeeper";
    const humanHand = this._computeHand(humanRole);

    return {
      humanRole,
      humanHand,
      selection: {
        side: null,
        passive: null,
        active: null,
        equippedPowerUp: null,
      },
      score: { humanGoals: 0, aiGoals: 0, round: 1 },
      phase: "selecting",
      shootoutPhase: this._shootout.shootoutPhase,
      lastOutcome: null,
      canConfirm: false,
      cardNames: this._cardNames,
      cardPowers: this._cardPowers,
      cardImages: this._cardImages,
    };
  }

  private _computeHand(
    role: "striker" | "goalkeeper",
  ): PenaltyViewModel["humanHand"] {
    if (role === "striker") {
      return {
        passives: this._humanPlayer.striker.shootCards,
        actives: this._humanPlayer.striker.activeCards,
        powerUps: this._humanPlayer.striker.powerUps,
      };
    } else {
      return {
        passives: this._humanPlayer.goalkeeper.saveCards,
        actives: this._humanPlayer.goalkeeper.activeCards,
        powerUps: this._humanPlayer.goalkeeper.powerUps,
      };
    }
  }

  private _buildCardPowers(): ReadonlyMap<number, number> {
    const map = new Map<number, number>();
    const collect = (cards: ReadonlyArray<PassiveCard>) => {
      cards.forEach((c) => map.set(c.id, c.power));
    };
    collect(this._humanPlayer.striker.shootCards);
    collect(this._humanPlayer.goalkeeper.saveCards);
    collect(this._iaPlayer.striker.shootCards);
    collect(this._iaPlayer.goalkeeper.saveCards);
    return map;
  }

  private _buildCardNames(): ReadonlyMap<number, string> {
    const map = new Map<number, string>();
    const collect = (cards: ReadonlyArray<Card>) => {
      cards.forEach((c) => map.set(c.id, c.name));
    };
    collect(this._humanPlayer.striker.shootCards);
    collect(this._humanPlayer.striker.activeCards);
    collect(this._humanPlayer.striker.powerUps);
    collect(this._humanPlayer.goalkeeper.saveCards);
    collect(this._humanPlayer.goalkeeper.activeCards);
    collect(this._humanPlayer.goalkeeper.powerUps);
    collect(this._iaPlayer.striker.shootCards);
    collect(this._iaPlayer.striker.activeCards);
    collect(this._iaPlayer.striker.powerUps);
    collect(this._iaPlayer.goalkeeper.saveCards);
    collect(this._iaPlayer.goalkeeper.activeCards);
    collect(this._iaPlayer.goalkeeper.powerUps);
    return map;
  }

  // id -> artwork URL for every card both players own. The duel panel only
  // knows card IDs (from the resolution evidence), so it resolves art here.
  private _buildCardImages(): ReadonlyMap<number, string> {
    const map = new Map<number, string>();
    const collect = (cards: ReadonlyArray<Card>) => {
      cards.forEach((c) => {
        const url = cardArtUrl(c);
        if (url) map.set(c.id, url);
      });
    };
    collect(this._humanPlayer.striker.shootCards);
    collect(this._humanPlayer.striker.activeCards);
    collect(this._humanPlayer.goalkeeper.saveCards);
    collect(this._humanPlayer.goalkeeper.activeCards);
    collect(this._iaPlayer.striker.shootCards);
    collect(this._iaPlayer.striker.activeCards);
    collect(this._iaPlayer.goalkeeper.saveCards);
    collect(this._iaPlayer.goalkeeper.activeCards);
    return map;
  }

  private _emit(): void {
    this._listeners.forEach((l) => l());
  }
}
