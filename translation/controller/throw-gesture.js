(function(root){
  'use strict';

  const THROW_SAMPLE_MS = 145;
  const THROW_MIN_SPEED = .62;

  function create({canvas,activePointers,heldProp,pointerToWorld,getConn,getSlot,send,now,queueTask}){
    const throwGestures = new Map();

    function sampleThrowGesture(gesture,x,y,at){
      gesture.samples.push({x,y,t:at});
      const cutoff = at-THROW_SAMPLE_MS*1.8;
      while(gesture.samples.length > 2 && gesture.samples[0].t < cutoff) gesture.samples.shift();
      if(gesture.samples.length > 10) gesture.samples.splice(0,gesture.samples.length-10);
    }

    function releaseVector(gesture,x,y,at){
      sampleThrowGesture(gesture,x,y,at);
      const samples = gesture.samples;
      let start = samples[0];
      for(const s of samples){
        if(at-s.t <= THROW_SAMPLE_MS) { start = s; break; }
      }
      const dt = Math.max(.035,(at-start.t)/1000);
      return {vx:(x-start.x)/dt,vy:(y-start.y)/dt};
    }

    function handForGrabPart(part){
      return part === 'leftHand' ? 'left'
        : part === 'rightHand' ? 'right'
        : part === 'leftFoot' ? 'leftFoot'
        : part === 'rightFoot' ? 'rightFoot'
        : null;
    }

    function beginThrow(event){
      queueTask(()=>{
        const grab = activePointers.get(event.pointerId);
        if(!grab) return;
        const hand = handForGrabPart(grab.part);
        if(!hand) return;
        if(!heldProp(hand)) return;
        const at = now();
        throwGestures.set(event.pointerId,{hand,samples:[{x:grab.x,y:grab.y,t:at}]});
      });
    }

    function moveThrow(event){
      const gesture = throwGestures.get(event.pointerId);
      if(!gesture) return;
      const p = pointerToWorld(event);
      sampleThrowGesture(gesture,p.x,p.y,now());
    }

    function finishThrow(event){
      const gesture = throwGestures.get(event.pointerId);
      if(!gesture) return;
      throwGestures.delete(event.pointerId);
      const conn = getConn();
      const slot = getSlot();
      if(!heldProp(gesture.hand) || !conn?.open || slot === null) return;
      const p = pointerToWorld(event);
      const v = releaseVector(gesture,p.x,p.y,now());
      const speed = Math.hypot(v.vx,v.vy);
      if(speed < THROW_MIN_SPEED) return;
      send(conn,{type:'prop',action:'throw',hand:gesture.hand,vx:v.vx,vy:v.vy});
    }

    function cancelThrow(event){
      throwGestures.delete(event.pointerId);
    }

    function install(){
      canvas.addEventListener('pointerdown',beginThrow);
      canvas.addEventListener('pointermove',moveThrow);
      canvas.addEventListener('pointerup',finishThrow);
      canvas.addEventListener('pointercancel',cancelThrow);
    }

    return {
      THROW_SAMPLE_MS,THROW_MIN_SPEED,throwGestures,
      sampleThrowGesture,releaseVector,handForGrabPart,
      beginThrow,moveThrow,finishThrow,cancelThrow,install
    };
  }

  root.PuppetalkControllerThrowGesture = {create,THROW_SAMPLE_MS,THROW_MIN_SPEED};
})(typeof window !== 'undefined' ? window : globalThis);
