import type { PeerTransport } from "../net/PeerTransport.ts";

// REQ-MULTIPLAYER-ONLINE-PENDING: HostGameScreen and JoinGameScreen both
// resolve to the exact same next step — a connected PeerTransport handed
// off to main.ts's playOnlineMatch(), or a cancel back to Home — so this
// module holds ONE shared pending-callback pair instead of each screen
// duplicating an identical setter pair. Screens can't reach these private
// module-level slots directly (unlike the single-screen pending-slot
// convention elsewhere, e.g. HomeScreen._onStart), so this also exports
// take* readers that read-and-clear, mirroring exactly what every screen's
// own prepare() does for its own pending slots.
let _pendingOnConnected: ((transport: PeerTransport) => void) | null = null;
let _pendingOnCancel: (() => void) | null = null;

export function setPendingOnConnected(
  cb: (transport: PeerTransport) => void,
): void {
  _pendingOnConnected = cb;
}

export function setPendingOnCancel(cb: () => void): void {
  _pendingOnCancel = cb;
}

export function takePendingOnConnected():
  | ((transport: PeerTransport) => void)
  | null {
  const cb = _pendingOnConnected;
  _pendingOnConnected = null;
  return cb;
}

export function takePendingOnCancel(): (() => void) | null {
  const cb = _pendingOnCancel;
  _pendingOnCancel = null;
  return cb;
}
