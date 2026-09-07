// Makes the live puppet use the same deliberately slim visual silhouette as load.html.
// This is a render-only pass: Matter bodies, joints, grab areas and tuned physics stay untouched.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if (window.PuppetalkCanonicalRender) return;

  const HEAD_OVERRIDE = `
// PUPPETALK_CANONICAL_SLIM_RENDER_V1
// Use exactly the same head silhouette construction as the pre-show character.
puppetalkLiveHeadPath = function(ctx,style,r){
  const p=(x,y)=>[x*r,y*r];
  ctx.beginPath();
  if(style==='smooth'){
    ctx.arc(0,0,r,0,Math.PI*2);
    return;
  }
  if(style==='burst'){
    ctx.moveTo(...p(-.76,.68));
    [[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...p(...q)));
  }else{
    const maps={
      spikes:[[-.82,.58],[-.72,-.58],[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56],[.82,.58]],
      tallSpikes:[[-.78,.62],[-.68,-.48],[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48],[.78,.62]],
      fringe:[[-.84,.62],[-.74,-.50],[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50],[.84,.62]],
      scallop:[[-.84,.62],[-.72,-.48],[-.55,-.82],[-.34,-.68],[-.16,-1.00],[.04,-.72],[.24,-1.00],[.43,-.68],[.65,-.86],[.76,-.48],[.84,.62]],
      tufts:[[-.83,.62],[-.67,-.55],[-.50,-1.00],[-.25,-.68],[-.05,-1.18],[.15,-.68],[.48,-1.08],[.68,-.52],[.83,.62]],
      swept:[[-.84,.60],[-.64,-.55],[-.36,-.90],[.03,-.72],[.25,-1.18],[.32,-.82],[.69,-.98],[.68,-.55],[.84,.60]]
    };
    const pts=maps[style]||maps.spikes;
    ctx.moveTo(...p(...pts[0]));
    for(let i=1;i<pts.length;i++) ctx.lineTo(...p(...pts[i]));
  }
  ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));
  ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.82,.58));
  ctx.closePath();
};
`;

  function patch(source) {
    if (typeof source !== 'string' || !source.includes('PUPPETALK_VISUAL_THICKNESS_V1')) return source;
    if (source.includes('PUPPETALK_CANONICAL_SLIM_RENDER_V1')) return source;

    // load.html's canonical visual rig:
    // torso 34.5, head radius 22, arms 10.2, legs 11.6.
    // Keep all underlying collision dimensions unchanged.
    const swaps = [
      [',p.color,13.5);', ',p.color,11.6);'],
      [',p.color,12);', ',p.color,10.2);'],
      ['const tw = Math.max(18,40*scale);', 'const tw = Math.max(16,34.5*scale);'],
      ['drawSegmentRect(p.segTorsoTop,40,26,7);', 'drawSegmentRect(p.segTorsoTop,34.5,26,7);'],
      ['drawSegmentRect(p.torso,40,26,7);', 'drawSegmentRect(p.torso,34.5,26,7);'],
      ['drawSegmentRect(p.segTorsoBottom,40,26,7);', 'drawSegmentRect(p.segTorsoBottom,34.5,26,7);'],
      ['const hr = Math.max(12,23.5*scale);', 'const hr = Math.max(11,22*scale);']
    ];
    for (const [before, after] of swaps) source = source.split(before).join(after);

    const drawNeedle = 'function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){';
    if (source.includes('function puppetalkLiveHeadPath') && source.includes(drawNeedle)) {
      source = source.replace(drawNeedle, `${HEAD_OVERRIDE}\n${drawNeedle}`);
    } else {
      console.warn('Puppetalk canonical renderer could not find the live head renderer.');
    }

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if (!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };

  window.PuppetalkCanonicalRender = {
    version: 1,
    torsoWidth: 34.5,
    headRadius: 22,
    armWidth: 10.2,
    legWidth: 11.6
  };
})();
