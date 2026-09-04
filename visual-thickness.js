// Puppetalk final visual-proportion pass.
// Runs after the destructible/seat/depth renderers have composed. It changes only
// painted thickness: physics bodies, joint positions, grab areas and depth are untouched.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if(window.PuppetalkVisualThickness) return;

  function patch(source){
    if(typeof source !== 'string' || !source.includes('PUPPETALK_DEPTH_ASSIST_V1')) return source;
    if(source.includes('PUPPETALK_VISUAL_THICKNESS_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_DEPTH_ASSIST_V1',
      '  // PUPPETALK_DEPTH_ASSIST_V1\n  // PUPPETALK_VISUAL_THICKNESS_V1'
    );

    // These replacements deliberately happen after segmented-puppet.js has consumed
    // its original 17/15/48/26 renderer needles. Missing matches are harmless.
    const swaps = [
      [',p.color,17);', ',p.color,13.5);'],
      [',p.color,15);', ',p.color,12);'],
      ['const tw = Math.max(20,48*scale);', 'const tw = Math.max(18,40*scale);'],
      ['drawSegmentRect(p.segTorsoTop,48,26,7);', 'drawSegmentRect(p.segTorsoTop,40,26,7);'],
      ['drawSegmentRect(p.torso,48,26,7);', 'drawSegmentRect(p.torso,40,26,7);'],
      ['drawSegmentRect(p.segTorsoBottom,48,26,7);', 'drawSegmentRect(p.segTorsoBottom,40,26,7);'],
      ['const hr = Math.max(13,26*scale);', 'const hr = Math.max(12,23.5*scale);'],
      ['drawSegmentRect(p.segHeadLower,44,24,11);', 'drawSegmentRect(p.segHeadLower,40,24,10);'],
      ['drawSegmentRect(p.segHeadTop,44,24,11);', 'drawSegmentRect(p.segHeadTop,40,24,10);']
    ];
    for(const [before,after] of swaps) source = source.split(before).join(after);
    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };

  window.PuppetalkVisualThickness = {version:1};
})();
