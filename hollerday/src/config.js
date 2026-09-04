export const WORLD = Object.freeze({
  width: 1000,
  height: 700,
  floorY: 620,
  physicsHz: 60,
  snapshotHz: 20,
  interpolationMs: 100,
});

export const PUPPET_COLOURS = ["#b83324", "#207a6b", "#315d9b", "#8d4a91", "#d07b27", "#506b36"];

export function makeRoomCode(length = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

export function normaliseRoomCode(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function getStablePlayerId() {
  const key = "hollerday.playerId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getLocalProfile(playerId) {
  const key = "hollerday.profile";
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.id === playerId && saved?.colour) return saved;
  } catch {}

  let hash = 0;
  for (const ch of playerId) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const profile = {
    id: playerId,
    name: "Puppet",
    colour: PUPPET_COLOURS[Math.abs(hash) % PUPPET_COLOURS.length],
  };
  localStorage.setItem(key, JSON.stringify(profile));
  return profile;
}
