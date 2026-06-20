import { IPlayer } from "../Players/IPlayer.ts";
import { PlayerCards } from "./PlayerCards.ts";
import { MatchState } from "./MatchState.ts";
import { TurnOutcome } from "./TurnOutcome.ts";
import { MatchAlreadyOverError } from "./errors/MatchAlreadyOverError.ts";
import { InvalidTransitionError } from "./errors/InvalidTransitionError.ts";
import { PassiveCard } from "../Cards/passive/PassiveCard.ts";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { MathRandomRng } from "./MathRandomRng.ts";
import { ResolutionOutcome } from "./ResolutionOutcome.ts";
import { TurnContext } from "../Players/TurnContext.ts";

export class PenaltyShootout {
  private _state: MatchState;
  private _score: { playerA: number; playerB: number };
  private _turnNumber: number;
  private _lastOutcome: ResolutionOutcome | null = null;

  private readonly playerA: IPlayer;
  private readonly playerB: IPlayer;
  private readonly playerACards: PlayerCards;
  private readonly playerBCards: PlayerCards;
  private readonly resolver: PenaltyResolver;
  private readonly context: "group" | "knockout";

  // Per-player remaining kicks in the current phase (5 each, decremented each turn)
  // Reused for Phase 2 — reset to 5 when Phase 2 begins.
  private playerAKicksLeft: number = 5;
  private playerBKicksLeft: number = 5;

  // Whether we are currently in SuddenDeath mode (persists across ResolvingShot)
  private inSuddenDeath: boolean = false;
  // Whether we are currently in Phase 2 (second 5-kick series before Sudden Death)
  private inPhase2: boolean = false;
  // The current sdRound (1-based), only relevant when inSuddenDeath = true
  private currentSdRound: number = 1;
  // Tracks kicks within current SD pair (0 = first kick of pair, 1 = second kick)
  private sdKicksThisRound: number = 0;
  // Whether the first kicker of the current SD pair scored
  private sdFirstKickerScored: boolean = false;

  constructor(
    playerA: IPlayer,
    playerB: IPlayer,
    playerACards: PlayerCards,
    playerBCards: PlayerCards,
    options?: { resolver?: PenaltyResolver; context?: "group" | "knockout" },
  ) {
    this.playerA = playerA;
    this.playerB = playerB;
    this.playerACards = playerACards;
    this.playerBCards = playerBCards;
    // REQ-INTEGRATION-001, Decision 5: optional resolver with default
    this.resolver =
      options?.resolver ?? new PenaltyResolver(new MathRandomRng());
    // REQ-FORMAT-005: context defaults to "knockout" so all existing code unchanged
    this.context = options?.context ?? "knockout";

    this._score = { playerA: 0, playerB: 0 };
    this._turnNumber = 1;
    this._state = {
      phase: "WaitingForDecisions",
      shooterId: playerA.id,
      goalkeeperId: playerB.id,
    };
  }

  get state(): MatchState {
    return this._state;
  }

  get score(): { readonly playerA: number; readonly playerB: number } {
    return this._score;
  }

  get turnNumber(): number {
    return this._turnNumber;
  }

  // REQ-INTEGRATION-003: expose last ResolutionOutcome for UI consumption
  get lastOutcome(): ResolutionOutcome | null {
    return this._lastOutcome;
  }

  // REQ-FORMAT-007: expose current phase of the shootout for UI consumption
  get shootoutPhase(): 1 | 2 | "sd" {
    if (this.inSuddenDeath) return "sd";
    if (this.inPhase2) return 2;
    return 1;
  }

