// Puppetalk toy/prop source decorator.
// Adds shared Matter.js props and physical left/right hand grips without changing the core puppet rig.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function replaceOnce(source, find, replacement, label){
    if(!source.includes(find)) throw new Error(`Toy system patch failed: ${label}`);
    return source.replace(find, replacement);
  }

  function patch(source){
    if(!source.includes('function startStage(room)') || source.includes('PUPPETALK_TOY_SYSTEM_V1')) return source;

    source = replaceOnce(
      source,
      "  const puppets = new Map();\n  const conns = new Map();",
      `  const puppets = new Map();
  const conns = new Map();

  // PUPPETALK_TOY_SYSTEM_V1
  const props = new Map();
  const propGrips = new Map();
  let nextPropId = 1;`,
      'stage prop registries'
    );

    source = replaceOnce(
      source,
      `    bounds = [
      Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];`,
      `    bounds = [
      Bodies.rectangle(W/2,H+10,W+160,80,{isStatic:true,friction:.9}),
      Bodies.rectangle(W/2,-22,W+160,44,{isStatic:true,friction:.65}),
      Bodies.rectangle(-30,H/2,60,H*2,{isStatic:true}),
      Bodies.rectangle(W+30,H/2,60,H*2,{isStatic:true})
    ];`,
      'ceiling boundary'
    );

    source = replaceOnce(
      source,
      `  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

  function makePuppet(slot){`,
      `  const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
    bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
  });

  function makeProp(type,x,y){
    const id = \`prop-\${nextPropId++}\`;
    let body;
    let gripPoint = {x:0,y:0};
    if(type === 'ball'){
      body = Bodies.circle(x,y,16,{density:.0008,restitution:.9,friction:.24,frictionAir:.006});
    }else if(type === 'balloon'){
      body = Bodies.circle(x,y,18,{density:.00018,restitution:.38,friction:.18,frictionAir:.028});
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }
    body.label = \`puppetalk-prop:\${id}:\${type}\`;
    const prop = {id,type,body,gripPoint,heldBy:null};
    props.set(id,prop);
    Composite.add(engine.world,body);
    return prop;
  }

  function ensureTestProps(){
    if(props.size) return;
    const y = Math.max(82,Math.min(H*.38,H-180));
    makeProp('ball',W*.39,y);
    makeProp('dart',W*.55,y+22);
    makeProp('balloon',W*.69,y+46);
  }

  function driveProps(){
    props.forEach(prop=>{
      if(prop.type !== 'balloon') return;
      const b = prop.body;
      // Cancel gravity and leave a gentle net upward pull.
      Body.applyForce(b,b.position,{x:0,y:-b.mass*engine.gravity.y*engine.gravity.scale*1.42});
    });
  }

  function propState(prop){
    const b = prop.body;
    return {
      id:prop.id,
      type:prop.type,
      x:b.position.x/W,
      y:b.position.y/H,
      a:b.angle || 0,
      heldBy:prop.heldBy ? {slot:prop.heldBy.slot,hand:prop.heldBy.hand} : null
    };
  }

  function handBody(p,hand){ return hand === 'left' ? p.faL : p.faR; }
  function handPoint(p,hand){ return grabWorldPoint(p,hand === 'left' ? 'leftHand' : 'rightHand'); }
  const gripKey = (slot,hand)=>\`\${slot}:\${hand}\`;

  function releasePropGrip(slot,hand){
    const key = gripKey(slot,hand);
    const grip = propGrips.get(key);
    if(!grip) return false;
    Composite.remove(engine.world,grip.constraint);
    const prop = props.get(grip.propId);
    if(prop?.heldBy?.slot === slot && prop?.heldBy?.hand === hand) prop.heldBy = null;
    propGrips.delete(key);
    return true;
  }

  function releaseAllPropGrips(slot){
    releasePropGrip(slot,'left');
    releasePropGrip(slot,'right');
  }

  function togglePropGrip(slot,hand){
    if(hand !== 'left' && hand !== 'right') return {ok:false,message:'Choose a hand.'};
    if(releasePropGrip(slot,hand)) return {ok:true,held:false,message:\`Released \${hand} hand.\`};
    const p = puppets.get(slot);
    if(!p) return {ok:false,message:'Your puppet is not ready yet.'};
    const hp = handPoint(p,hand);
    let best = null;
    for(const prop of props.values()){
      if(prop.heldBy) continue;
      const d = Math.hypot(prop.body.position.x-hp.x,prop.body.position.y-hp.y);
      if(d <= 74 && (!best || d < best.distance)) best = {prop,distance:d};
    }
    if(!best) return {ok:false,message:\`Move your \${hand} hand closer to a prop.\`};
    const prop = best.prop;
    const constraint = Constraint.create({
      bodyA:handBody(p,hand),
      pointA:{x:0,y:23},
      bodyB:prop.body,
      pointB:prop.gripPoint || {x:0,y:0},
      length:3,
      stiffness:.9,
      damping:.18
    });
    Composite.add(engine.world,constraint);
    prop.heldBy = {slot,hand};
    propGrips.set(gripKey(slot,hand),{propId:prop.id,constraint});
    return {ok:true,held:true,propId:prop.id,type:prop.type,message:\`Gripped \${prop.type} with \${hand} hand.\`};
  }

  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop' || msg.action !== 'toggleGrip') return;
    const result = togglePropGrip(slot,msg.hand);
    send(conns.get(slot),{type:'prop-result',hand:msg.hand,...result});
  }

  function makePuppet(slot){`,
      'prop physics helpers'
    );

    source = replaceOnce(
      source,
      `  function removePuppet(slot){
    const p = puppets.get(slot);
    if(!p) return;
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));`,
      `  function removePuppet(slot){
    const p = puppets.get(slot);
    if(!p) return;
    releaseAllPropGrips(slot);
    [...p.bodies,...p.constraints].forEach(item=>Composite.remove(engine.world,item));`,
      'grip cleanup on disconnect'
    );

    source = replaceOnce(
      source,
      `  function drawStage(){
    drawBackdrop(ctx,W,H);
    puppets.forEach(p=>drawAnatomy(ctx,anatomy(p),W,H,false));
  }`,
      `  function drawStage(){
    drawBackdrop(ctx,W,H);
    props.forEach(prop=>drawProp(ctx,propState(prop),W,H));
    puppets.forEach(p=>drawAnatomy(ctx,anatomy(p),W,H,false));
  }`,
      'stage prop rendering'
    );

    source = replaceOnce(
      source,
      `    const scene = {type:'scene',puppets:[...puppets.values()].map(anatomy)};`,
      `    const scene = {type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)};`,
      'prop scene broadcast'
    );

    source = replaceOnce(
      source,
      `    puppets.forEach(drivePuppet);
    Engine.update(engine,dt);`,
      `    puppets.forEach(drivePuppet);
    driveProps();
    Engine.update(engine,dt);`,
      'prop simulation tick'
    );

    source = replaceOnce(
      source,
      `      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy)});`,
      `      send(conn,{type:'scene',puppets:[...puppets.values()].map(anatomy),props:[...props.values()].map(propState)});`,
      'initial prop scene'
    );

    source = replaceOnce(
      source,
      `    conn.on('data',msg=>applyInput(slot,msg));`,
      `    conn.on('data',msg=>applyInput(slot,msg));
    conn.on('data',msg=>handlePropInput(slot,msg));`,
      'prop network input'
    );

    source = replaceOnce(
      source,
      `  resize();
  requestAnimationFrame(tick);`,
      `  resize();
  ensureTestProps();
  requestAnimationFrame(tick);`,
      'test prop spawn'
    );

    source = replaceOnce(
      source,
      `      <div class="controller-footer">
        <button id="centre">Centre me</button>
        <button id="retry">Reconnect</button>
      </div>`,
      `      <div class="controller-footer">
        <button id="grip-left" type="button">Grip L</button>
        <button id="grip-right" type="button">Grip R</button>
        <button id="centre">Centre me</button>
        <button id="retry">Reconnect</button>
      </div>`,
      'grip controls'
    );

    source = replaceOnce(
      source,
      `  let scene = [];
  let micStop = null;`,
      `  let scene = [];
  let propScene = [];
  let micStop = null;`,
      'controller prop scene state'
    );

    source = replaceOnce(
      source,
      `  function transmit(force=false){
    if(!conn?.open) return;
    const body = JSON.stringify(input);
    if(!force && body === lastSent) return;
    lastSent = body;
    send(conn,{type:'input',input});
  }

  function connect(){`,
      `  function transmit(force=false){
    if(!conn?.open) return;
    const body = JSON.stringify(input);
    if(!force && body === lastSent) return;
    lastSent = body;
    send(conn,{type:'input',input});
  }

  function heldProp(hand){ return propScene.find(prop=>prop?.heldBy?.slot === slot && prop?.heldBy?.hand === hand); }
  function updateGripButtons(){
    const left = document.querySelector('#grip-left');
    const right = document.querySelector('#grip-right');
    if(left) left.textContent = heldProp('left') ? 'Drop L' : 'Grip L';
    if(right) right.textContent = heldProp('right') ? 'Drop R' : 'Grip R';
  }
  function toggleGrip(hand){
    if(!conn?.open || slot === null) return;
    send(conn,{type:'prop',action:'toggleGrip',hand});
  }

  function connect(){`,
      'controller grip helpers'
    );

    source = replaceOnce(
      source,
      `        if(msg?.type === 'scene'){
          scene = Array.isArray(msg.puppets) ? msg.puppets : [];
          renderPersonalScene();
        }
        if(msg?.type === 'full'){`,
      `        if(msg?.type === 'scene'){
          scene = Array.isArray(msg.puppets) ? msg.puppets : [];
          propScene = Array.isArray(msg.props) ? msg.props : [];
          updateGripButtons();
          renderPersonalScene();
        }
        if(msg?.type === 'prop-result'){
          hint.classList.remove('quiet');
          hint.textContent = msg.message || (msg.ok ? 'Prop grip updated.' : 'Could not grip prop.');
          if(msg.ok) setTimeout(()=>hint.classList.add('quiet'),1500);
        }
        if(msg?.type === 'full'){`,
      'controller prop messages'
    );

    source = replaceOnce(
      source,
      `  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    if(!scene.length) return;`,
      `  function renderPersonalScene(){
    drawBackdrop(ctx,cw,ch);
    propScene.forEach(prop=>drawProp(ctx,prop,cw,ch));
    if(!scene.length) return;`,
      'controller prop rendering'
    );

    source = replaceOnce(
      source,
      `  document.querySelector('#retry').addEventListener('click',connect);`,
      `  document.querySelector('#retry').addEventListener('click',connect);
  document.querySelector('#grip-left')?.addEventListener('click',()=>toggleGrip('left'));
  document.querySelector('#grip-right')?.addEventListener('click',()=>toggleGrip('right'));`,
      'grip button listeners'
    );

    source = replaceOnce(
      source,
      `function roundRect(ctx,x,y,w,h,r){`,
      `function drawProp(ctx,p,w,h){
  if(!p) return;
  const projected = typeof displayPoint === 'function' ? displayPoint({x:p.x,y:p.y},w,h) : {x:p.x*w,y:p.y*h};
  const scale = typeof projectionRenderScale === 'function' ? projectionRenderScale(w,h) : Math.min(w/900,h/650);
  const x = projected.x;
  const y = projected.y;
  const s = Math.max(.72,scale*1.9);
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(p.a || 0);
  ctx.lineCap = ctx.lineJoin = 'round';
  if(p.type === 'ball'){
    ctx.fillStyle = '#08090a';
    ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#f1c84c';
    ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,.55)';ctx.lineWidth = Math.max(1,1.5*s);
    ctx.beginPath();ctx.arc(0,0,8*s,-1.1,1.1);ctx.stroke();
  }else if(p.type === 'balloon'){
    ctx.strokeStyle = 'rgba(255,255,255,.45)';ctx.lineWidth = Math.max(1,s);
    ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();
    ctx.fillStyle = '#08090a';ctx.beginPath();ctx.ellipse(0,0,16*s,20*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.ellipse(0,0,13*s,17*s,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(-3*s,16*s);ctx.lineTo(3*s,16*s);ctx.lineTo(0,22*s);ctx.closePath();ctx.fill();
  }else{
    ctx.strokeStyle = '#08090a';ctx.lineWidth = Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();
    ctx.strokeStyle = '#e9edf2';ctx.lineWidth = Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(17*s,0);ctx.stroke();
    ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.moveTo(22*s,0);ctx.lineTo(13*s,-5*s);ctx.lineTo(13*s,5*s);ctx.closePath();ctx.fill();
  }
  if(p.heldBy){
    ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){`,
      'prop renderer'
    );

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    const patched = patch(text);
    return new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
