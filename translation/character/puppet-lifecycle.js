(function(global){
  'use strict';

  function create({puppets,props,releaseAllPropGrips,detachPropAttachment,Composite,engine}){
    if(!puppets || !props || typeof releaseAllPropGrips !== 'function' ||
       typeof detachPropAttachment !== 'function' || !Composite || !engine) return null;

    function removePuppet(slot){
      const p = puppets.get(slot);
      if(!p) return;
      releaseAllPropGrips(slot);
      props.forEach(prop=>{ if(prop.attachedTo?.slot === slot) detachPropAttachment(prop); });
      [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));
      puppets.delete(slot);
    }

    return {removePuppet};
  }

  global.PuppetalkPuppetLifecycle={create};
})(typeof window!=='undefined'?window:globalThis);
