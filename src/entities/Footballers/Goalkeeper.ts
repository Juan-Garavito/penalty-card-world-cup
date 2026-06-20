import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";

type GoalkeeperActive = IntimidateCard | NullifyCard;

export class Goalkeeper {
  constructor(
    public readonly saveCards: SaveCard[],
    public readonly activeCards: GoalkeeperActive[],
    public readonly powerUps: PowerUpCard[] = [],
  ) {}
}
