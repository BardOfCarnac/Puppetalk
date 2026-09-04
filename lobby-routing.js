// Routes table entry through the pre-table lobby exactly once.
(() => {
  const params = new URLSearchParams(location.search);
  const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  const enteringController = params.get('mode') === 'controller' && !!room;
  if(!enteringController || params.get('lobby') === 'done') return;

  const lobby = new URL('./creator.html', location.href);
  lobby.search = '';
  lobby.searchParams.set('room', room);
  if(params.get('host') === '1') lobby.searchParams.set('host','1');
  location.replace(lobby.href);
})();