(function(global){
  'use strict';

  function create({
    getDimensions,ctx,props,puppets,conns,
    drawBackdrop,drawProp,propState,drawAnatomy,anatomy,send,
    getLastSceneSent,setLastSceneSent,getLast,setLast,clamp,
    drivePuppet,repairBrokenSeams,repairSeveredJoints,driveProps,
    Engine,engine,driveDepthAssistedProps,driveLaserFrisbeeCuts,requestFrame
  }){
    if(typeof getDimensions !== 'function' || !ctx || !props || !puppets || !conns ||
       typeof drawBackdrop !== 'function' || typeof drawProp !== 'function' ||
       typeof propState !== 'function' || typeof drawAnatomy !== 'function' || typeof anatomy !== 'function' ||
       typeof send !== 'function' || typeof getLastSceneSent !== 'function' || typeof setLastSceneSent !== 'function' ||
       typeof getLast !== 'function' || typeof setLast !== 'function' || typeof clamp !== 'function' ||
       typeof drivePuppet !== 'function' || typeof repairBrokenSeams !== 'function' || typeof repairSeveredJoints !== 'function' ||
       typeof driveProps !== 'function' || !Engine || !engine || typeof driveDepthAssistedProps !== 'function' ||
       typeof driveLaserFrisbeeCuts !== 'function' || typeof requestFrame !== 'function') return null;

    function drawStage(){
      const {W,H}=getDimensions();
      drawBackdrop(ctx,W,H);
      props.forEach(prop=>drawProp(ctx,propState(prop),W,H));
      puppets.forEach(p=>drawAnatomy(ctx,anatomy(p),W,H,false));
    }

    function broadcastScene(now){
      if(now-getLastSceneSent() < 66 || !conns.size) return;
      setLastSceneSent(now);
      const scene = {type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)};
      conns.forEach(conn=>send(conn,scene));
    }

    function tick(now){
      const dt = clamp(now-getLast(),8,25);
      setLast(now);
      puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); repairSeveredJoints(p); });
      driveProps();
      Engine.update(engine,dt);
      driveDepthAssistedProps(now);
      driveLaserFrisbeeCuts(now);
      drawStage();
      broadcastScene(now);
      requestFrame(tick);
    }

    return {drawStage,broadcastScene,tick};
  }

  global.PuppetalkStageLoop={create};
})(typeof window!=='undefined'?window:globalThis);
