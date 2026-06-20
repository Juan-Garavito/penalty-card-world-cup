import { ActiveCard } from "./ActiveCard.ts";
import { Tier, TIER_STATS } from "../Tier.ts";

// REQ-INTIMIDATE-DUAL, NF-LINT-001 — exported only from this file
export const INTIMIDATE_MISMATCH_PENALTY = 10;

export class IntimidateCard extends ActiveCard {
  constructor(id: number, name: string, description: string, imageUrl: string) {
    super(id, name, description, imageUrl);
  }

  // Returns the miss chance the rival faces — pure query, no state mutation
  missChanceVs(rivalTier: Tier): number {
    return TIER_STATS[rivalTier].counterChance;
  }

  // Returns the reduced miss chance when firing on a side-mismatch — pure query, no state mutation
  lowMissChanceVs(rivalTier: Tier): number {
    return Math.max(
      0,
      this.missChanceVs(rivalTier) - INTIMIDATE_MISMATCH_PENALTY,
    );
  }
}
