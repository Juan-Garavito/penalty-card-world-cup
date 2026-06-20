import type { Filter, Graphics } from "pixi.js";
import { ColorMatrixFilter } from "pixi.js";
import type { ResolutionEvidence } from "../entities/Match/ResolutionOutcome.ts";
import type { Side } from "../entities/Players/Side.ts";
import { LayeredCharacter } from "./components/LayeredCharacter.ts";

// Absolute timeline checkpoints (ms from animation start). Tweakable.
export const ANIM_TIMING = {
  STRIKER_START: 0,
  STRIKER_DURATION: 1300, // 5 frames @ [100,300,300,300,300]
  KEEPER_PREPARE_START: 600,
  KEEPER_DIVE_START: 800,
  KEEPER_PREPARE_DURATION: 200, // frames 0->1
  KEEPER_DIVE_DURATION: 200, // frames 2->3 (only L/R)
  BALL_FLIGHT_START: 1300,
  BALL_FLIGHT_DURATION: 400,
  CARD_DUEL_DURATION: 1500,
  COIN_SPIN_DURATION: 1200, // total coin-flip animation duration (ms)
  COIN_FLIP_INTERVAL: 80,   // frame alternation interval during fast spin (ms)
  COIN_SPIN_SETTLE_MS: 400, // tail period showing final frame before end-beat
  CLASH_DURATION: 600,      // card-clash phase after coin lands (Intimidate only)
  END_BEAT_DURATION: 400,
  DARKEN_FADE_DURATION: 200, // fade-in for the post-kick darken overlay (direct-goal path)
};

export const KEEPER_DIVE_RADIANS = {
  left: Math.PI / 4,
  right: -Math.PI / 4,
  center: 0,
} as const;

interface BallPositions {
  start: { x: number; y: number };
  left: { x: number; y: number };
  center: { x: number; y: number };
  right: { x: number; y: number };
}

type CardRef = {
  x: number;
  y: number;
  alpha: number;
  scale: { set(s: number): void };
  filters: Filter | Filter[] | null;
} | null;

interface AnimationContext {
  striker: LayeredCharacter;
  goalkeeper: LayeredCharacter;
  ball: Graphics;
  ballPositions: BallPositions;
  strikerPos: { x: number; y: number };
  keeperPos: { x: number; y: number };
  cardDuelPanel: { visible: boolean };
  darkenOverlay: { visible: boolean; alpha: number };
  evidence: ResolutionEvidence;
  isGoal: boolean;
  /** Whether the human player is the striker on this kick (false = human is the goalkeeper). */
  humanIsStriker: boolean;
  onComplete: () => void;
  /** Coin sprite interface — null when the coin asset isn't loaded (e.g. tests). */
  coin: { visible: boolean; setFrame(f: 0 | 1): void } | null;
  /** Human player's card sprite for duel animation. Null when not available (e.g. tests). */
  humanCard: CardRef;
  /** Human player's active card badge sprite. Null when none fired or not available. */
  humanActiveCard: CardRef;
  /** AI player's card sprite for duel animation. Null when not available (e.g. tests). */
  aiCard: CardRef;
  /** AI player's active card badge sprite. Null when none fired or not available. */
  aiActiveCard: CardRef;
  /** Rest x position for the human card (center of left half). */
  humanCardRestX: number;
  /** Rest x position for the AI card (center of right half). */
  aiCardRestX: number;
  /** Human team kit color (for background tint). */
  humanColor: number;
  /** AI team kit color (for background tint). */
  aiColor: number;
  /** Called once when the ball is kicked — used to play the kick SFX. */
  onBallKick: (() => void) | null;
  /** Called once when the coin spin starts — used to hide the VS text. */
  onCoinStart: (() => void) | null;
  /** Called once when the coin spin ends — used to stop the coin SFX. */
  onCoinEnd: (() => void) | null;
  /** Called once when the card-duel panel becomes visible (who-wins-the-cards reveal). */
  onDuelStart: (() => void) | null;
  /** Called once when the winning card clashes — used to tint the duel background. */
  onClash: ((winnerIsHuman: boolean) => void) | null;
}

type Phase =
  | "striker-running"
  | "keeper-prepare"
  | "keeper-diving"
  | "ball-flying"
  | "card-duel"
  | "darken-cards"
  | "coin-spin"
  | "card-clash"
  | "end-beat"
  | "done";

