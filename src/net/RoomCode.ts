// REQ-MULTIPLAYER-ROOM-CODE: a short, human-typeable code used as the host's
// PeerJS id — guests type it in to connect. Alphabet excludes visually
// ambiguous characters (0/O, 1/I) since this is read/typed by a person, not
// a security token, so Math.random() selection is fine.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}
