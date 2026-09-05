(function(root){
  'use strict';

  function create(options={}){
    const {
      canvas,ctx,hint,input,clamp,getScene,getPropScene,getSlot,getDimensions,
      drawBackdrop,seatProjection,drawProp,drawAnatomy,transmit,cancelCentre
    }=options;
    if(!canvas || !ctx || !hint || !input || !clamp || !getScene || !getPropScene || !getSlot || !getDimensions || !drawBackdrop || !seatProjection || !drawProp || !drawAnatomy || !transmit || !cancelCentre) return null;

    const activePointers=new Map();

    function syncGrabs(){
      input.grabs=[...activePointers.values()].slice(0,2).map(g=>({part:g.part,x:g.x,y:g.y}));
    }

    function myPuppet(){
      const slot=getSlot();
      return getScene().find(p=>p.slot===slot);
    }

    function grabSpots(p){
      if(!p) return [];
      const pelvis={x:(p.hl.x+p.hr.x)*.5,y:(p.hl.y+p.hr.y)*.5};
      return [
        {part:'head',label:'head',q:p.head,r:40},
        {part:'leftShoulder',label:'left shoulder',q:p.sl,r:31},
        {part:'rightShoulder',label:'right shoulder',q:p.sr,r:31},
        {part:'leftHand',label:'left hand',q:p.wl,r:32},
        {part:'rightHand',label:'right hand',q:p.wr,r:32},
        {part:'leftFoot',label:'left foot',q:p.al,r:32},
        {part:'rightFoot',label:'right foot',q:p.ar,r:32},
        {part:'pelvis',label:'pelvis',q:pelvis,r:42},
        {part:'torso',label:'body',q:p.torso,r:50}
      ];
    }

    function renderGrabHandles(p){
      if(!p) return;
      const {cw,ch}=getDimensions();
      const active=new Set([...activePointers.values()].map(g=>g.part));
      ctx.save();
      grabSpots(p).forEach(spot=>{
        const x=spot.q.x*cw;
        const y=spot.q.y*ch;
        const selected=active.has(spot.part);
        ctx.beginPath();
        ctx.arc(x,y,selected?12:6.5,0,Math.PI*2);
        ctx.fillStyle=selected?'rgba(255,255,255,.26)':'rgba(255,255,255,.065)';
        ctx.fill();
        ctx.strokeStyle=selected?'rgba(255,255,255,.96)':'rgba(255,255,255,.25)';
        ctx.lineWidth=selected?2:1;
        ctx.stroke();
      });
      ctx.restore();
    }

    function renderPersonalScene(){
      const {cw,ch}=getDimensions();
      const scene=getScene();
      const propScene=getPropScene();
      const slot=getSlot();
      drawBackdrop(ctx,cw,ch);
      const view=seatProjection(scene,propScene,slot);
      view.props.forEach(prop=>drawProp(ctx,prop,cw,ch));
      if(!view.puppets.length) return;
      view.puppets.filter(p=>p.slot!==slot).forEach(p=>drawAnatomy(ctx,p,cw,ch,false,.48));
      const mine=view.puppets.find(p=>p.slot===slot);
      if(mine){
        drawAnatomy(ctx,mine,cw,ch,true,1);
        renderGrabHandles(mine);
      }
    }

    function pointerToWorld(event){
      const rect=canvas.getBoundingClientRect();
      return {
        x:clamp((event.clientX-rect.left)/rect.width,.02,.98),
        y:clamp((event.clientY-rect.top)/rect.height,.08,.94)
      };
    }

    function pickGrab(event){
      const mine=myPuppet();
      if(!mine) return null;
      const rect=canvas.getBoundingClientRect();
      const px=event.clientX-rect.left;
      const py=event.clientY-rect.top;
      let best=null;
      const occupied=new Set([...activePointers.values()].map(g=>g.part));
      for(const spot of grabSpots(mine)){
        if(occupied.has(spot.part)) continue;
        const x=spot.q.x*rect.width;
        const y=spot.q.y*rect.height;
        const distance=Math.hypot(px-x,py-y);
        if(distance<=spot.r && (!best || distance<best.distance)) best={...spot,distance};
      }
      return best;
    }

    function describeActiveGrabs(){
      const labels=[...activePointers.values()].map(g=>g.label);
      if(!labels.length) return 'Grab another part, or choose a pose';
      return 'Holding '+labels.join(' + ');
    }

    function pointerDown(event){
      if(activePointers.size>=2) return;
      const grab=pickGrab(event);
      if(!grab) return;
      cancelCentre();
      event.preventDefault();
      const p=pointerToWorld(event);
      activePointers.set(event.pointerId,{part:grab.part,label:grab.label,x:p.x,y:p.y});
      syncGrabs();
      canvas.setPointerCapture(event.pointerId);
      hint.classList.remove('quiet');
      hint.textContent=describeActiveGrabs();
      renderPersonalScene();
      transmit(true);
    }

    function pointerMove(event){
      const grab=activePointers.get(event.pointerId);
      if(!grab) return;
      event.preventDefault();
      const p=pointerToWorld(event);
      grab.x=p.x;
      grab.y=p.y;
      syncGrabs();
      transmit();
    }

    function stopPointer(event){
      if(!activePointers.has(event.pointerId)) return;
      activePointers.delete(event.pointerId);
      syncGrabs();
      hint.textContent=describeActiveGrabs();
      if(!activePointers.size) hint.classList.add('quiet');
      renderPersonalScene();
      transmit(true);
    }

    function install(){
      canvas.addEventListener('pointerdown',pointerDown);
      canvas.addEventListener('pointermove',pointerMove);
      canvas.addEventListener('pointerup',stopPointer);
      canvas.addEventListener('pointercancel',stopPointer);
    }

    return {
      activePointers,syncGrabs,myPuppet,grabSpots,renderGrabHandles,renderPersonalScene,
      pointerToWorld,pickGrab,describeActiveGrabs,pointerDown,pointerMove,stopPointer,install
    };
  }

  root.PuppetalkControllerPuppetry={create};
})(typeof window!=='undefined'?window:globalThis);