export class PenaltyAnimation {
  private elapsedMs = 0;
  private phase: Phase = "striker-running";
  private completed = false;

  // Latches so we trigger sub-steps exactly once
  private startedStriker = false;
  private startedKeeperPrepare = false;
  private startedKeeperDive = false;
  private startedBallFlight = false;
  private startedDuel = false;
  private startedCoinSpin = false;

  // Timestamps for phase transitions
  private _coinPhaseStartMs = 0;
  private _endBeatStartMs = 0;
  private _darkenFadeStartMs = 0;

  // Card duel tween state
  private _greyApplied = false;
  private _clashStarted = false;
  private _clashStartMs = 0;
  private _winnerBaseScale = 1;
  private _loserBaseScale = 1;
  private _loserActiveOffsetX = 0;

  constructor(private readonly ctx: AnimationContext) {}

  /** Initialize sprite state and run frame 0 placement. Idempotent. */
  start(): void {
    const {
      striker,
      goalkeeper,
      ball,
      ballPositions,
      strikerPos,
      keeperPos,
      cardDuelPanel,
      darkenOverlay,
    } = this.ctx;
    striker.reset();
    goalkeeper.reset();
    striker.setFrame(0);
    goalkeeper.setFrame(0);
    striker.x = strikerPos.x;
    striker.y = strikerPos.y;
    goalkeeper.x = keeperPos.x;
    goalkeeper.y = keeperPos.y;
    // Restore positive x-scale in case previous dive mirrored the sprite.
    if (goalkeeper.scale) goalkeeper.scale.x = Math.abs(goalkeeper.scale.x);
    ball.x = ballPositions.start.x;
    ball.y = ballPositions.start.y;
    if (ball.zIndex !== undefined) ball.zIndex = 1; // reset: behind keeper
    cardDuelPanel.visible = false;
    darkenOverlay.visible = false;
    darkenOverlay.alpha = 1;
    if (this.ctx.coin) this.ctx.coin.visible = false;

    // Reset card duel tween state and card positions to off-screen starts
    this._greyApplied = false;
    this._clashStarted = false;
    this._clashStartMs = 0;
    this._winnerBaseScale = 1;
    this._loserBaseScale = 1;
    this._loserActiveOffsetX = 0;
    if (this.ctx.humanCard) {
      this.ctx.humanCard.x = this.ctx.humanCardRestX - 500;
      this.ctx.humanCard.alpha = 0;
      this.ctx.humanCard.filters = null;
    }
    if (this.ctx.aiCard) {
      this.ctx.aiCard.x = this.ctx.aiCardRestX + 500;
      this.ctx.aiCard.alpha = 0;
      this.ctx.aiCard.filters = null;
    }
  }