  advance(): void {
    if (this._state.phase === "GameOver") {
      throw new MatchAlreadyOverError();
    }

    const shooterId = (this._state as { shooterId: string }).shooterId;
    const goalkeeperId = (this._state as { goalkeeperId: string }).goalkeeperId;

    // REQ-INTEGRATION-002: identify shooter and goalkeeper players
    const shooterPlayer =
      this.playerA.id === shooterId ? this.playerA : this.playerB;
    const goalkeeperPlayer =
      this.playerA.id === goalkeeperId ? this.playerA : this.playerB;

    // Identify card sets for each role
    // Shooter gets shootCards, goalkeeper gets saveCards (per design)
    const shooterCards =
      this.playerA.id === shooterId
        ? this.playerACards.shootCards
        : this.playerBCards.shootCards;
    const goalkeeperCards =
      this.playerA.id === goalkeeperId
        ? this.playerACards.saveCards
        : this.playerBCards.saveCards;

    // Build TurnContext for each player
    const shooterCtx: TurnContext = {
      turnNumber: this._turnNumber,
      role: "shooter",
      availableCards: shooterCards,
    };
    const goalkeeperCtx: TurnContext = {
      turnNumber: this._turnNumber,
      role: "goalkeeper",
      availableCards: goalkeeperCards,
    };

    // REQ-INTEGRATION-002: collect decisions — striker first, then goalkeeper
    const strikerDecision = shooterPlayer.decide(shooterCtx);
    const goalkeeperDecision = goalkeeperPlayer.decide(goalkeeperCtx);

    // Call tickShot on all passive cards of both players (existing behavior)
    this.allPassiveCards().forEach((card) => card.tickShot());

    // Transition to ResolvingShot
    this._state = {
      phase: "ResolvingShot",
      shooterId,
      goalkeeperId,
    };

    // REQ-INTEGRATION-002: resolve the shot
    const outcome = this.resolver.resolve(strikerDecision, goalkeeperDecision);

    // REQ-INTEGRATION-003: store last outcome for UI
    this._lastOutcome = outcome;

    // REQ-INTEGRATION-002: complete the turn internally
    this.submitTurnOutcome({ goal: outcome.goal });
  }

  submitTurnOutcome(outcome: TurnOutcome): void {
    if (this._state.phase === "GameOver") {
      throw new MatchAlreadyOverError();
    }
    if (this._state.phase === "WaitingForDecisions") {
      throw new InvalidTransitionError(this._state.phase, "submitTurnOutcome");
    }

    const shooterId = (this._state as { shooterId: string }).shooterId;
    const goalkeeperId = (this._state as { goalkeeperId: string }).goalkeeperId;

    // Update score if goal
    if (outcome.goal) {
      if (shooterId === this.playerA.id) {
        this._score = { ...this._score, playerA: this._score.playerA + 1 };
      } else {
        this._score = { ...this._score, playerB: this._score.playerB + 1 };
      }
    }

    // Call resetTurn on all passive cards
    this.allPassiveCards().forEach((card) => card.resetTurn());

    this._turnNumber++;

    // Determine next state based on whether we are in SuddenDeath mode
    if (this.inSuddenDeath) {
      this.processSuddenDeathKick(outcome, shooterId, goalkeeperId);
    } else {
      this.processRegularKick(shooterId, goalkeeperId);
    }
  }

