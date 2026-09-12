// Routes first app entry and invited controllers through the character pre-show screen.
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

  // The hidden/authoritative stage and an already-approved controller must never be rerouted.
  if(mode === 'stage' || params.get('lobby') === 'done') return;

  const freshAppOpen = !mode && !room;
  const enteringController = mode === 'controller' && !!room;
  if(!freshAppOpen && !enteringController) return;

  // The landing-screen reroll is one use per fresh trip through the pre-show,
  // not one use forever on this browser. Keep the flag while a player remains
  // on the same pre-show (so refresh is not another reroll), but clear it when
  // Puppetalk deliberately starts a new host/join flow.
  try { localStorage.removeItem('puppetalk-profile-randomized-v1'); } catch {}

  const lobby = new URL('./load.html', location.href);
  lobby.search = '';
  if(room) lobby.searchParams.set('room', room);
  if(params.get('host') === '1') lobby.searchParams.set('host','1');
  location.replace(lobby.href);
})();