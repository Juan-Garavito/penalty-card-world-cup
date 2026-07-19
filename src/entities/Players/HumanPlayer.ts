import { BufferedDecisionPlayer } from "./BufferedDecisionPlayer.ts";

// Local human input, buffered from UI selections. See
// BufferedDecisionPlayer for the shared buffer-then-read decide() pattern
// (also used by RemotePlayer for networked peer input).
export class HumanPlayer extends BufferedDecisionPlayer {}