  tick(deltaMs: number): void {
    if (this.completed) return;
    this.elapsedMs += deltaMs;
    this.ctx.striker.tick(deltaMs);
    this.ctx.goalkeeper.tick(deltaMs);

    // Fade the post-kick darken overlay in smoothly instead of an instant pop
    if (this.ctx.darkenOverlay.visible && this.ctx.darkenOverlay.alpha < 1) {
      const fadeElapsed = this.elapsedMs - this._darkenFadeStartMs;
      this.ctx.darkenOverlay.alpha = Math.min(
        1,
        fadeElapsed / ANIM_TIMING.DARKEN_FADE_DURATION,
      );
    }

    // Position tweens — run every tick regardless of phase flags
    this._updateStrikerApproach();
    this._updateKeeperLateral();

    // 1. Striker animation (kicks off at t=0)
    if (!this.startedStriker && this.elapsedMs >= ANIM_TIMING.STRIKER_START) {
      this.startedStriker = true;
      this.ctx.striker.play([0, 1, 2, 3, 4], {
        fps: 1000 / 260, // matches ~260ms/frame avg
        loop: false,
      });
    }

    // 2. Keeper prepare (frames 0->1)
    if (
      !this.startedKeeperPrepare &&
      this.elapsedMs >= ANIM_TIMING.KEEPER_PREPARE_START
    ) {
      this.startedKeeperPrepare = true;
      this.ctx.goalkeeper.play([0, 1], {
        fps: 1000 / 100,
        loop: false,
      });
    }

    // 3. Keeper dive: rotate + jump to dive frame — triggered when ball launches
    // so the visual rotation coincides with the lateral movement, not before.
    if (
      !this.startedKeeperDive &&
      this.elapsedMs >= ANIM_TIMING.BALL_FLIGHT_START
    ) {
      this.startedKeeperDive = true;
      const diveSide = this.ctx.evidence.diveSide;
      if (diveSide !== "center") {
        // Frame 1 is the dive pose, facing left by default.
        // Mirror horizontally for right dives — no extra rotation needed
        // (rotation would appear inverted on a mirrored sprite).
        this.ctx.goalkeeper.setFrame(2);
        // Mirror (scale.x) handles facing direction; both sides use the same
        // positive rotation so the lean doesn't fight against the mirror flip.
        this.ctx.goalkeeper.setRotationRadians(
          diveSide === "left" ? -Math.PI / 4 : Math.PI / 4,
        );
        if (this.ctx.goalkeeper.scale) {
          this.ctx.goalkeeper.scale.x =
            diveSide === "left"
              ? -Math.abs(this.ctx.goalkeeper.scale.x)
              : Math.abs(this.ctx.goalkeeper.scale.x);
        }
      } else {
        this.ctx.goalkeeper.setFrame(3); // center: upright save frame
      }
    }

    // 4. Ball flight
    if (
      !this.startedBallFlight &&
      this.elapsedMs >= ANIM_TIMING.BALL_FLIGHT_START
    ) {
      this.startedBallFlight = true;
      this.phase = "ball-flying";
      this.ctx.onBallKick?.();
    }

    if (this.phase === "ball-flying") {
      this._updateBallPosition();
      if (
        this.elapsedMs >=
        ANIM_TIMING.BALL_FLIGHT_START + ANIM_TIMING.BALL_FLIGHT_DURATION
      ) {
        this._enterPostKickPhase();
      }
    }

    // Use fixed theoretical timestamps so single-tick jumps work correctly.
    const ballLandTime = ANIM_TIMING.BALL_FLIGHT_START + ANIM_TIMING.BALL_FLIGHT_DURATION;
    const duelEndTime = ballLandTime + ANIM_TIMING.CARD_DUEL_DURATION;

    if (this.phase === "card-duel") {
      const duelElapsed = this.elapsedMs - ballLandTime;
      this._tickCardDuel(duelElapsed);
      if (this.elapsedMs >= duelEndTime) {
        if (this._shouldShowCoin()) {
          this._coinPhaseStartMs = duelEndTime;
          this.phase = "coin-spin";
        } else {
          this._endBeatStartMs = duelEndTime;
          this.phase = "end-beat";
        }
      }
    } else if (this.phase === "darken-cards") {
      if (this.elapsedMs >= ballLandTime) {
        this._endBeatStartMs = ballLandTime;
        this.phase = "end-beat";
      }
    }

    if (this.phase === "coin-spin") {
      if (!this.startedCoinSpin) {
        this.startedCoinSpin = true;
        this.ctx.onCoinStart?.();
        if (this.ctx.coin) this.ctx.coin.visible = true;
      }
      const coinElapsed = this.elapsedMs - this._coinPhaseStartMs;
      const settleStart = ANIM_TIMING.COIN_SPIN_DURATION - ANIM_TIMING.COIN_SPIN_SETTLE_MS;
      if (coinElapsed >= ANIM_TIMING.COIN_SPIN_DURATION) {
        this.ctx.coin?.setFrame(this.ctx.isGoal ? 0 : 1);
        if (this.ctx.coin) this.ctx.coin.visible = false;
        this.ctx.onCoinEnd?.();
        const coinEndMs = this._coinPhaseStartMs + ANIM_TIMING.COIN_SPIN_DURATION;
        // For Intimidate: clash happens AFTER coin lands
        if (this._intimidateFired()) {
          this._clashStartMs = coinEndMs;
          this.phase = "card-clash";
        } else {
          this._endBeatStartMs = coinEndMs;
          this.phase = "end-beat";
        }
      } else if (coinElapsed < settleStart) {
        const frame = (Math.floor(coinElapsed / ANIM_TIMING.COIN_FLIP_INTERVAL) % 2) as 0 | 1;
        this.ctx.coin?.setFrame(frame);
      } else {
        this.ctx.coin?.setFrame(this.ctx.isGoal ? 0 : 1);
      }
    }

    if (this.phase === "card-clash") {
      const clashElapsed = this.elapsedMs - this._clashStartMs;
      this._doClash(clashElapsed);
      if (clashElapsed >= ANIM_TIMING.CLASH_DURATION) {
        this._endBeatStartMs = this._clashStartMs + ANIM_TIMING.CLASH_DURATION;
        this.phase = "end-beat";
      }
    }

    if (this.phase === "end-beat") {
      if (this.elapsedMs >= this._endBeatStartMs + ANIM_TIMING.END_BEAT_DURATION) {
        this.phase = "done";
        this.completed = true;
        this.ctx.onComplete();
      }
    }
  }

