export const WORLD = Object.freeze({
  width: 1000,
  height: 700,
  floorY: 620,
  physicsHz: 60,
  snapshotHz: 20,
  interpolationMs: 100,
});

export const PUPPET_COLOURS = ["#cf6c63","#d0a950","#7089b9","#729d78","#a879b2","#67a7a8","#d79b75","#8a6d5b","#d9c3a7","#7e8794","#d65050","#5b8fd1"];
export const CHARACTER_PARTS = Object.freeze({
  headStyle: ["smooth","spikes","tallSpikes","burst","scallop","tufts","swept","fringe"],
  eyes: ["closed","dots","happy","mismatch","sleepy","unevenDots","wink","winkRight"],
  nose: ["angular","bow","curve","hook","long","slant"],
  mouth: ["frown","line","pleased","shy","smile","smirk","soft","wavy"],
  extra: ["none","glasses","moustache","freckles","eyepatch"],
});

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

function pick(list, hash, offset = 0) {
  return list[Math.abs(hash + offset * 997) % list.length];
}

function hashId(id) {
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return hash;
}

function cleanPart(key, value, fallback) {
  return CHARACTER_PARTS[key].includes(value) ? value : fallback;
}

function migrateLegacyLook() {
  try {
    const look = JSON.parse(localStorage.getItem("puppetalk-look") || "null");
    if (look && typeof look === "object") return look;
  } catch {}
  return null;
}

export function saveLocalProfile(profile) {
  localStorage.setItem("hollerday.profile", JSON.stringify(profile));
  localStorage.setItem("puppetalk-name", profile.name || "Puppet");
  localStorage.setItem("puppetalk-look", JSON.stringify({
    color: profile.colour,
    headStyle: profile.headStyle,
    eyes: profile.eyes,
    nose: profile.nose,
    mouth: profile.mouth,
    extra: profile.extra,
  }));
}

export function getLocalProfile(playerId) {
  const hash = hashId(playerId);
  const defaults = {
    id: playerId,
    name: localStorage.getItem("puppetalk-name") || "Puppet",
    colour: pick(PUPPET_COLOURS, hash),
    headStyle: pick(CHARACTER_PARTS.headStyle, hash, 1),
    eyes: pick(CHARACTER_PARTS.eyes, hash, 2),
    nose: pick(CHARACTER_PARTS.nose, hash, 3),
    mouth: pick(CHARACTER_PARTS.mouth, hash, 4),
    extra: pick(CHARACTER_PARTS.extra, hash, 5),
    specialItem: "ball",
  };

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("hollerday.profile") || "null"); } catch {}
  const legacy = migrateLegacyLook();
  const source = saved?.id === playerId ? saved : {};
  const profile = {
    id: playerId,
    name: String(source.name || defaults.name).trim().slice(0, 24) || "Puppet",
    colour: /^#[0-9a-f]{6}$/i.test(source.colour || legacy?.color || "") ? (source.colour || legacy.color) : defaults.colour,
    headStyle: cleanPart("headStyle", source.headStyle || legacy?.headStyle, defaults.headStyle),
    eyes: cleanPart("eyes", source.eyes || legacy?.eyes, defaults.eyes),
    nose: cleanPart("nose", source.nose || legacy?.nose, defaults.nose),
    mouth: cleanPart("mouth", source.mouth || legacy?.mouth, defaults.mouth),
    extra: cleanPart("extra", source.extra || legacy?.extra, defaults.extra),
    specialItem: source.specialItem || defaults.specialItem,
  };
  saveLocalProfile(profile);
  return profile;
}
