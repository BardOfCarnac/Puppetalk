// Puppetalk look schema migration.
// The old untouched character default was round + no hair. Once integrated head/hair
// silhouettes became the character system, carrying that default forward made the
// new faces look as though they had never loaded. Preserve deliberate old choices,
// but move the legacy default onto the new integrated-hair default.
(() => {
  try {
    const key = 'puppetalk-look';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const look = JSON.parse(raw);
    if (!look || typeof look !== 'object' || look.headStyle) return;

    const legacyDefaultHead = !look.head || look.head === 'round';
    const legacyDefaultHair = !look.hair || look.hair === 'none';
    if (!legacyDefaultHead || !legacyDefaultHair) return;

    look.headStyle = 'spikes';
    delete look.head;
    delete look.hair;
    localStorage.setItem(key, JSON.stringify(look));
  } catch {
    // A bad/blocked localStorage value must never interfere with startup.
  }
})();
