import { PenaltyShootout } from "./PenaltyShootout.ts";
import { PenaltyResolver } from "./PenaltyResolver.ts";
import { HumanPlayer } from "../Players/HumanPlayer.ts";
import { IAPlayer } from "../Players/IAPlayer.ts";
import { IPlayer } from "../Players/IPlayer.ts";
import { RemotePlayer } from "../Players/RemotePlayer.ts";
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

// REQ-MULTIPLAYER-IPLAYER-WIDENING: iaPlayer is widened to IPlayer so this
// shape can also be produced by buildMultiplayer() (opponent = RemotePlayer,
// not IAPlayer). build() itself keeps returning a real IAPlayer instance —
// its declared return type below intersects back to IAPlayer so ALL existing
// callers (main.ts, PenaltyPresenter deps) see zero type/behavior change.
//
// NOTE — despite the field name, `iaPlayer` does NOT always hold an
// AI-controlled player: build() returns a real IAPlayer here, but
// buildMultiplayer() returns a RemotePlayer instead — a real human peer over
// the network, not an AI. Don't branch on "iaPlayer is set" to mean
// "AI-controlled"; check the concrete instance type (e.g. `instanceof
// IAPlayer` / `instanceof RemotePlayer`) if that distinction matters.
export interface MatchBuild {
  shootout: PenaltyShootout;
  humanPlayerId: string;
  humanPlayer: HumanPlayer;
  iaPlayer: IPlayer;
}

