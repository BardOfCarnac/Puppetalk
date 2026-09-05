(function(global){
  'use strict';

  function create({Matter,engine,propForBody,puppetPartForBody,attachPropToBody}){
    if(!Matter?.Events || !engine || typeof propForBody !== 'function' ||
       typeof puppetPartForBody !== 'function' || typeof attachPropToBody !== 'function') return null;

    function installDartImpacts(){
      Matter.Events.on(engine,'collisionStart',event=>{
        for(const pair of event.pairs || []){
          let prop = propForBody(pair.bodyA);
          let other = pair.bodyB;
          if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
          if(!prop || prop.type !== 'dart' || prop.heldBy || prop.contest || prop.attachedTo) continue;
          const target = puppetPartForBody(other);
          if(!target) continue;
          const rvx = (prop.body.velocity?.x||0)-(other.velocity?.x||0);
          const rvy = (prop.body.velocity?.y||0)-(other.velocity?.y||0);
          const relativeSpeed = Math.hypot(rvx,rvy);
          if(relativeSpeed < 2.15) continue;
          attachPropToBody(prop,target);
        }
      });
    }

    return {installDartImpacts};
  }

  global.PuppetalkDartImpacts={create};
})(typeof window!=='undefined'?window:globalThis);
