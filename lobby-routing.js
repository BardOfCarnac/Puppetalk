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

  const lobby = new URL('./load.html', location.href);
  lobby.search = '';
  if(room) lobby.searchParams.set('room', room);
  if(params.get('host') === '1') lobby.searchParams.set('host','1');
  location.replace(lobby.href);
})();