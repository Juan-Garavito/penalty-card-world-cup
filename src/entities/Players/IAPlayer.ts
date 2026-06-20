import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { Striker } from "../Footballers/Striker.ts";
import { IPlayer } from "./IPlayer.ts";
import { IAStrategy } from "./IAStrategy.ts";
import { TurnContext } from "./TurnContext.ts";
import { PlayerDecision } from "./PlayerDecision.ts";

export class IAPlayer implements IPlayer {
  readonly id: string;
  readonly goalkeeper: Goalkeeper;
  readonly striker: Striker;
  private readonly strategy: IAStrategy;

  constructor(
    id: string,
    goalkeeper: Goalkeeper,
    striker: Striker,
    strategy: IAStrategy,
  ) {
    this.id = id;
    this.goalkeeper = goalkeeper;
    this.striker = striker;
    this.strategy = strategy;
  }

  decide(context: TurnContext): PlayerDecision {
    const chosenCard = this.strategy.pick(context);

    const pool = (
      context.role === "shooter"
        ? this.striker.activeCards
        : this.goalkeeper.activeCards
    ).filter((c) => c.canActivate());

    const activePlayed = this.strategy.pickActive(context.role, pool);

    // SCEN-IAPLAYER-SIDE-WIRED: pickSide called after pickActive (appended last)
    const side = this.strategy.pickSide(context.role);

    return { chosenCard, activePlayed, side };
  }

  resetForNewMatch(): void {
    this.striker.activeCards.forEach((c) => c.reset());
    this.goalkeeper.activeCards.forEach((c) => c.reset());
  }
}
