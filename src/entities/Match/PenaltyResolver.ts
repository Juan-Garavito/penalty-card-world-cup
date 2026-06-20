import { IRng } from "./IRng.ts";
import { ResolutionOutcome, ResolutionEvidence } from "./ResolutionOutcome.ts";
import { PlayerDecision } from "../Players/PlayerDecision.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";

// REQ-RESOLVER-001, REQ-RESOLVER-002
export class PenaltyResolver {
  constructor(private readonly rng: IRng) {}

  resolve(
    strikerDecision: PlayerDecision,
    goalkeeperDecision: PlayerDecision,
  ): ResolutionOutcome {
    // Both passives are "played" this turn regardless of which branch runs.
    // play() arms the cooldown timer (no-op for Normal tier).
    strikerDecision.chosenCard.play();
    goalkeeperDecision.chosenCard.play();

    // ── STEP 0: Side check ────────────────────────────────────────────────────
    const kickSide = strikerDecision.side;
    const diveSide = goalkeeperDecision.side;

    if (kickSide !== diveSide) {
      const gkPlayed = goalkeeperDecision.activePlayed;
      const stPlayed = strikerDecision.activePlayed;

      // ── SUB-BRANCH: Intimidate mismatch check ────────────────────────────────
      const gkIsIntimidate =
        gkPlayed instanceof IntimidateCard && gkPlayed.canActivate();

      if (gkIsIntimidate) {
        // Branch D: Nullify-cancels-Intimidate
        const stIsNullify =
          stPlayed instanceof NullifyCard && stPlayed.canActivate();

        if (stIsNullify) {
          // Both consumed without effect — neither rolls dice
          gkPlayed.markUsed();
          stPlayed.markUsed();
          const consumedOnMiss = [
            { cardId: gkPlayed.id, by: "goalkeeper" as const },
            { cardId: stPlayed.id, by: "striker" as const },
          ];
          return {
            goal: true,
            evidence: {
              kickSide,
              diveSide,
              sidesMatched: false,
              directGoal: true,
              strikerPassiveId: strikerDecision.chosenCard.id,
              goalkeeperPassiveId: goalkeeperDecision.chosenCard.id,
              activesFired: [],
              nullifiedActives: [],
              consumedOnMiss,
              finalPGoal: null,
              roll: null,
              strikerCurrentPower: null,
              goalkeeperCurrentPower: null,
            },
          };
        }

        // Branch E: immune-blocks-Intimidate
        if (strikerDecision.chosenCard.immuneToActives) {
          // Intimidate stays unused; if striker played a non-Nullify active, consume it
          const consumedOnMiss: Array<{
            cardId: number;
            by: "striker" | "goalkeeper";
          }> = [];
          if (stPlayed !== undefined && stPlayed.canActivate()) {
            stPlayed.markUsed();
            consumedOnMiss.push({ cardId: stPlayed.id, by: "striker" });
          }
          return {
            goal: true,
            evidence: {
              kickSide,
              diveSide,
              sidesMatched: false,
              directGoal: true,
              strikerPassiveId: strikerDecision.chosenCard.id,
              goalkeeperPassiveId: goalkeeperDecision.chosenCard.id,
              activesFired: [],
              nullifiedActives: [],
              consumedOnMiss,
              finalPGoal: null,
              roll: null,
              strikerCurrentPower: null,
              goalkeeperCurrentPower: null,
            },
          };
        }

        // Branch C: Intimidate fires — roll dice with lowMissChanceVs
        const lowChance = gkPlayed.lowMissChanceVs(
          strikerDecision.chosenCard.tier,
        );
        const threshold = lowChance / 100;
        const mismatchRoll = this.rng.next();
        const missed = mismatchRoll < threshold;
        gkPlayed.activate(); // effect fired → activate(), not markUsed()

        const mismatchActivesFired = [
          {
            cardId: gkPlayed.id,
            by: "goalkeeper" as const,
            effect: "intimidate-mismatch",
          },
        ];
        const consumedOnMiss: Array<{
          cardId: number;
          by: "striker" | "goalkeeper";
        }> = [];
        if (stPlayed !== undefined && stPlayed.canActivate()) {
          stPlayed.markUsed();
          consumedOnMiss.push({ cardId: stPlayed.id, by: "striker" });
        }

        return {
          goal: !missed,
          evidence: {
            kickSide,
            diveSide,
            sidesMatched: false,
            directGoal: false,
            strikerPassiveId: strikerDecision.chosenCard.id,
            goalkeeperPassiveId: goalkeeperDecision.chosenCard.id,
            activesFired: mismatchActivesFired,
            nullifiedActives: [],
            consumedOnMiss,
            finalPGoal: null,
            roll: null,
            strikerCurrentPower: null,
            goalkeeperCurrentPower: null,
            intimidateMismatchRoll: {
              threshold: lowChance,
              roll: mismatchRoll,
              missed,
            },
          },
        };
      }

      // Branch A: default mismatch — no Intimidate (or already-used Intimidate)
      const consumedOnMiss: Array<{
        cardId: number;
        by: "striker" | "goalkeeper";
      }> = [];

      if (stPlayed !== undefined && stPlayed.canActivate()) {
        stPlayed.markUsed();
        consumedOnMiss.push({
          cardId: stPlayed.id,
          by: "striker",
        });
      }

      if (gkPlayed !== undefined && gkPlayed.canActivate()) {
        gkPlayed.markUsed();
        consumedOnMiss.push({
          cardId: gkPlayed.id,
          by: "goalkeeper",
        });
      }

      return {
        goal: true,
        evidence: {
          kickSide,
          diveSide,
          sidesMatched: false,
          directGoal: true,
          strikerPassiveId: strikerDecision.chosenCard.id,
          goalkeeperPassiveId: goalkeeperDecision.chosenCard.id,
          activesFired: [],
          nullifiedActives: [],
          consumedOnMiss,
          finalPGoal: null,
          roll: null,
          strikerCurrentPower: null,
          goalkeeperCurrentPower: null,
        },
      };
    }

    const activesFired: Array<{
      cardId: number;
      by: "striker" | "goalkeeper";
      effect: string;
    }> = [];

    const nullifiedActives: Array<{
      cardId: number;
      by: "striker" | "goalkeeper";
    }> = [];

    // ── STEP 1: Nullify phase ─────────────────────────────────────────────────
    // REQ-RESOLVER-004 step 1, REQ-LIFECYCLE-004
    // Striker's NullifyCard targets goalkeeper's chosenCard
    if (
      strikerDecision.activePlayed instanceof NullifyCard &&
      strikerDecision.activePlayed.canActivate() &&
      !goalkeeperDecision.chosenCard.immuneToActives
    ) {
      strikerDecision.activePlayed.applyTo(goalkeeperDecision.chosenCard);
      strikerDecision.activePlayed.activate();
      activesFired.push({
        cardId: strikerDecision.activePlayed.id,
        by: "striker",
        effect: "nullify",
      });
      // Record goalkeeper's active as nullified (if any)
      if (goalkeeperDecision.activePlayed !== undefined) {
        nullifiedActives.push({
          cardId: goalkeeperDecision.activePlayed.id,
          by: "goalkeeper",
        });
      }
    }

    // Goalkeeper's NullifyCard targets striker's chosenCard
    if (
      goalkeeperDecision.activePlayed instanceof NullifyCard &&
      goalkeeperDecision.activePlayed.canActivate() &&
      !strikerDecision.chosenCard.immuneToActives
    ) {
      goalkeeperDecision.activePlayed.applyTo(strikerDecision.chosenCard);
      goalkeeperDecision.activePlayed.activate();
      activesFired.push({
        cardId: goalkeeperDecision.activePlayed.id,
        by: "goalkeeper",
        effect: "nullify",
      });
      // Record striker's active as nullified (if any)
      if (strikerDecision.activePlayed !== undefined) {
        nullifiedActives.push({
          cardId: strikerDecision.activePlayed.id,
          by: "striker",
        });
      }
    }

    // ── STEP 2: Intimidate phase ──────────────────────────────────────────────
    // REQ-RESOLVER-004 step 2, REQ-LIFECYCLE-001, REQ-LIFECYCLE-003
    let intimidateFired = false;
    let missChance = 0;
    if (
      goalkeeperDecision.activePlayed instanceof IntimidateCard &&
      goalkeeperDecision.activePlayed.canActivate() &&
      !strikerDecision.chosenCard.immuneToActives
    ) {
      missChance = goalkeeperDecision.activePlayed.missChanceVs(
        strikerDecision.chosenCard.tier,
      );
      goalkeeperDecision.activePlayed.activate();
      intimidateFired = true;
      activesFired.push({
        cardId: goalkeeperDecision.activePlayed.id,
        by: "goalkeeper",
        effect: "intimidate",
      });
    }

    // ── STEP 3: Cheating phase ────────────────────────────────────────────────
    // REQ-RESOLVER-004 step 3, REQ-LIFECYCLE-001, REQ-LIFECYCLE-002
    let cheatingFired = false;
    let goalChance = 0;
    if (
      strikerDecision.activePlayed instanceof CheatingCard &&
      strikerDecision.activePlayed.canActivate() &&
      !goalkeeperDecision.chosenCard.immuneToActives
    ) {
      goalChance = strikerDecision.activePlayed.goalChanceVs(
        goalkeeperDecision.chosenCard.tier,
      );
      strikerDecision.activePlayed.activate();
      cheatingFired = true;
      activesFired.push({
        cardId: strikerDecision.activePlayed.id,
        by: "striker",
        effect: "cheat",
      });
    }

    // ── STEP 4: Read power (post-Nullify) ─────────────────────────────────────
    const strikerCurrentPower = strikerDecision.chosenCard.getCurrentPower();
    const goalkeeperCurrentPower =
      goalkeeperDecision.chosenCard.getCurrentPower();

    // ── STEP 5-6: Resolve ──────────────────────────────────────────────────────
    // Base: striker wins only when their power strictly exceeds the goalkeeper's.
    // Active cards introduce randomness. When both fire simultaneously they cancel
    // and the deterministic base result applies instead.
    const baseGoal = strikerCurrentPower > goalkeeperCurrentPower;

    let goal: boolean;
    let finalPGoal: number | null = null;
    let roll: number | null = null;

    if (intimidateFired && cheatingFired) {
      // Both actives cancel — deterministic power comparison, no RNG
      goal = baseGoal;
    } else if (intimidateFired) {
      // Goalkeeper intimidates: miss chance driven by striker's card tier
      finalPGoal = 100 - missChance;
      roll = this.rng.next();
      goal = roll >= missChance / 100;
    } else if (cheatingFired) {
      // Striker cheats: goal chance driven by goalkeeper's card tier
      finalPGoal = goalChance;
      roll = this.rng.next();
      goal = roll < goalChance / 100;
    } else {
      // No actives — pure deterministic power comparison, no RNG
      goal = baseGoal;
    }

    // ── STEP 7: Build evidence ────────────────────────────────────────────────
    const evidence: ResolutionEvidence = {
      kickSide,
      diveSide,
      sidesMatched: true,
      directGoal: false,
      strikerPassiveId: strikerDecision.chosenCard.id,
      goalkeeperPassiveId: goalkeeperDecision.chosenCard.id,
      activesFired,
      nullifiedActives,
      consumedOnMiss: [],
      finalPGoal,
      roll,
      strikerCurrentPower,
      goalkeeperCurrentPower,
    };

    return { goal, evidence };
  }
}
