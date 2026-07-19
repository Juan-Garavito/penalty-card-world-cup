import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { Striker } from "../Footballers/Striker.ts";
import { IPlayer } from "./IPlayer.ts";
import { TurnContext } from "./TurnContext.ts";
import { PlayerDecision } from "./PlayerDecision.ts";
import { PassiveCard } from "../Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../Cards/active/ActiveCard.ts";
import { MissingSelectionError } from "./errors/MissingSelectionError.ts";
import { MissingSideError } from "./errors/MissingSideError.ts";
import { Side } from "./Side.ts";

// REQ-REMOTE-PLAYER-001: RemotePlayer implements IPlayer using the same
// buffer pattern as HumanPlayer — the remote peer's decision is buffered
// (via setPendingX) when it arrives over the network, then consumed by
// decide() when the shootout is ready to resolve the turn.
export class RemotePlayer implements IPlayer {
  readonly id: string;
  readonly goalkeeper: Goalkeeper;
  readonly striker: Striker;

  private pendingSelection: PassiveCard | null = null;
  private pendingActive: ActiveCard | null = null;
  private pendingSide: Side | null = null;

  constructor(id: string, goalkeeper: Goalkeeper, striker: Striker) {
    this.id = id;
    this.goalkeeper = goalkeeper;
    this.striker = striker;
  }

  setPendingSelection(card: PassiveCard): void {
    this.pendingSelection = card;
  }

  setPendingActive(card: ActiveCard | null): void {
    this.pendingActive = card;
  }

  setPendingSide(side: Side | null): void {
    this.pendingSide = side;
  }

  decide(_context: TurnContext): PlayerDecision {
    if (this.pendingSelection === null) {
      throw new MissingSelectionError();
    }
    if (this.pendingSide === null) {
      throw new MissingSideError();
    }
    const chosen = this.pendingSelection;
    const active = this.pendingActive;
    const side = this.pendingSide;
    this.pendingSelection = null;
    this.pendingActive = null;
    this.pendingSide = null;
    return { chosenCard: chosen, activePlayed: active ?? undefined, side };
  }

  resetForNewMatch(): void {
    this.striker.activeCards.forEach((c) => c.reset());
    this.goalkeeper.activeCards.forEach((c) => c.reset());
    this.pendingSelection = null;
    this.pendingActive = null;
    this.pendingSide = null;
  }
}
