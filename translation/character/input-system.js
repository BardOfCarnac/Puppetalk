(function(global){
  'use strict';

  function create({makePuppet,GRAB_PARTS,POSES,clamp}){
    if(typeof makePuppet !== 'function' || !GRAB_PARTS || !POSES || typeof clamp !== 'function') return null;

    function applyInput(slot,msg){
      if(msg?.type !== 'input') return;
      const p = makePuppet(slot);
      const input = msg.input || {};
      let grabs = Array.isArray(input.grabs) ? input.grabs : [];
      if(!grabs.length && input.grabbing && GRAB_PARTS.has(input.grabPart)){
        grabs = [{part:input.grabPart,x:input.x,y:input.y}];
      }
      p.grabs = grabs.slice(0,2).filter(g=>GRAB_PARTS.has(g?.part)).map(g=>({
        part:g.part,
        x:clamp(Number.isFinite(g.x)?g.x:.5,.02,.98),
        y:clamp(Number.isFinite(g.y)?g.y:.55,.06,.96)
      }));
      p.grabbing = p.grabs.length > 0;
      if(p.grabbing){
        p.grabPart = p.grabs[0].part;
        p.grabTarget.x = p.grabs[0].x;
        p.grabTarget.y = p.grabs[0].y;
      }
      if(POSES[input.pose]) p.pose = input.pose;
      if(Number.isInteger(input.poseVersion)) p.poseVersion = input.poseVersion;
      if(typeof input.rag === 'boolean') p.rag = input.rag;
      if(Number.isInteger(input.mouth)) p.mouth = clamp(input.mouth,0,2);
    }

    return {applyInput};
  }

  global.PuppetalkCharacterInputSystem={create};
})(typeof window!=='undefined'?window:globalThis);
