(function(root){
  'use strict';

  function create({props,makeProp,worldOffset,Body,syncAttachedProp,detachPropAttachment,now,random}){
    function pumpNozzleOffset(scale){
      return {x:0,y:-34-18*Math.max(.34,scale||.34)};
    }

    function ensurePumpBalloon(pump){
      if(!pump || pump.type !== 'pump') return null;
      const existing = pump._balloonId ? props.get(pump._balloonId) : null;
      if(existing) return existing;

      const offset = pumpNozzleOffset(.34);
      const nozzle = worldOffset(pump.body,offset);
      const balloon = makeProp('balloon',nozzle.x,nozzle.y);
      balloon._inflation = 0;
      balloon._renderScale = 1;
      balloon._pumpId = pump.id;
      balloon.attachedTo = {
        mode:'pump',pumpId:pump.id,part:'pump',slot:null,
        body:pump.body,offset,angle:0
      };
      Body.setStatic(balloon.body,true);
      balloon.body.collisionFilter.mask = 0;
      pump._balloonId = balloon.id;
      syncAttachedProp(balloon);
      return balloon;
    }

    function inflatePumpBalloon(pump){
      const balloon = ensurePumpBalloon(pump);
      if(!balloon) return {ok:false,message:'The pump is jammed.'};
      balloon._inflation = (balloon._inflation||0)+1;
      const targetScale = .45+.28*Math.sqrt(balloon._inflation);
      const previousScale = Math.max(.05,balloon._renderScale||1);
      const ratio = targetScale/previousScale;
      Body.scale(balloon.body,ratio,ratio);
      balloon._renderScale = targetScale;
      if(balloon.attachedTo?.mode === 'pump') balloon.attachedTo.offset = pumpNozzleOffset(targetScale);
      syncAttachedProp(balloon);
      pump._lastPumpAt = now();
      return {ok:true,message:'Pump '+balloon._inflation+' — balloon growing.'};
    }

    function releasePumpBalloon(balloon){
      if(!balloon || balloon.type !== 'balloon' || balloon.attachedTo?.mode !== 'pump') return false;
      const pump = props.get(balloon._pumpId || balloon.attachedTo?.pumpId);
      if(pump && pump._balloonId === balloon.id) pump._balloonId = null;
      balloon._pumpId = null;
      detachPropAttachment(balloon);
      Body.setVelocity(balloon.body,{x:(random()-.5)*.35,y:-1.15});
      return true;
    }

    return {pumpNozzleOffset,ensurePumpBalloon,inflatePumpBalloon,releasePumpBalloon};
  }

  root.PuppetalkPumpBalloon = {create};
})(typeof window !== 'undefined' ? window : globalThis);
