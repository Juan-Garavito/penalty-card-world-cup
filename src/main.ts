import { inject, track } from "@vercel/analytics";
import { engine } from "./engine/instance.ts";
import { watchOrientation } from "./engine/utils/orientationGuard.ts";
import "@pixi/sound";
import { registerSounds, SOUND_ALIASES } from "./engine/audio/sounds.ts";
import { bgm, sfx } from "./engine/audio/audio.ts";
import {
  loadAudioSettings,
  applyAudioSettings,
} from "./engine/audio/audioSettings.ts";
import {
  HomeScreen,
  setPendingOnStart,
} from "./screens/HomeScreen.ts";
import { LoadingScreen } from "./screens/LoadingScreen.ts";
import {
  PenaltyScreen,
  setPendingPresenter,
  setPendingSpriteBundle,
  setPendingCardTextures,
  setPendingOnMatchComplete,
  setPendingTeamColors,
  setPendingTeamNames,
} from "./screens/PenaltyScreen.ts";
import { PenaltyPresenter } from "./screens/PenaltyPresenter.ts";
import { MatchFactory } from "./entities/Match/MatchFactory.ts";
import { loadPenaltySprites } from "./screens/sprites/loadPenaltySprites.ts";
import { loadCardTextures } from "./screens/sprites/cardArt.ts";
import {
  TeamSelectionScreen,
  setPendingOnSelect,
} from "./screens/TeamSelectionScreen.ts";
import {
  GroupStageScreen,
  setPendingTournament,
  setPendingOnPlayMatch,
  setPendingOnGroupComplete,
  setPendingOnGroupEliminated,
  setPendingOnViewBracketFromGroups,
} from "./screens/GroupStageScreen.ts";
import {
  KnockoutBracketScreen,
  setPendingTournamentKnockout,
  setPendingOnPlayKnockoutMatch,
  setPendingViewOnlyKnockout,
  setPendingOnViewGroupsFromKnockout,
} from "./screens/KnockoutBracketScreen.ts";
import {
  MatchResultsScreen,
  setPendingMatchResults,
} from "./screens/MatchResultsScreen.ts";
import { createTournament } from "./entities/Tournament/TournamentFactory.ts";
import { AdRewardService } from "./services/AdRewardService.ts";
import {
  adInit,
  adGameLoadingStart,
  adGameLoadingFinished,
  adGameplayStart,
  adGameplayStop,
  adBreak,
  createAdService,
} from "./services/AdSdk.ts";
import { buildKnockoutBracket } from "./entities/Tournament/KnockoutBracketBuilder.ts";
import { computeStandings } from "./entities/Tournament/StandingsCalculator.ts";
import {
  getMatchday,
  simulateGroupMatchday,
} from "./entities/Tournament/GroupSimulator.ts";
import { simulateRound, simulateFullBracket, advanceRound } from "./entities/Tournament/KnockoutSimulator.ts";
import { MathRandomRng } from "./entities/Match/MathRandomRng.ts";
import type { Tournament } from "./entities/Tournament/Tournament.ts";
import type { TournamentMatch, TournamentPhase } from "./entities/Tournament/TournamentMatch.ts";

const PHASE_LABELS: Record<TournamentPhase, string> = {
  group: "Groups",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  "3rd": "3rd Place",
  final: "Final",
};

// Deterministic forward-progression map for knockout phases.
// Terminal phases (3rd, final) map to null and are NOT included here —
// advanceKnockout guards against calling them via NEXT_PHASE lookup.
const NEXT_PHASE: Partial<Record<TournamentPhase, TournamentPhase>> = {
  r32: "r16",
  r16: "qf",
  qf: "sf",
  sf: "final",
};

watchOrientation();
inject();