  private _enterPostKickPhase(): void {
    // Goal: ball lands behind keeper (blocked). Miss: ball flies in front.
    const ball = this.ctx.ball;
    if (ball.zIndex !== undefined) {
      ball.zIndex = this.ctx.isGoal ? 1 : 4;
    }

    // Show the card duel panel when sides matched OR when Intimidate fired
    // on a mismatch (making a normally-direct goal probabilistic instead).
    const showDuel =
      this.ctx.evidence.sidesMatched ||
      this.ctx.evidence.intimidateMismatchRoll !== undefined;

    if (showDuel) {
      this.startedDuel = true;
      this.ctx.cardDuelPanel.visible = true;
      this.ctx.onDuelStart?.();
      this.phase = "card-duel";
    } else {
      this.ctx.darkenOverlay.alpha = 0;
      this.ctx.darkenOverlay.visible = true;
      this._darkenFadeStartMs = this.elapsedMs;
      this.phase = "darken-cards";
    }
  }

  private _tickCardDuel(duelElapsed: number): void {
    const human = this.ctx.humanCard;
    const ai = this.ctx.aiCard;
    if (!human && !ai) return;

    const humanRestX = this.ctx.humanCardRestX;
    const aiRestX = this.ctx.aiCardRestX;
    const isIntimidate = this._intimidateFired();

    // Phase 0–500ms: slide-in (ease-out cubic), alpha 0→1 in first 200ms
    if (duelElapsed <= 500) {
      const slideT = easeOutCubic(Math.min(1, duelElapsed / 500));
      if (human) {
        human.x = humanRestX - 500 + 500 * slideT;
        human.alpha = Math.min(1, duelElapsed / 200);
      }
      if (ai) {
        ai.x = aiRestX + 500 - 500 * slideT;
        ai.alpha = Math.min(1, duelElapsed / 200);
      }
    }

    // Phase 500ms+: hold at rest — for Intimidate the coin spins and then
    // card-clash phase handles the actual clash after the coin lands.
    if (duelElapsed > 500) {
      if (human && duelElapsed <= 600) { human.x = humanRestX; human.alpha = 1; }
      if (ai && duelElapsed <= 600) { ai.x = aiRestX; ai.alpha = 1; }
    }

    // For non-Intimidate: clash starts at 600ms within card-duel
    if (!isIntimidate && duelElapsed > 600) {
      this._doClash(duelElapsed - 600);
    }
  }

