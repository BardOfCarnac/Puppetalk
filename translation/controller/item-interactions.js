(function(root){
  'use strict';

  function create(options={}){
    const {
      document,canvas,send,getConn,getSlot,getPropScene,getScene,getDimensions,
      getMyPuppet,seatProjection,displayPoint,storage
    }=options;
    if(!document || !canvas || !send || !getConn || !getSlot || !getPropScene || !getScene || !getDimensions || !getMyPuppet || !seatProjection) return null;

    function controllerSpecialType(){
      const valid=['frisbee','pump','ball','dart'];
      try{
        const saved=storage?.getItem?.('puppetalk-special-item');
        if(valid.includes(saved)) return saved;
      }catch{}
      const slot=getSlot();
      if(slot===null) return null;
      const fallback=['frisbee','pump','ball','dart','frisbee','pump'];
      return fallback[Math.max(0,slot)%fallback.length]||'ball';
    }

    function controllerSpecialLabel(type){
      if(type==='frisbee') return 'Laser frisbee';
      if(type==='pump') return 'Balloon pump';
      if(type==='ball') return 'Ball';
      if(type==='dart') return 'Sticky darts';
      return 'Item';
    }

    function updateSpecialItemButton(isOut=false){
      const button=document.querySelector('#special-item');
      if(!button) return;
      const type=controllerSpecialType();
      if(!type){button.textContent='Special item';button.disabled=true;return;}
      const label=controllerSpecialLabel(type);
      button.disabled=!!isOut;
      button.textContent=isOut?label+' is out':'Bring out '+label;
    }

    function bringOutMySpecialItem(){
      const conn=getConn(),slot=getSlot();
      if(!conn?.open || slot===null) return;
      send(conn,{type:'special-item',action:'bring-out',item:controllerSpecialType()});
    }

    function heldProp(hand){
      const slot=getSlot();
      return getPropScene().find(prop=>prop?.heldBy?.slot===slot && prop?.heldBy?.hand===hand);
    }

    function updateGripButtons(){
      const left=document.querySelector('#grip-left');
      const right=document.querySelector('#grip-right');
      if(left) left.textContent=heldProp('left')?'Drop L':'Grip L';
      if(right) right.textContent=heldProp('right')?'Drop R':'Grip R';
    }

    function toggleGrip(hand){
      const conn=getConn(),slot=getSlot();
      if(!conn?.open || slot===null) return;
      send(conn,{type:'prop',action:'toggleGrip',hand});
    }

    function propDisplayPoint(q){
      const {cw,ch}=getDimensions();
      return typeof displayPoint==='function'?displayPoint(q,cw,ch):{x:q.x*cw,y:q.y*ch};
    }

    function pickTappedProp(event){
      const rect=canvas.getBoundingClientRect();
      const px=event.clientX-rect.left;
      const py=event.clientY-rect.top;
      let best=null;
      const viewProps=seatProjection(getScene(),getPropScene(),getSlot()).props;
      for(const prop of viewProps){
        const q=propDisplayPoint(prop);
        const radius=prop.type==='frisbee'?48:prop.type==='pump'?44:prop.type==='balloon'?38:prop.type==='ball'?34:32;
        const distance=Math.hypot(px-q.x,py-q.y);
        if(distance<=radius && (!best || distance<best.distance)) best={prop,distance};
      }
      return best?.prop||null;
    }

    function nearestPropHand(prop){
      const mine=getMyPuppet();
      if(!mine) return null;
      const q=propDisplayPoint(prop);
      const candidates=[
        {hand:'left',point:mine.wl},
        {hand:'right',point:mine.wr},
        {hand:'leftFoot',point:mine.al},
        {hand:'rightFoot',point:mine.ar}
      ];
      let best=null;
      for(const candidate of candidates){
        if(!candidate.point) continue;
        const p=propDisplayPoint(candidate.point);
        const distance=Math.hypot(p.x-q.x,p.y-q.y);
        if(!best || distance<best.distance) best={hand:candidate.hand,distance};
      }
      const reach=prop?.type==='frisbee'?118:88;
      if(!best || best.distance>reach) return null;
      return best.hand;
    }

    function handlePropTap(event){
      const prop=pickTappedProp(event);
      if(!prop) return;
      const conn=getConn(),slot=getSlot();

      if(prop.type==='pump'){
        event.preventDefault();
        event.stopImmediatePropagation();
        if(conn?.open && slot!==null) send(conn,{type:'prop',action:'pump',propId:prop.id});
        return;
      }
      if(prop.type==='balloon' && prop.attachedTo?.mode==='pump'){
        event.preventDefault();
        event.stopImmediatePropagation();
        if(conn?.open && slot!==null) send(conn,{type:'prop',action:'release-pump-balloon',propId:prop.id});
        return;
      }
      if(prop.heldBy?.slot===slot) return;

      const hand=nearestPropHand(prop);
      if(!hand) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot!==null) send(conn,{type:'prop',action:'tap',propId:prop.id,hand});
    }

    function installPropTap(){
      canvas.addEventListener('pointerdown',handlePropTap,true);
    }

    function installButtons(){
      document.querySelector('#special-item')?.addEventListener('click',bringOutMySpecialItem);
      document.querySelector('#grip-left')?.addEventListener('click',()=>toggleGrip('left'));
      document.querySelector('#grip-right')?.addEventListener('click',()=>toggleGrip('right'));
    }

    return {
      controllerSpecialType,controllerSpecialLabel,updateSpecialItemButton,bringOutMySpecialItem,
      heldProp,updateGripButtons,toggleGrip,propDisplayPoint,pickTappedProp,nearestPropHand,
      handlePropTap,installPropTap,installButtons
    };
  }

  root.PuppetalkControllerItems={create};
})(typeof window!=='undefined'?window:globalThis);