(async () => {
  await adInit();
  adGameLoadingStart();

  await engine.init({
    background: "#1E1E1E",
  });

  registerSounds();
  applyAudioSettings(loadAudioSettings());
  void bgm.play(SOUND_ALIASES.musicBg);

  const MIN_LOADING_DISPLAY_MS = 1800;
  const loadingStartedAt = performance.now();

  await engine.navigation.showScreen(LoadingScreen);
  const loadingScreenRef = engine.navigation.currentScreen as LoadingScreen;

  const spritesDone = loadPenaltySprites().then((bundle) => {
    loadingScreenRef?.setProgress(50);
    return bundle;
  });
  const cardsDone = loadCardTextures().then((textures) => {
    loadingScreenRef?.setProgress(100);
    return textures;
  });
  const [spriteBundle, cardTextures] = await Promise.all([
    spritesDone,
    cardsDone,
  ]);

  adGameLoadingFinished();

  // Keep the loading screen visible for a minimum stretch so the progress
  // animation and screen transition are actually perceivable, even when
  // assets finish loading almost instantly (e.g. on a fast connection).
  // This delay happens AFTER adGameLoadingFinished() so it never affects
  // the portal SDK's reported loading time.
  const remainingDisplayMs = MIN_LOADING_DISPLAY_MS - (performance.now() - loadingStartedAt);
  if (remainingDisplayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDisplayMs));
  }

  let _tournament: Tournament | null = null;
  let _adRewardService: AdRewardService | null = null;

  // ── After match: show all groups' matchday results ────────────────────────

  async function showGroupMatchdayResults(
    playerGroupId: string,
    matchday: 1 | 2 | 3,
  ) {
    if (!_tournament) return;
    const rng = new MathRandomRng();

    // Simulate non-player matches for this matchday in ALL groups
    for (const g of _tournament.groups) {
      simulateGroupMatchday(g, matchday, rng);
    }

    const matchGroups = _tournament.groups.map((g) => ({
      groupId: g.id,
      matches: g.matches.filter((m) => getMatchday(g, m) === matchday),
    }));

    setPendingMatchResults({
      matchGroups,
      playerTeamId: _tournament.playerTeam.id,
      roundTitle: `MATCHDAY ${matchday}`,
      onContinue: () => void goToGroupStage(),
    });
    await engine.navigation.showScreen(MatchResultsScreen);

    void playerGroupId;
  }

  async function goToViewOnlyBracket(): Promise<void> {
    if (!_tournament) return;
    const rng = new MathRandomRng();
    for (const g of _tournament.groups) g.standings = computeStandings(g);
    const bracket = buildKnockoutBracket(_tournament.groups);
    const simulated = simulateFullBracket(bracket, rng);
    const champion = simulated.rounds.find((r) => r.phase === "final")?.matches[0]?.winner ?? null;
    // Same champion-reveal audio treatment as MatchResultsScreen: silence the
    // background music and let the victory stinger play on its own.
    if (champion) {
      sfx.play(SOUND_ALIASES.winner);
      bgm.pause();
    }
    track("tournament_completed", {
      result: "eliminated",
      championId: champion?.id ?? null,
    });
    setPendingViewOnlyKnockout(simulated, champion, _tournament.playerTeam.id, () => void goToHome());
    await engine.navigation.showScreen(KnockoutBracketScreen);
  }

  async function showKnockoutRoundResults(phase: TournamentPhase) {
    if (!_tournament) return;
    const round = _tournament.knockoutBracket.rounds.find((r) => r.phase === phase);
    if (!round) return;

    const rng = new MathRandomRng();
    round.matches = simulateRound(round.matches, rng);

    const playerMatch = round.matches.find(
      (m) => m.home.id === _tournament!.playerTeam.id || m.away.id === _tournament!.playerTeam.id,
    );
    const playerAdvanced = playerMatch?.winner?.id === _tournament.playerTeam.id;

    // Final (win or lose): show the champion banner inline — no extra screens needed
    const isFinal = phase === "final";
    const champion = isFinal ? round.matches[0]?.winner ?? undefined : undefined;

    if (isFinal) {
      track("tournament_completed", {
        result: champion?.id === _tournament.playerTeam.id ? "champion" : "runner_up",
        championId: champion?.id ?? null,
      });
    }

    setPendingMatchResults({
      matchGroups: [{ groupId: PHASE_LABELS[phase], matches: round.matches }],
      playerTeamId: _tournament.playerTeam.id,
      roundTitle: PHASE_LABELS[phase],
      champion,
      onContinue: () => {
        if (isFinal) { void goToHome(); return; }
        if (playerAdvanced) { void advanceKnockout(phase); return; }
        void goToViewOnlyBracket();
      },
    });
    await engine.navigation.showScreen(MatchResultsScreen);
  }

  // ── Flow helpers ──────────────────────────────────────────────────────────

  async function goToGroupStage() {
    if (!_tournament) return;
    setPendingTournament(_tournament);
    setPendingOnPlayMatch((match: TournamentMatch) => {
      const group = _tournament!.groups.find((g) =>
        g.teams.some((t) => t.id === _tournament!.playerTeam.id),
      )!;
      const matchday = getMatchday(group, match) as 1 | 2 | 3;

      setPendingOnMatchComplete(() =>
        void showGroupMatchdayResults(group.id, matchday),
      );
      void playMatch(match);
    });
    setPendingOnGroupComplete(() => void initKnockout());
    setPendingOnGroupEliminated((eliminatedGroupId: string) => {
      if (!_tournament) return;
      const group = _tournament.groups.find((g) => g.id === eliminatedGroupId)!;
      const matchday3Matches = group.matches.filter((m) => getMatchday(group, m) === 3);
      setPendingMatchResults({
        matchGroups: [{ groupId: group.id, matches: matchday3Matches }],
        playerTeamId: _tournament.playerTeam.id,
        roundTitle: "GROUP STAGE — ELIMINATED",
        onContinue: () => void goToViewOnlyBracket(),
      });
      void engine.navigation.showScreen(MatchResultsScreen);
    });
    // The BRACKET tab is only clickable once the knockout bracket has been built
    // (i.e. the player navigated back here from KnockoutBracketScreen).
    if (_tournament.knockoutBracket.rounds.length > 0) {
      setPendingOnViewBracketFromGroups(() => void showKnockoutBracketScreen());
    }
    await engine.navigation.showScreen(GroupStageScreen);
  }

  // Wires up the knockout bracket screen's pending slots and shows it.
  // Shared by initKnockout, advanceKnockout, and the GROUPS↔BRACKET nav tabs.
  async function showKnockoutBracketScreen(): Promise<void> {
    if (!_tournament) return;
    setPendingTournamentKnockout(_tournament);
    setPendingOnPlayKnockoutMatch((match: TournamentMatch) => {
      const phase = _tournament!.phase as TournamentPhase;
      setPendingOnMatchComplete(() => void showKnockoutRoundResults(phase));
      void playMatch(match);
    });
    setPendingOnViewGroupsFromKnockout(() => void goToGroupStage());
    await engine.navigation.showScreen(KnockoutBracketScreen);
  }

  // Called exactly once when the player qualifies from the group stage.
  // Builds the bracket, sets phase to r32, and shows the knockout screen.
  async function initKnockout(): Promise<void> {
    if (!_tournament) return;
    for (const g of _tournament.groups) g.standings = computeStandings(g);
    _tournament.knockoutBracket = buildKnockoutBracket(_tournament.groups);
    _tournament.phase = "r32";

    // Mark the player's R32 match so advanceRound preserves it instead of simulating it.
    const r32Round = _tournament.knockoutBracket.rounds.find((r) => r.phase === "r32");
    const playerR32Match = r32Round?.matches.find(
      (m) => m.home.id === _tournament!.playerTeam.id || m.away.id === _tournament!.playerTeam.id,
    );
    if (playerR32Match) playerR32Match.isPlayerMatch = true;

    await showKnockoutBracketScreen();
  }

  // Called after each round win to advance to the next phase without rebuilding the bracket.
  // CRITICAL: _tournament.phase MUST be set BEFORE showKnockoutBracketScreen —
  // its setPendingOnPlayKnockoutMatch callback closure captures phase at call time.
  async function advanceKnockout(completedPhase: TournamentPhase): Promise<void> {
    if (!_tournament) return;
    const rng = new MathRandomRng();
    _tournament.knockoutBracket = advanceRound(_tournament.knockoutBracket, rng);

    const nextPhase = NEXT_PHASE[completedPhase];
    if (nextPhase === undefined) {
      throw new Error(`advanceKnockout: no next phase for "${completedPhase}"`);
    }
    // Phase must be assigned before showKnockoutBracketScreen so the closure captures the new value
    _tournament.phase = nextPhase;

    await showKnockoutBracketScreen();
  }

  /** @deprecated Use initKnockout() (first entry) or advanceKnockout(phase) (round wins). */
  function goToKnockout(): never {
    throw new Error("goToKnockout is deprecated — use initKnockout or advanceKnockout");
  }

  async function playMatch(match: TournamentMatch) {
    const matchContext = match.phase === "group" ? "group" : "knockout";
    const { shootout, humanPlayerId, humanPlayer, iaPlayer } =
      MatchFactory.build(matchContext, undefined, _tournament?.playerPowerUps);

    const isPlayerHome = _tournament?.playerTeam.id === match.home.id;
    const playerTeam = isPlayerHome ? match.home : match.away;
    const opponentTeam = isPlayerHome ? match.away : match.home;

    const presenter = new PenaltyPresenter({
      shootout,
      humanPlayerId,
      humanPlayer,
      iaPlayer,
      adRewardService: _adRewardService ?? undefined,
    });

    // Write result on game-over or draw; navigation is triggered by the Continue button
    const unsubscribe = presenter.onStateChange(() => {
      const vm = presenter.viewModel;
      if (vm.phase === "game-over" || vm.phase === "draw") {
        unsubscribe();
        adGameplayStop();
        bgm.unduck();
        const humanGoals = vm.score.humanGoals;
        const aiGoals = vm.score.aiGoals;
        match.homeGoals = isPlayerHome ? humanGoals : aiGoals;
        match.awayGoals = isPlayerHome ? aiGoals : humanGoals;
        match.winner =
          vm.phase === "draw"
            ? null
            : humanGoals > aiGoals
              ? playerTeam
              : aiGoals > humanGoals
                ? opponentTeam
                : null;
        track("match_played", {
          phase: match.phase,
          result:
            vm.phase === "draw"
              ? "draw"
              : match.winner === playerTeam
                ? "win"
                : "loss",
        });
      }
    });

    setPendingPresenter(presenter);
    setPendingSpriteBundle(spriteBundle);
    setPendingCardTextures(new Map(cardTextures));
    setPendingTeamColors(
      playerTeam.strikerColor,
      playerTeam.goalkeeperColor,
      opponentTeam.strikerColor,
      opponentTeam.goalkeeperColor,
    );
    setPendingTeamNames(playerTeam.abbreviation, opponentTeam.abbreviation);
    // _pendingOnMatchComplete is already set by the caller

    // Only midgame ad break left in the tournament flow: once, right before
    // the final (win or lose, the player never sees another one — there's
    // no match after the final). Keeps flow uninterrupted everywhere else;
    // rewarded ads (card-use recovery) are unaffected by this.
    if (match.phase === "final") {
      await adBreak();
    }

    adGameplayStart();
    bgm.duck();
    await engine.navigation.showScreen(PenaltyScreen);
  }

  // ── Team selection → start tournament ────────────────────────────────────

  async function goToTeamSelection() {
    setPendingOnSelect(async (teamId: string) => {
      bgm.resume();
      track("team_selected", { teamId });
      _tournament = createTournament(teamId);
      const adAdapter = createAdService(engine.navigation);
      _adRewardService = new AdRewardService(adAdapter, _tournament);
      await goToGroupStage();
    });
    await engine.navigation.showScreen(TeamSelectionScreen);
  }

  // ── Home screen entry point ───────────────────────────────────────────────

  async function goToHome(): Promise<never> {
    // Every path into Home follows a champion reveal (real win or simulated),
    // which pauses bgm and plays the winner stinger — bring bgm back and cut
    // the stinger short in case the player continued before it finished.
    // bgm.resume() is safe even when it isn't paused (e.g. the first boot call).
    sfx.stop(SOUND_ALIASES.winner);
    bgm.resume();
    setPendingOnStart(() => void goToTeamSelection());
    await engine.navigation.showScreen(HomeScreen);
    return undefined as never;
  }

  await goToHome();
})();
