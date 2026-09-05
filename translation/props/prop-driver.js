(function(root){
  'use strict';

  function create({
    props,propGrips,gripKey,cancelPropContest,promotePropContest,clamp,
    Body,engine,driveAttachedBalloon,syncAttachedProp,driveDartBalloonPops,now
  }){
    function updatePropContest(prop,at){
      const tug = prop.contest;
      if(!tug || !prop.heldBy) return;
      const holder = propGrips.get(gripKey(prop.heldBy.slot,prop.heldBy.hand));
      if(!holder){ cancelPropContest(prop); return; }
      const dt = Math.max(0,Math.min(.08,(at-tug.lastUpdateAt)/1000));
      tug.lastUpdateAt = at;
      if(at-tug.lastTapAt > 260) tug.score = Math.max(0,tug.score-dt*.12);
      tug.score = clamp(tug.score,0,1.05);
      holder.constraint.stiffness = .86-tug.score*.58;
      tug.constraint.stiffness = .14+tug.score*.72;
      if(tug.score >= 1){ promotePropContest(prop); return; }
      if(tug.score <= 0 && at-tug.lastTapAt > 700) cancelPropContest(prop);
    }

    function driveProps(){
      const at = now();
      props.forEach(prop=>{
        if(prop.type === 'balloon'){
          const b = prop.body;
          Body.applyForce(b,b.position,{x:0,y:-b.mass*engine.gravity.y*engine.gravity.scale*1.42});
        }
        updatePropContest(prop,at);
        driveAttachedBalloon(prop,at);
        syncAttachedProp(prop);
      });
      driveDartBalloonPops();
    }

    return {updatePropContest,driveProps};
  }

  root.PuppetalkPropDriver = {create};
})(typeof window !== 'undefined' ? window : globalThis);
