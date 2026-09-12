// Puppetalk prop/layout fit pass.
// Keeps prop drawing on the same projection scale as the puppet, puts the pump
// balloon on the drawn nozzle, and moves the physical ceiling into the phone's
// visually unused upper space while making it thick enough to resist tunnelling.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if(window.PuppetalkPropLayoutTuning) return;

  function patch(source){
    if(typeof source !== 'string' || !source.includes('PUPPETALK_PROP_SIZE_TUNING_V2') || source.includes('PUPPETALK_PROP_LAYOUT_TUNING_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_PROP_SIZE_TUNING_V2',
      '  // PUPPETALK_PROP_SIZE_TUNING_V2\n  // PUPPETALK_PROP_LAYOUT_TUNING_V1'
    );

    // Props are source-world objects just like puppet anatomy. The old renderer
    // multiplied projection scale by 1.9, making every prop look nearly twice as
    // large as its actual Matter body on a phone.
    const propScaleNeedle = '  const s = Math.max(.72,scale*1.9);';
    const propScaleCode = '  const s = Math.max(.52,scale);';
    if(source.includes(propScaleNeedle)) source = source.replace(propScaleNeedle,propScaleCode);
    else console.warn('Prop layout tuning: drawProp scale hook not found.');

    // The pump drawing ends its diagonal nozzle at local (31,-29). Keep the
    // balloon's knot on that point as it grows by moving the balloon centre upward
    // by its rendered lower radius instead of pretending the nozzle is above centre.
    const nozzleNeedle = `  function pumpNozzleOffset(scale){
    return {x:0,y:-34-18*Math.max(.34,scale||.34)};
  }`;
    const nozzleCode = `  function pumpNozzleOffset(scale){
    const balloonScale = Math.max(.34,scale||.34);
    return {x:31,y:-29-22*balloonScale};
  }`;
    if(source.includes(nozzleNeedle)) source = source.replace(nozzleNeedle,nozzleCode);
    else console.warn('Prop layout tuning: pump nozzle hook not found.');

    // The controller projection deliberately shows sky above source-world y=0.
    // A ceiling at y=0 therefore appears much too low on the phone. Extend the
    // physical world upward, and use a deep off-screen slab so fast-thrown props
    // cannot hop through and come to rest on its far side.
    const boundsNeedle = `    bounds = [
      Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
      Bodies.rectangle(W/2,-22,W+160,44,{isStatic:true,friction:.65}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];`;
    const boundsCode = `    const ceilingY = -Math.max(160,H*.32);
    bounds = [
      Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
      Bodies.rectangle(W/2,ceilingY-160,W+240,320,{isStatic:true,friction:.65}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];`;
    if(source.includes(boundsNeedle)) source = source.replace(boundsNeedle,boundsCode);
    else console.warn('Prop layout tuning: ceiling boundary hook not found.');

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

  window.PuppetalkPropLayoutTuning = {version:1};
})();
