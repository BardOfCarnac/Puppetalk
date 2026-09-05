(function(global){
  'use strict';

  function create({
    Matter,engine,propForBody,puppetPartForBody,puppets,handBody,
    closestPointOnBody,tieBalloonToBody,performance,Vector,Body,clamp
  }){
    if(!Matter?.Events || !engine || typeof propForBody !== 'function' || typeof puppetPartForBody !== 'function' ||
       !puppets || typeof handBody !== 'function' || typeof closestPointOnBody !== 'function' ||
       typeof tieBalloonToBody !== 'function' || !performance || !Vector || !Body || typeof clamp !== 'function') return null;

    function installPropContactPhysics(){
      Matter.Events.on(engine,'collisionStart',event=>{
        for(const pair of event.pairs || []){
          let prop = propForBody(pair.bodyA);
          let other = pair.bodyB;
          if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
          if(!prop || prop.type !== 'balloon' || prop.attachedTo || prop.contest) continue;
          const target = puppetPartForBody(other);
          if(!target) continue;

          if(prop.heldBy){
            const holder = puppets.get(prop.heldBy.slot);
            const heldBody = holder ? handBody(holder,prop.heldBy.hand) : null;
            if(heldBody === target.body) continue;
          }
          const point = closestPointOnBody(target.body,prop.body.position);
          tieBalloonToBody(prop,{...target,point});
        }
      });

      Matter.Events.on(engine,'collisionActive',event=>{
        const now = performance.now();
        for(const pair of event.pairs || []){
          let prop = propForBody(pair.bodyA);
          let other = pair.bodyB;
          if(!prop){ prop = propForBody(pair.bodyB); other = pair.bodyA; }
          if(!prop || prop.type !== 'ball' || prop.heldBy || prop.attachedTo) continue;
          const target = puppetPartForBody(other);
          if(!target || (target.part !== 'shL' && target.part !== 'shR')) continue;
          if(now-(prop._lastKickAt||0) < 130) continue;

          const footLocal = {x:0,y:25};
          const r = Vector.rotate(footLocal,other.angle||0);
          const omega = other.angularVelocity || 0;
          const footV = {
            x:(other.velocity?.x||0)-omega*r.y,
            y:(other.velocity?.y||0)+omega*r.x
          };
          const footSpeed = Math.hypot(footV.x,footV.y);
          if(footSpeed < 1.15) continue;

          const current = prop.body.velocity || {x:0,y:0};
          let vx = current.x + footV.x*1.08;
          let vy = current.y + footV.y*1.08;
          const speed = Math.hypot(vx,vy);
          if(speed > 15){
            const k = 15/speed;
            vx *= k; vy *= k;
          }
          Body.setVelocity(prop.body,{x:vx,y:vy});
          Body.setAngularVelocity(prop.body,clamp((prop.body.angularVelocity||0)+omega*.48,-.32,.32));
          prop._lastKickAt = now;
        }
      });
    }

    return {installPropContactPhysics};
  }

  global.PuppetalkPropContactPhysics={create};
})(typeof window!=='undefined'?window:globalThis);
