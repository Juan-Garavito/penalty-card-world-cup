// REQ-OUTCOME-001, REQ-OUTCOME-002, SCEN-EVIDENCE-MATCH, SCEN-EVIDENCE-MISMATCH
import { Side } from "../Players/Side.ts";

export interface ResolutionEvidence {
  /** Which side the striker aimed at */
  readonly kickSide: Side;
  /** Which side the goalkeeper dove to */
  readonly diveSide: Side;
  /** True when kickSide === diveSide; false means a direct goal (sides mismatch) */
  readonly sidesMatched: boolean;
  /** True when sides mismatch — goal awarded without running the power pipeline */
  readonly directGoal: boolean;
  /** Passive card id used by the striker */
  readonly strikerPassiveId: number;
  /** Passive card id used by the goalkeeper */
  readonly goalkeeperPassiveId: number;
  /** Active cards that fired during the power pipeline (Steps 1-3); empty on directGoal */
  readonly activesFired: ReadonlyArray<{
    readonly cardId: number;
    readonly by: "striker" | "goalkeeper";
    readonly effect: string;
  }>;
  /** Active cards cancelled by a NullifyCard (Steps 1-3 only); empty on directGoal */
  readonly nullifiedActives: ReadonlyArray<{
    readonly cardId: number;
    readonly by: "striker" | "goalkeeper";
  }>;
  /**
   * Active cards consumed (marked used) during side-mismatch Step 0.
   * Always present (empty array when sidesMatched=true).
   */
  readonly consumedOnMiss: ReadonlyArray<{
    readonly cardId: number;
    readonly by: "striker" | "goalkeeper";
  }>;
  /**
   * Goal probability (%) when an active card introduced randomness.
   * null when directGoal=true, when no active cards fired, or when both
   * Intimidate and CheatingCard fired and cancelled each other out.
   * When Intimidate fired alone: 100 - missChanceVs(strikerTier).
   * When CheatingCard fired alone: goalChanceVs(goalkeeperTier).
   */
  readonly finalPGoal: number | null;
  /**
   * Raw RNG roll value consumed when an active card introduced randomness.
   * null when directGoal=true, when no active cards fired on the match path,
   * or when both Intimidate and CheatingCard cancelled each other out.
   * null on mismatch path when intimidate-mismatch roll was used instead.
   * number in [0, 1) only when exactly one active (Intimidate or CheatingCard) fired.
   */
  readonly roll: number | null;
  /**
   * Striker's chosenCard.getCurrentPower() at STEP 4 — after Nullify and any
   * AdrenalineBoost. Used by the reveal UI to show power-level mechanics.
   * null on the side-mismatch path (formula was skipped).
   */
  readonly strikerCurrentPower: number | null;
  /**
   * Goalkeeper's chosenCard.getCurrentPower() at STEP 4 — after Nullify and any
   * AdrenalineBoost. Mirror of strikerCurrentPower.
   * null on the side-mismatch path.
   */
  readonly goalkeeperCurrentPower: number | null;
  /**
   * Present only when goalkeeper played IntimidateCard and it fired on a side-mismatch
   * (non-immune, non-Nullified, canActivate=true). Absent (undefined) in all other cases.
   * REQ-EVIDENCE-INTIMIDATE-MISMATCH
   * threshold: lowMissChanceVs() result (percentage integer, e.g. 60).
   * roll: the raw rng.next() value.
   * missed: true if roll < threshold / 100.
   */
  readonly intimidateMismatchRoll?: {
    readonly threshold: number;
    readonly roll: number;
    readonly missed: boolean;
  };
}

export interface ResolutionOutcome {
  readonly goal: boolean;
  readonly evidence: ResolutionEvidence;
}
