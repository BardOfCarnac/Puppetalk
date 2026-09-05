(function(global){
  'use strict';

  function create({puppets,props,grabWorldPoint,clamp,Vector}){
    if(!puppets || !props || typeof grabWorldPoint !== 'function' || typeof clamp !== 'function' || !Vector) return null;

    function handBody(p,hand){
      if(hand === 'left') return p.faL2 || p.faL;
      if(hand === 'right') return p.faR2 || p.faR;
      if(hand === 'leftFoot') return p.shL2 || p.shL;
      if(hand === 'rightFoot') return p.shR2 || p.shR;
      return null;
    }
    function handPoint(p,hand){
      if(hand === 'left') return grabWorldPoint(p,'leftHand');
      if(hand === 'right') return grabWorldPoint(p,'rightHand');
      if(hand === 'leftFoot') return grabWorldPoint(p,'leftFoot');
      if(hand === 'rightFoot') return grabWorldPoint(p,'rightFoot');
      return p?.torso?.position || {x:0,y:0};
    }
    function propGripLocalPoint(hand){
      return hand === 'leftFoot' || hand === 'rightFoot' ? {x:0,y:13.5} : {x:0,y:12};
    }
    function validPropEffector(hand){
      return hand === 'left' || hand === 'right' || hand === 'leftFoot' || hand === 'rightFoot';
    }
    const gripKey = (slot,hand)=>`${slot}:${hand}`;

    const ATTACHABLE_PARTS = ['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR'];
    function puppetPartForBody(body){
      if(!body) return null;
      if(Number.isInteger(body.plugin?.puppetalkSlot) && body.plugin?.puppetalkSegmentPart){
        return {slot:body.plugin.puppetalkSlot,part:body.plugin.puppetalkSegmentPart,body};
      }
      for(const p of puppets.values()){
        for(const part of ATTACHABLE_PARTS){
          if(p[part] === body) return {slot:p.slot,part,body};
        }
      }
      return null;
    }
    function propForBody(body){
      for(const prop of props.values()) if(prop.body === body) return prop;
      return null;
    }
    function closestPointOnBody(body,point){
      if(!body?.bounds) return {x:body.position.x,y:body.position.y};
      return {
        x:clamp(point.x,body.bounds.min.x,body.bounds.max.x),
        y:clamp(point.y,body.bounds.min.y,body.bounds.max.y)
      };
    }
    function nearestBalloonTarget(prop,slot,hand){
      const owner = puppets.get(slot);
      const heldBody = owner ? handBody(owner,hand) : null;
      let best = null;
      for(const p of puppets.values()){
        for(const part of ATTACHABLE_PARTS){
          const body = p[part];
          if(!body || body === heldBody) continue;
          const hit = closestPointOnBody(body,prop.body.position);
          const distance = Math.hypot(prop.body.position.x-hit.x,prop.body.position.y-hit.y);
          if(distance <= 46 && (!best || distance < best.distance)){
            best = {slot:p.slot,part,body,point:hit,distance};
          }
        }
      }
      return best;
    }
    function localOffset(body,world){
      return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);
    }
    function worldOffset(body,local){
      const r = Vector.rotate(local,body.angle);
      return {x:body.position.x+r.x,y:body.position.y+r.y};
    }

    return {
      handBody,handPoint,propGripLocalPoint,validPropEffector,gripKey,
      ATTACHABLE_PARTS,puppetPartForBody,propForBody,closestPointOnBody,
      nearestBalloonTarget,localOffset,worldOffset
    };
  }

  global.PuppetalkPropGeometry={create};
})(typeof window!=='undefined'?window:globalThis);
