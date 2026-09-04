// Puppetalk special item pass.
// Starts the table clean and lets each player bring one assigned prop into the shared scene.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_ITEM_POLISH_V1') || source.includes('PUPPETALK_SPECIAL_ITEMS_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_ITEM_POLISH_V1',
      '  // PUPPETALK_ITEM_POLISH_V1\n  // PUPPETALK_SPECIAL_ITEMS_V1'
    );

    const registryNeedle = `  const props = new Map();
  const propGrips = new Map();
  let nextPropId = 1;`;
    const registryCode = `  const props = new Map();
  const propGrips = new Map();
  let nextPropId = 1;
  const specialItems = new Map();
  const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];`;
    if(!source.includes(registryNeedle)) throw new Error('Special item patch failed: prop registries');
    source = source.replace(registryNeedle,registryCode);

    // Do not replace everything between ensureTestProps and driveProps: other item
    // layers deliberately insert helpers there. Keep the old test-spawn function as
    // dormant reference code and make the production entry point empty instead.
    const testNeedle = `  function ensureTestProps(){`;
    const testCode = `  function ensureTestProps(){
    // A normal table begins empty; players introduce their own item deliberately.
  }
  function ensureLegacyTestProps(){`;
    if(!source.includes(testNeedle)) throw new Error('Special item patch failed: initial prop packing');
    source = source.replace(testNeedle,testCode);

    const helperNeedle = `  function makePuppet(slot){`;
    const helpers = `  function specialItemLabel(type){
    if(type === 'frisbee') return 'Laser frisbee';
    if(type === 'pump') return 'Balloon pump';
    if(type === 'ball') return 'Ball';
    if(type === 'dart') return 'Dart';
    return 'Item';
  }
  function specialItemType(slot){
    return SPECIAL_ITEM_BY_SLOT[Math.max(0,Number(slot)||0)%SPECIAL_ITEM_BY_SLOT.length] || 'ball';
  }
  function specialItemStillOut(slot){
    const id = specialItems.get(slot);
    return !!(id && props.has(id));
  }
  function bringOutSpecialItem(slot){
    const p = puppets.get(slot);
    if(!p) return {ok:false,message:'Your puppet is not ready yet.'};
    const type = specialItemType(slot);
    if(specialItemStillOut(slot)) return {ok:false,alreadyOut:true,type,message:specialItemLabel(type)+' is already out.'};

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
    const result = bringOutSpecialItem(slot);
    send(conns.get(slot),{type:'special-item-result',...result});
  }

${helperNeedle}`;
    if(!source.includes(helperNeedle)) throw new Error('Special item patch failed: stage helpers');
    source = source.replace(helperNeedle,helpers);

    const listenerNeedle = `    conn.on('data',msg=>handlePropInput(slot,msg));`;
    const listenerCode = `    conn.on('data',msg=>handlePropInput(slot,msg));
    conn.on('data',msg=>handleSpecialItemInput(slot,msg));`;
    if(!source.includes(listenerNeedle)) throw new Error('Special item patch failed: stage input');
    source = source.replace(listenerNeedle,listenerCode);

    const footerNeedle = `      <div class="controller-footer">
        <button id="centre">Centre me</button>`;
    const footerCode = `      <div class="controller-footer">
        <button id="special-item" class="primary" type="button">Special item</button>
        <button id="centre">Centre me</button>`;
    if(!source.includes(footerNeedle)) throw new Error('Special item patch failed: controller button');
    source = source.replace(footerNeedle,footerCode);

    const transmitNeedle = `  function transmit(force=false){`;
    const controllerHelpers = `  function controllerSpecialType(){
    if(slot === null) return null;
    const items = ['frisbee','pump','ball','dart','frisbee','pump'];
    return items[Math.max(0,slot)%items.length] || 'ball';
  }
  function controllerSpecialLabel(type){
    if(type === 'frisbee') return 'Laser frisbee';
    if(type === 'pump') return 'Balloon pump';
    if(type === 'ball') return 'Ball';
    if(type === 'dart') return 'Dart';
    return 'Item';
  }
  function updateSpecialItemButton(isOut=false){
    const button = document.querySelector('#special-item');
    if(!button) return;
    const type = controllerSpecialType();
    if(!type){ button.textContent='Special item'; button.disabled=true; return; }
    const label = controllerSpecialLabel(type);
    button.disabled=!!isOut;
    button.textContent = isOut ? label+' is out' : 'Bring out '+label;
  }
  function bringOutMySpecialItem(){
    if(!conn?.open || slot === null) return;
    send(conn,{type:'special-item',action:'bring-out'});
  }

${transmitNeedle}`;
    if(!source.includes(transmitNeedle)) throw new Error('Special item patch failed: controller helpers');
    source = source.replace(transmitNeedle,controllerHelpers);

    const welcomeNeedle = `          slot = msg.slot;
          setStatus(`;
    const welcomeCode = `          slot = msg.slot;
          updateSpecialItemButton(false);
          setStatus(`;
    if(!source.includes(welcomeNeedle)) throw new Error('Special item patch failed: welcome state');
    source = source.replace(welcomeNeedle,welcomeCode);

    const messageNeedle = `        if(msg?.type === 'full'){`;
    const messageCode = `        if(msg?.type === 'special-item-result'){
          hint.classList.remove('quiet');
          hint.textContent = msg.message || 'Special item updated.';
          if(msg.ok || msg.alreadyOut) updateSpecialItemButton(true);
          setTimeout(()=>hint.classList.add('quiet'),1700);
        }
        if(msg?.type === 'full'){`;
    if(!source.includes(messageNeedle)) throw new Error('Special item patch failed: result handling');
    source = source.replace(messageNeedle,messageCode);

    const buttonNeedle = `  document.querySelector('#retry').addEventListener('click',connect);`;
    const buttonCode = `  document.querySelector('#retry').addEventListener('click',connect);
  document.querySelector('#special-item')?.addEventListener('click',bringOutMySpecialItem);
  updateSpecialItemButton(false);`;
    if(!source.includes(buttonNeedle)) throw new Error('Special item patch failed: button listener');
    source = source.replace(buttonNeedle,buttonCode);

    return source;
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