  private processRegularKick(shooterId: string, goalkeeperId: string): void {
    // Decrement kicks for current shooter
    if (shooterId === this.playerA.id) {
      this.playerAKicksLeft--;
    } else {
      this.playerBKicksLeft--;
    }

    if (!this.inPhase2) {
      // ── Phase 1: mathematical early-win + turn-10 boundary ───────────────
      const earlyWinner = this.detectEarlyWin();
      if (earlyWinner !== null) {
        this._state = { phase: "GameOver", winner: earlyWinner };
        return;
      }

      if (this._turnNumber - 1 >= 10) {
        const { playerA: scoreA, playerB: scoreB } = this._score;
        if (scoreA > scoreB) {
          this._state = { phase: "GameOver", winner: this.playerA.id };
        } else if (scoreB > scoreA) {
          this._state = { phase: "GameOver", winner: this.playerB.id };
        } else {
          // Phase 1 tied — enter Phase 2
          this.inPhase2 = true;
          this.playerAKicksLeft = 5;
          this.playerBKicksLeft = 5;
          this._state = {
            phase: "WaitingForDecisions",
            shooterId: goalkeeperId,
            goalkeeperId: shooterId,
          };
          return;
        }
        return;
      }
    } else {
      // ── Phase 2: pair-based check (after every complete pair) ────────────
      // A pair is complete when both players have kicked the same number of
      // times, i.e. playerAKicksLeft === playerBKicksLeft (they start equal
      // at 5 and are decremented alternately, so equality means both just
      // finished the same number of Phase-2 kicks).
      if (this.playerAKicksLeft === this.playerBKicksLeft) {
        const { playerA: scoreA, playerB: scoreB } = this._score;
        if (scoreA > scoreB) {
          this._state = { phase: "GameOver", winner: this.playerA.id };
          return;
        } else if (scoreB > scoreA) {
          this._state = { phase: "GameOver", winner: this.playerB.id };
          return;
        }
        // Tied after this pair
        if (this.playerAKicksLeft === 0) {
          // All 5 pairs exhausted and still tied
          if (this.context === "group") {
            this._state = { phase: "GameOver", winner: null };
          } else {
            this.inSuddenDeath = true;
            this.currentSdRound = 1;
            this.sdKicksThisRound = 0;
            this.sdFirstKickerScored = false;
            this._state = {
              phase: "SuddenDeath",
              shooterId: goalkeeperId,
              goalkeeperId: shooterId,
              sdRound: 1,
            };
          }
          return;
        }
        // Pairs remain — continue Phase 2
      }
    }

    // Continue with swapped roles
    this._state = {
      phase: "WaitingForDecisions",
      shooterId: goalkeeperId,
      goalkeeperId: shooterId,
    };
  }

  private processSuddenDeathKick(
    outcome: TurnOutcome,
    shooterId: string,
    goalkeeperId: string,
  ): void {
    if (this.sdKicksThisRound === 0) {
      // First kick of the SD pair — record result, move to second kicker
      this.sdFirstKickerScored = outcome.goal;
      this.sdKicksThisRound = 1;
      // Continue in SuddenDeath with swapped roles for second kick
      this._state = {
        phase: "SuddenDeath",
        shooterId: goalkeeperId,
        goalkeeperId: shooterId,
        sdRound: this.currentSdRound,
      };
    } else {
      // Second kick of the SD pair — evaluate result
      const secondKickerScored = outcome.goal;
      this.sdKicksThisRound = 0;

      if (this.sdFirstKickerScored && !secondKickerScored) {
        // First kicker wins: current shooter is 2nd kicker,
        // so 1st kicker was the current goalkeeper (from this kick's perspective)
        this.inSuddenDeath = false;
        this._state = {
          phase: "GameOver",
          winner: goalkeeperId,
        };
      } else if (!this.sdFirstKickerScored && secondKickerScored) {
        // Second kicker wins
        this.inSuddenDeath = false;
        this._state = {
          phase: "GameOver",
          winner: shooterId,
        };
      } else {
        // Both scored or both missed — continue SD, increment round, swap roles
        this.sdFirstKickerScored = false;
        this.currentSdRound++;
        this._state = {
          phase: "SuddenDeath",
          shooterId: goalkeeperId,
          goalkeeperId: shooterId,
          sdRound: this.currentSdRound,
        };
      }
    }
  }

  private detectEarlyWin(): string | null {
    const { playerA: scoreA, playerB: scoreB } = this._score;

    if (scoreA > scoreB) {
      const maxBFinal = scoreB + this.playerBKicksLeft;
      if (scoreA > maxBFinal) {
        return this.playerA.id;
      }
    } else if (scoreB > scoreA) {
      const maxAFinal = scoreA + this.playerAKicksLeft;
      if (scoreB > maxAFinal) {
        return this.playerB.id;
      }
    }
    return null;
  }

  private allPassiveCards(): PassiveCard[] {
    return [
      ...this.playerACards.shootCards,
      ...this.playerACards.saveCards,
      ...this.playerBCards.shootCards,
      ...this.playerBCards.saveCards,
    ];
  }
}
