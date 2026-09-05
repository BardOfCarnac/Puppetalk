(function(global){
  'use strict';

  function create({getDimensions,worldOffset,clamp}={}){
    if(typeof getDimensions !== 'function' || typeof worldOffset !== 'function' || typeof clamp !== 'function') return null;

    function balloonAttachmentState(prop){
      const a = prop?.attachedTo;
      if(!a) return null;
      const {W,H} = getDimensions();
      const anchor = a.body ? worldOffset(a.body,a.offset) : null;
      return {
        slot:a.slot,
        part:a.part,
        mode:a.mode || 'embedded',
        anchor:anchor ? {x:anchor.x/W,y:anchor.y/H} : null
      };
    }

    function propState(prop){
      const {W,H} = getDimensions();
      const b = prop.body;
      return {
        id:prop.id,
        type:prop.type,
        depth:Number.isFinite(prop._depth) ? prop._depth : undefined,
        throwerSlot:Number.isInteger(prop._throwerSlot) ? prop._throwerSlot : undefined,
        armed:prop.type === 'frisbee' ? !!prop._cutArmed : undefined,
        inflation:prop.type === 'balloon' ? (prop._inflation||0) : undefined,
        scale:prop.type === 'balloon' ? (prop._renderScale||1) : undefined,
        pumpBalloon:prop.type === 'pump' ? (prop._balloonId||null) : undefined,
        x:b.position.x/W,
        y:b.position.y/H,
        a:b.angle || 0,
        heldBy:prop.heldBy ? {slot:prop.heldBy.slot,hand:prop.heldBy.hand} : null,
        contestedBy:prop.contest ? {slot:prop.contest.slot,hand:prop.contest.hand} : null,
        tug:prop.contest ? clamp(prop.contest.score,0,1) : 0,
        attachedTo:balloonAttachmentState(prop)
      };
    }

    return {balloonAttachmentState,propState};
  }

  global.PuppetalkPropState = {create};
})(typeof window !== 'undefined' ? window : globalThis);
