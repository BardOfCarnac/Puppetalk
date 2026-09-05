(function(root){
  'use strict';

  const SPECIAL_ITEM_TYPES = ['frisbee','pump','ball','dart'];
  const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];

  function create({
    specialItems,props,puppets,conns,send,makeProp,grabWorldPoint,clamp,getDimensions
  }){
    function specialItemLabel(type){
      if(type === 'frisbee') return 'Laser frisbee';
      if(type === 'pump') return 'Balloon pump';
      if(type === 'ball') return 'Ball';
      if(type === 'dart') return 'Sticky darts';
      return 'Item';
    }

    function specialItemType(slot,requested){
      if(SPECIAL_ITEM_TYPES.includes(requested)) return requested;
      return SPECIAL_ITEM_BY_SLOT[Math.max(0,Number(slot)||0)%SPECIAL_ITEM_BY_SLOT.length] || 'ball';
    }

    function specialItemStillOut(slot){
      const id = specialItems.get(slot);
      return !!(id && props.has(id));
    }

    function bringOutSpecialItem(slot,requested){
      const p = puppets.get(slot);
      if(!p) return {ok:false,message:'Your puppet is not ready yet.'};
      const type = specialItemType(slot,requested);
      if(specialItemStillOut(slot)) return {ok:false,alreadyOut:true,type,message:specialItemLabel(type)+' is already out.'};

      const {W,H} = getDimensions();
      let x = p.torso.position.x + (slot%2 ? -72 : 72);
      let y = p.torso.position.y - 8;
      if(type === 'pump'){
        x = clamp(x,52,W-52);
        y = H-68;
      }else{
        const hand = grabWorldPoint(p,'rightHand');
        x = clamp(hand.x + (slot%2 ? -34 : 34),30,W-30);
        y = clamp(hand.y-8,46,H-54);
      }
      const prop = makeProp(type,x,y);
      prop.specialOwner = slot;
      specialItems.set(slot,prop.id);
      return {ok:true,type,propId:prop.id,message:'Brought out '+specialItemLabel(type)+'.'};
    }

    function handleSpecialItemInput(slot,msg){
      if(msg?.type !== 'special-item' || msg.action !== 'bring-out') return;
      const result = bringOutSpecialItem(slot,msg.item);
      send(conns.get(slot),{type:'special-item-result',...result});
    }

    return {
      specialItemLabel,specialItemType,specialItemStillOut,bringOutSpecialItem,handleSpecialItemInput
    };
  }

  root.PuppetalkSpecialItems = {SPECIAL_ITEM_TYPES,SPECIAL_ITEM_BY_SLOT,create};
})(typeof window !== 'undefined' ? window : globalThis);
