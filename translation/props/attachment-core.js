(function(global){
  'use strict';

  function create({Vector,Body,performance,cancelPropContest,releasePropHolder,localOffset:providedLocalOffset,worldOffset:providedWorldOffset}){
    const localOffset = providedLocalOffset || (Vector ? function(body,world){
      return Vector.rotate({x:world.x-body.position.x,y:world.y-body.position.y},-body.angle);
    } : null);
    const worldOffset = providedWorldOffset || (Vector ? function(body,local){
      const r = Vector.rotate(local,body.angle);
      return {x:body.position.x+r.x,y:body.position.y+r.y};
    } : null);
    if(!Body || !performance || typeof cancelPropContest !== 'function' || typeof releasePropHolder !== 'function' ||
       typeof localOffset !== 'function' || typeof worldOffset !== 'function') return null;

    function attachPropToBody(prop,target){
      if(!prop || !target?.body || prop.attachedTo) return false;
      cancelPropContest(prop);
      if(prop.heldBy) releasePropHolder(prop,false);
      prop.attachedTo = {
        slot:target.slot,
        part:target.part,
        body:target.body,
        offset:localOffset(target.body,prop.body.position),
        angle:(prop.body.angle||0)-(target.body.angle||0)
      };
      Body.setStatic(prop.body,true);
      prop.body.collisionFilter.mask = 0;
      return true;
    }
    function detachPropAttachment(prop){
      const a = prop?.attachedTo;
      if(!a) return false;
      const inherited = a.body?.velocity ? {x:a.body.velocity.x,y:a.body.velocity.y} : {x:0,y:0};
      prop.attachedTo = null;
      prop.body.collisionFilter.mask = 0xFFFFFFFF;
      Body.setStatic(prop.body,false);
      Body.setVelocity(prop.body,inherited);
      return true;
    }
    function syncAttachedProp(prop){
      const a = prop?.attachedTo;
      if(!a?.body) return;
      if(a.mode === 'balloon'){
        const anchor = worldOffset(a.body,a.offset);
        const now = performance.now();
        const sway = Math.sin(now*.0016+(a.phase||0))*7;
        Body.setPosition(prop.body,{x:anchor.x+sway,y:anchor.y-(a.stringLength||62)});
        Body.setAngle(prop.body,Math.sin(now*.0013+(a.phase||0))*.06);
        return;
      }
      Body.setPosition(prop.body,worldOffset(a.body,a.offset));
      Body.setAngle(prop.body,(a.body.angle||0)+a.angle);
    }

    return {localOffset,worldOffset,attachPropToBody,detachPropAttachment,syncAttachedProp};
  }

  global.PuppetalkPropAttachmentCore={create};
})(typeof window!=='undefined'?window:globalThis);
