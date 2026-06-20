import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";

type StrikerActive = CheatingCard | NullifyCard;

export class Striker {
  constructor(
    public readonly shootCards: ShootCard[],
    public readonly activeCards: StrikerActive[],
    public readonly powerUps: PowerUpCard[] = [],
  ) {}
}
