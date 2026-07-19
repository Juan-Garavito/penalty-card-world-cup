import { RemotePlayer } from "../entities/Players/RemotePlayer.ts";
import { PlayerCards } from "../entities/Match/PlayerCards.ts";
import { PassiveCard } from "../entities/Cards/passive/PassiveCard.ts";
import { ActiveCard } from "../entities/Cards/active/ActiveCard.ts";
import { Side } from "../entities/Players/Side.ts";
import { UnknownCardIdError } from "./errors/UnknownCardIdError.ts";

// REQ-MULTIPLAYER-DECISION-TRANSLATION: cards are stateful class instances,
// not serializable, so a remote peer's decision crosses the wire as numeric
// ids only. RemoteDecisionAdapter is pure translation logic: it reconstructs
// the id-referenced card instances against the LOCALLY-built catalog for that
// peer (produced once by MatchFactory.buildMultiplayer(), never sent over the
// wire itself) and buffers them on the target RemotePlayer. No network layer
// is wired in yet — the caller (future WS relay client) is responsible for
// producing this payload from an incoming `submit-decision` message.
export interface RemoteDecisionPayload {
  readonly chosenCardId: number;
  readonly activeCardId: number | null;
  readonly side: Side;
}

export class RemoteDecisionAdapter {
  // Resolves ids to instances BEFORE calling any setPendingX — an unknown id
  // throws and leaves the target's buffered state untouched (atomic apply,
  // no partial decision is ever staged on the RemotePlayer).
  static apply(
    payload: RemoteDecisionPayload,
    cards: PlayerCards,
    target: RemotePlayer,
  ): void {
    const chosen = RemoteDecisionAdapter._findChosen(
      payload.chosenCardId,
      cards,
    );
    const active = RemoteDecisionAdapter._findActive(
      payload.activeCardId,
      target,
    );

    target.setPendingSelection(chosen);
    target.setPendingActive(active);
    target.setPendingSide(payload.side);
  }

  private static _findChosen(
    chosenCardId: number,
    cards: PlayerCards,
  ): PassiveCard {
    const passiveCards: PassiveCard[] = [
      ...cards.shootCards,
      ...cards.saveCards,
    ];
    const found = passiveCards.find((c) => c.id === chosenCardId);
    if (!found) throw new UnknownCardIdError(chosenCardId);
    return found;
  }

  private static _findActive(
    activeCardId: number | null,
    target: RemotePlayer,
  ): ActiveCard | null {
    if (activeCardId === null) return null;
    const activeCards: ActiveCard[] = [
      ...target.striker.activeCards,
      ...target.goalkeeper.activeCards,
    ];
    const found = activeCards.find((c) => c.id === activeCardId);
    if (!found) throw new UnknownCardIdError(activeCardId);
    return found;
  }
}