  /** Runs the clash animation. elapsedMs=0 is the moment of impact. */
  private _doClash(elapsedMs: number): void {
    const human = this.ctx.humanCard;
    const ai = this.ctx.aiCard;
    if (!human && !ai) return;

    const humanRestX = this.ctx.humanCardRestX;
    const aiRestX = this.ctx.aiCardRestX;
    const isGoal = this.ctx.isGoal;
    // The duel "winner" is whichever side made the decisive play this kick:
    // the striker's card if it was a goal, the goalkeeper's card if it was
    // saved/missed — NOT simply "human" whenever isGoal is true. Human and AI
    // alternate striker/goalkeeper roles between kicks.
    const humanWins = isGoal === this.ctx.humanIsStriker;

    const winner = humanWins ? human : ai;
    const loser = humanWins ? ai : human;
    const loserActive = humanWins ? this.ctx.aiActiveCard : this.ctx.humanActiveCard;
    const winnerRestX = humanWins ? humanRestX : aiRestX;
    const loserRestX = humanWins ? aiRestX : humanRestX;
    const panelCenterX = (humanRestX + aiRestX) / 2;
    const punchDist = Math.abs(panelCenterX - winnerRestX);

    // Capture base scale + active card offset, fire onClash callback — once
    if (!this._clashStarted) {
      this._clashStarted = true;
      this._winnerBaseScale = winner?.scale.x ?? 1;
      this._loserBaseScale = loser?.scale.x ?? 1;
      this._loserActiveOffsetX = loserActive && loser
        ? loserActive.x - loser.x
        : 0;
      this.ctx.onClash?.(humanWins);
    }

    // Apply greyscale to loser (and its active badge) once
    if (!this._greyApplied && loser) {
      this._greyApplied = true;
      const grey = new ColorMatrixFilter();
      grey.greyscale(1, false);
      loser.filters = [grey];
      if (loserActive) loserActive.filters = [grey];
    }

    if (elapsedMs <= 400) {
      const t = easeOutCubic(Math.min(1, elapsedMs / 400));
      // Winner sits on the human side (left) iff humanWins, AI side (right) otherwise.
      // Winner punches toward the center; loser flies further away from it.
      const dir = humanWins ? 1 : -1;
      // Winner: punch to the center of the panel (where VS was)
      if (winner) {
        winner.x = winnerRestX + dir * punchDist * t;
        winner.scale.set(this._winnerBaseScale * (1 + 0.18 * t));
      }
      // Loser + its active badge: pushed 600px off screen, fades
      if (loser) {
        loser.x = loserRestX + dir * 600 * t;
        loser.scale.set(this._loserBaseScale);
        loser.alpha = Math.max(0, 1 - t * 1.2);
        if (loserActive) {
          loserActive.x = loser.x + this._loserActiveOffsetX;
          loserActive.alpha = loser.alpha;
        }
      }
    }
    // 400ms+: hold final state
  }

  private _intimidateFired(): boolean {
    return (
      this.ctx.evidence.intimidateMismatchRoll !== undefined ||
      this.ctx.evidence.activesFired.some((a) => a.effect.includes("intimidate"))
    );
  }

  private _shouldShowCoin(): boolean {
    return !!this.ctx.coin && this._intimidateFired();
  }

  private _updateBallPosition(): void {
    const t = Math.min(
      1,
      (this.elapsedMs - ANIM_TIMING.BALL_FLIGHT_START) /
        ANIM_TIMING.BALL_FLIGHT_DURATION,
    );
    const target = this._ballTargetForSide(this.ctx.evidence.kickSide);
    const start = this.ctx.ballPositions.start;
    this.ctx.ball.x = start.x + (target.x - start.x) * t;
    this.ctx.ball.y = start.y + (target.y - start.y) * t;
  }

  private _ballTargetForSide(side: Side): { x: number; y: number } {
    if (side === "left") return this.ctx.ballPositions.left;
    if (side === "right") return this.ctx.ballPositions.right;
    return this.ctx.ballPositions.center;
  }

  // Striker walks toward the ball during the run-up phase (0 → BALL_FLIGHT_START).
  // Stops just behind the ball so the kick feels impactful, not overlapping.
  private _updateStrikerApproach(): void {
    const { STRIKER_START, BALL_FLIGHT_START } = ANIM_TIMING;
    const duration = BALL_FLIGHT_START - STRIKER_START;
    const raw = (this.elapsedMs - STRIKER_START) / duration;
    const t = easeInCubic(Math.max(0, Math.min(1, raw)));
    const fromY = this.ctx.strikerPos.y;
    const toY = this.ctx.ballPositions.start.y - 40;
    this.ctx.striker.y = fromY + (toY - fromY) * t;
  }

  // Goalkeeper dives laterally based on its OWN decision (diveSide), independent
  // of where the ball goes. Ball direction is kickSide — these can differ.
  private _updateKeeperLateral(): void {
    const { BALL_FLIGHT_START, BALL_FLIGHT_DURATION } = ANIM_TIMING;
    // Lateral movement starts when the ball launches, not at dive-prepare time,
    // so the keeper reacts to the kick rather than anticipating it.
    const moveStart = BALL_FLIGHT_START;
    const duration = BALL_FLIGHT_DURATION + 300; // a little extra glide
    const raw = (this.elapsedMs - moveStart) / duration;
    const t = easeOutCubic(Math.max(0, Math.min(1, raw)));
    const target = this._ballTargetForSide(this.ctx.evidence.diveSide);
    const fromX = this.ctx.keeperPos.x;
    this.ctx.goalkeeper.x = fromX + (target.x - fromX) * t;
  }
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
