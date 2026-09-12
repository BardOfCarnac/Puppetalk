// Puppetalk prop size tuning.
// Keeps interaction reach generous, makes the laser frisbee and huge sword
// physically/visually smaller, and keeps all props on the puppet projection scale.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if(window.PuppetalkPropSizeTuning) return;

  function patch(source){
    if(typeof source !== 'string' || !source.includes('PUPPETALK_EXPANDED_ITEMS_V1') || source.includes('PUPPETALK_PROP_SIZE_TUNING_V3')) return source;

    source = source.replace(
      '  // PUPPETALK_EXPANDED_ITEMS_V1',
      '  // PUPPETALK_EXPANDED_ITEMS_V1\n  // PUPPETALK_PROP_SIZE_TUNING_V3'
    );

    // Props live in the same source-world coordinate system as the puppet. The
    // legacy drawProp multiplier made them nearly twice as large on controllers.
    source = source.split('  const s = Math.max(.72,scale*1.9);')
      .join('  const s = Math.max(.52,scale);');

    // Laser frisbee: ~17% smaller. Match the physical disc, grip point,
    // edge-speed radius and painted disc so cuts still feel spatially honest.
    source = source.split("Bodies.circle(x,y,23,{density:.00062,restitution:.72,friction:.18,frictionAir:.004})")
      .join("Bodies.circle(x,y,19,{density:.00062,restitution:.72,friction:.18,frictionAir:.004})");
    source = source.split("gripPoint = {x:-15,y:0};").join("gripPoint = {x:-12,y:0};");
    source = source.split('linear+spin*23').join('linear+spin*19');
    source = source.split('distance <= 13').join('distance <= 11');

    const frisbeeDraw = `  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d7dce2';ctx.beginPath();ctx.arc(0,0,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111317';ctx.beginPath();ctx.arc(0,0,11*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.armed?'#ff4b5c':'rgba(255,255,255,.46)';
    ctx.lineWidth=Math.max(2,2.7*s);ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=p.armed?'#ff7b86':'rgba(20,20,20,.62)';ctx.lineWidth=Math.max(1,1.3*s);
    ctx.beginPath();ctx.moveTo(-15*s,0);ctx.lineTo(15*s,0);ctx.stroke();`;
    const frisbeeDrawSmall = `  }else if(p.type === 'frisbee'){
    ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,20*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d7dce2';ctx.beginPath();ctx.arc(0,0,17*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111317';ctx.beginPath();ctx.arc(0,0,9*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.armed?'#ff4b5c':'rgba(255,255,255,.46)';
    ctx.lineWidth=Math.max(2,2.4*s);ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=p.armed?'#ff7b86':'rgba(20,20,20,.62)';ctx.lineWidth=Math.max(1,1.2*s);
    ctx.beginPath();ctx.moveTo(-12*s,0);ctx.lineTo(12*s,0);ctx.stroke();`;
    if(source.includes(frisbeeDraw)) source = source.replace(frisbeeDraw,frisbeeDrawSmall);
    else console.warn('Prop size tuning: frisbee renderer block not found.');

    // Huge sword: still deliberately cumbersome, but no longer almost as long as
    // the puppet's whole body. Physics and renderer are reduced together.
    source = source.split("Bodies.rectangle(x,y,106,12,{density:.0036,restitution:.08,friction:.46,frictionAir:.003,chamfer:{radius:3}})")
      .join("Bodies.rectangle(x,y,88,11,{density:.0036,restitution:.08,friction:.46,frictionAir:.003,chamfer:{radius:3}})");
    source = source.split("gripPoint = {x:-43,y:0};").join("gripPoint = {x:-35,y:0};");
    source = source.split("Math.abs(prop.body.angularVelocity||0)*52").join("Math.abs(prop.body.angularVelocity||0)*43");
    source = source.split("roundRect(ctx,-52*s,-7*s,104*s,14*s,3*s)").join("roundRect(ctx,-43*s,-6*s,86*s,12*s,3*s)");
    source = source.split("roundRect(ctx,-35*s,-4*s,86*s,8*s,2*s)").join("roundRect(ctx,-29*s,-3.5*s,71*s,7*s,2*s)");
    source = source.split("roundRect(ctx,-45*s,-11*s,7*s,22*s,2*s)").join("roundRect(ctx,-37*s,-9*s,6*s,18*s,2*s)");
    source = source.split("roundRect(ctx,-53*s,-5*s,13*s,10*s,3*s)").join("roundRect(ctx,-44*s,-4*s,11*s,8*s,3*s)");

    return source;
  }

  window.fetch = async (...args) => {
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

  window.PuppetalkPropSizeTuning = {version:3,frisbeeRadius:19,swordLength:88,projectionScale:true};
})();
