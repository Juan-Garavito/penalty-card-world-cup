import { PenaltyShootout } from "./PenaltyShootout.ts";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { HumanPlayer } from "../Players/HumanPlayer.ts";
import { IAPlayer } from "../Players/IAPlayer.ts";
import { RandomStrategy } from "../Players/RandomStrategy.ts";
import { Striker } from "../Footballers/Striker.ts";
import { Goalkeeper } from "../Footballers/Goalkeeper.ts";
import { ShootCard } from "../Cards/passive/ShootCard.ts";
import { SaveCard } from "../Cards/passive/SaveCard.ts";
import { CheatingCard } from "../Cards/active/CheatingCard.ts";
import { NullifyCard } from "../Cards/active/NullifyCard.ts";
import { IntimidateCard } from "../Cards/active/IntimidateCard.ts";
import { AdrenalineBoost } from "../Cards/powerup/AdrenalineBoost.ts";
import { FocusPill } from "../Cards/powerup/FocusPill.ts";
import { TimeRewind } from "../Cards/powerup/TimeRewind.ts";
import type { PowerUpCard } from "../Cards/powerup/PowerUpCard.ts";

export interface MatchBuild {
  shootout: PenaltyShootout;
  humanPlayerId: string;
  humanPlayer: HumanPlayer;
  iaPlayer: IAPlayer;
}

export class MatchFactory {
  // REQ-FORMAT-005: context forwarded to PenaltyShootout
  // resolver param is for testing only (allows injecting a deterministic resolver)
  // playerPowerUps: when provided, those exact instances are used for human player (tournament persistence)
  static build(
    context?: "group" | "knockout",
    resolver?: PenaltyResolver,
    playerPowerUps?: PowerUpCard[],
  ): MatchBuild {
    // Human player — id "human-1"
    const humanShootCards = [
      new ShootCard(1, "Strike Normal", "A standard kick.", "", "Normal"),
      new ShootCard(2, "Strike Special", "A powerful kick.", "", "Special"),
      new ShootCard(3, "Strike Epic", "An unstoppable kick.", "", "Epic"),
    ];
    const humanSaveCards = [
      new SaveCard(4, "Save Normal", "A standard save.", "", "Normal"),
      new SaveCard(5, "Save Special", "A skilled save.", "", "Special"),
      new SaveCard(6, "Save Epic", "A legendary save.", "", "Epic"),
    ];
    const humanCheating = new CheatingCard(7, "Cheat", "Bends the rules.", "");
    const humanNullify1 = new NullifyCard(8, "Nullify", "Cancels a card.", "");
    const humanIntimidate = new IntimidateCard(
      9,
      "Intimidate",
      "Breaks focus.",
      "",
    );
    const humanNullify2 = new NullifyCard(
      10,
      "Nullify B",
      "Cancels a card.",
      "",
    );
    // Power-ups: player-level (same 3 cards available in both roles)
    const humanPowerUps: PowerUpCard[] = playerPowerUps ?? [
      new AdrenalineBoost(11, "Adrenaline", "Power boost.", ""),
      new FocusPill(12, "Focus", "Immune to actives.", ""),
      new TimeRewind(13, "Time Rewind", "Rewinds cooldown.", ""),
    ];

    // Design: striker has CheatingCard + NullifyCard as actives; goalkeeper has IntimidateCard + NullifyCard
    const humanStriker = new Striker(
      humanShootCards,
      [humanCheating, humanNullify1],
      humanPowerUps,
    );
    const humanGoalkeeper = new Goalkeeper(
      humanSaveCards,
      [humanIntimidate, humanNullify2],
      humanPowerUps,
    );
    const humanPlayer = new HumanPlayer(
      "human-1",
      humanGoalkeeper,
      humanStriker,
    );

    // IA player — id "ia-1", mirror set with ids 101+
    const iaShootCards = [
      new ShootCard(101, "IA Strike Normal", "A standard kick.", "", "Normal"),
      new ShootCard(
        102,
        "IA Strike Special",
        "A powerful kick.",
        "",
        "Special",
      ),
      new ShootCard(103, "IA Strike Epic", "An unstoppable kick.", "", "Epic"),
    ];
    const iaSaveCards = [
      new SaveCard(104, "IA Save Normal", "A standard save.", "", "Normal"),
      new SaveCard(105, "IA Save Special", "A skilled save.", "", "Special"),
      new SaveCard(106, "IA Save Epic", "A legendary save.", "", "Epic"),
    ];
    const iaCheating = new CheatingCard(
      107,
      "IA Cheat",
      "Bends the rules.",
      "",
    );
    const iaNullify1 = new NullifyCard(
      108,
      "IA Nullify",
      "Cancels a card.",
      "",
    );
    const iaIntimidate = new IntimidateCard(
      109,
      "IA Intimidate",
      "Breaks focus.",
      "",
    );
    const iaNullify2 = new NullifyCard(
      110,
      "IA Nullify B",
      "Cancels a card.",
      "",
    );
    const iaAdrenaline = new AdrenalineBoost(
      111,
      "IA Adrenaline",
      "Power boost.",
      "",
    );
    const iaFocus = new FocusPill(112, "IA Focus", "Immune to actives.", "");

    const iaStriker = new Striker(
      iaShootCards,
      [iaCheating, iaNullify1],
      [iaAdrenaline],
    );
    const iaGoalkeeper = new Goalkeeper(
      iaSaveCards,
      [iaIntimidate, iaNullify2],
      [iaFocus],
    );
    const iaPlayer = new IAPlayer(
      "ia-1",
      iaGoalkeeper,
      iaStriker,
      new RandomStrategy(),
    );

    // Design invariant: human is always playerA (first arg) so humanGoals = shootout.score.playerA
    const shootout = new PenaltyShootout(
      humanPlayer,
      iaPlayer,
      { shootCards: humanShootCards, saveCards: humanSaveCards },
      { shootCards: iaShootCards, saveCards: iaSaveCards },
      { context, ...(resolver ? { resolver } : {}) },
    );

    return {
      shootout,
      humanPlayerId: "human-1",
      humanPlayer,
      iaPlayer,
    };
  }
}