export class MatchFactory {
  // REQ-FORMAT-005: context forwarded to PenaltyShootout
  // resolver param is for testing only (allows injecting a deterministic resolver)
  // playerPowerUps: when provided, those exact instances are used for human player (tournament persistence)
  static build(
    context?: "group" | "knockout",
    resolver?: PenaltyResolver,
    playerPowerUps?: PowerUpCard[],
  ): MatchBuild & { iaPlayer: IAPlayer } {
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

  // REQ-MULTIPLAYER-CATALOG-SYMMETRY: both clients (host and guest) call this
  // with their own `role` and build the SAME two deterministic, disjoint card
  // catalogs (host ids 1-13, guest ids 101-113) locally — no server/network
  // involvement, no card data crosses the wire. Only numeric ids do (see
  // RemoteDecisionAdapter), which are looked up back against these catalogs.
  //
  // Fixed player ordering: host is ALWAYS constructed as playerA and guest is
  // ALWAYS playerB in the underlying PenaltyShootout — on BOTH clients,
  // regardless of `role` — so shooterId/goalkeeperId (and all turn-taking
  // state) evolve identically on host and guest, which PenaltyShootout's
  // guest-side applyRemoteOutcome() depends on to converge without ever
  // calling decide()/advance().
  //
  // NOTE: the returned `iaPlayer` field holds a RemotePlayer here (a real
  // human peer over the network), NOT an AI — see the doc comment on
  // MatchBuild.iaPlayer above.
  static buildMultiplayer(role: "host" | "guest"): MatchBuild {
    // Host catalog — ids 1-13 (same shape/tiers as build()'s human catalog)
    const hostShootCards = [
      new ShootCard(1, "Strike Normal", "A standard kick.", "", "Normal"),
      new ShootCard(2, "Strike Special", "A powerful kick.", "", "Special"),
      new ShootCard(3, "Strike Epic", "An unstoppable kick.", "", "Epic"),
    ];
    const hostSaveCards = [
      new SaveCard(4, "Save Normal", "A standard save.", "", "Normal"),
      new SaveCard(5, "Save Special", "A skilled save.", "", "Special"),
      new SaveCard(6, "Save Epic", "A legendary save.", "", "Epic"),
    ];
    const hostCheating = new CheatingCard(7, "Cheat", "Bends the rules.", "");
    const hostNullify1 = new NullifyCard(8, "Nullify", "Cancels a card.", "");
    const hostIntimidate = new IntimidateCard(
      9,
      "Intimidate",
      "Breaks focus.",
      "",
    );
    const hostNullify2 = new NullifyCard(
      10,
      "Nullify B",
      "Cancels a card.",
      "",
    );
    const hostPowerUps: PowerUpCard[] = [
      new AdrenalineBoost(11, "Adrenaline", "Power boost.", ""),
      new FocusPill(12, "Focus", "Immune to actives.", ""),
      new TimeRewind(13, "Time Rewind", "Rewinds cooldown.", ""),
    ];
    const hostStriker = new Striker(
      hostShootCards,
      [hostCheating, hostNullify1],
      hostPowerUps,
    );
    const hostGoalkeeper = new Goalkeeper(
      hostSaveCards,
      [hostIntimidate, hostNullify2],
      hostPowerUps,
    );

    // Guest catalog — ids 101-113 (same shape/tiers, disjoint id range)
    const guestShootCards = [
      new ShootCard(101, "Strike Normal", "A standard kick.", "", "Normal"),
      new ShootCard(102, "Strike Special", "A powerful kick.", "", "Special"),
      new ShootCard(103, "Strike Epic", "An unstoppable kick.", "", "Epic"),
    ];
    const guestSaveCards = [
      new SaveCard(104, "Save Normal", "A standard save.", "", "Normal"),
      new SaveCard(105, "Save Special", "A skilled save.", "", "Special"),
      new SaveCard(106, "Save Epic", "A legendary save.", "", "Epic"),
    ];
    const guestCheating = new CheatingCard(
      107,
      "Cheat",
      "Bends the rules.",
      "",
    );
    const guestNullify1 = new NullifyCard(
      108,
      "Nullify",
      "Cancels a card.",
      "",
    );
    const guestIntimidate = new IntimidateCard(
      109,
      "Intimidate",
      "Breaks focus.",
      "",
    );
    const guestNullify2 = new NullifyCard(
      110,
      "Nullify B",
      "Cancels a card.",
      "",
    );
    const guestPowerUps: PowerUpCard[] = [
      new AdrenalineBoost(111, "Adrenaline", "Power boost.", ""),
      new FocusPill(112, "Focus", "Immune to actives.", ""),
      new TimeRewind(113, "Time Rewind", "Rewinds cooldown.", ""),
    ];
    const guestStriker = new Striker(
      guestShootCards,
      [guestCheating, guestNullify1],
      guestPowerUps,
    );
    const guestGoalkeeper = new Goalkeeper(
      guestSaveCards,
      [guestIntimidate, guestNullify2],
      guestPowerUps,
    );

    // Two explicit, statically-typed branches (instead of one generic
    // ternary + an `as HumanPlayer` cast on the winner): each branch knows,
    // without a cast, which side is the real local HumanPlayer and which is
    // the RemotePlayer standing in for the networked opponent.
    let humanPlayer: HumanPlayer;
    let remotePlayer: RemotePlayer;
    let hostPlayer: IPlayer;
    let guestPlayer: IPlayer;
    if (role === "host") {
      humanPlayer = new HumanPlayer("host-1", hostGoalkeeper, hostStriker);
      remotePlayer = new RemotePlayer("guest-1", guestGoalkeeper, guestStriker);
      hostPlayer = humanPlayer;
      guestPlayer = remotePlayer;
    } else {
      humanPlayer = new HumanPlayer("guest-1", guestGoalkeeper, guestStriker);
      remotePlayer = new RemotePlayer("host-1", hostGoalkeeper, hostStriker);
      hostPlayer = remotePlayer;
      guestPlayer = humanPlayer;
    }

    // Design invariant: host is always playerA (first arg), guest always
    // playerB — fixed regardless of `role`, so both clients' local
    // PenaltyShootout state (shooterId/goalkeeperId/turn order) converges.
    const shootout = new PenaltyShootout(
      hostPlayer,
      guestPlayer,
      { shootCards: hostShootCards, saveCards: hostSaveCards },
      { shootCards: guestShootCards, saveCards: guestSaveCards },
    );

    return {
      shootout,
      humanPlayerId: humanPlayer.id,
      humanPlayer,
      iaPlayer: remotePlayer,
    };
  }
}
