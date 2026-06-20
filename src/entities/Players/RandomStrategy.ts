import { IAStrategy } from "./IAStrategy.ts";
import { TurnContext } from "./TurnContext.ts";
import { PassiveCard } from "../Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { EmptyCardPoolError } from "./errors/EmptyCardPoolError.ts";
import { Side } from "./Side.ts";

export class RandomStrategy implements IAStrategy {
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  pick(context: TurnContext): PassiveCard {
    const { availableCards } = context;
    if (availableCards.length === 0) {
      throw new EmptyCardPoolError();
    }
    const index = Math.floor(this.rng() * availableCards.length);
    return availableCards[index];
  }

  pickActive(
    _role: "shooter" | "goalkeeper",
    candidatePool: ActiveCard[],
  ): ActiveCard | undefined {
    if (candidatePool.length === 0) {
      return undefined;
    }
    // Skip decision: rng < 0.5 → skip (no active played)
    if (this.rng() < 0.5) {
      return undefined;
    }
    // Index pick: uniform selection from pool
    const index = Math.floor(this.rng() * candidatePool.length);
    return candidatePool[index];
  }

  // SCEN-RANDOM-SIDE-MAPPING, SCEN-RANDOM-SIDE-DETERMINISTIC
  // _role is intentionally unused in v1 (uniform distribution regardless of role)
  pickSide(_role: "shooter" | "goalkeeper"): Side {
    const index = Math.floor(this.rng() * 3);
    return (["left", "center", "right"] as const)[index]!;
  }
}
