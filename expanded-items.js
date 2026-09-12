// Puppetalk expanded special-item pass.
// Adds the rest of the agreed prop roster without changing the core puppet rig.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(typeof source !== 'string' || !source.includes('PUPPETALK_SPECIAL_ITEMS_V1') || source.includes('PUPPETALK_EXPANDED_ITEMS_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_SPECIAL_ITEMS_V1',
      '  // PUPPETALK_SPECIAL_ITEMS_V1\n  // PUPPETALK_EXPANDED_ITEMS_V1'
    );

    const types = "['frisbee','pump','ball','dart','boomerang','dartgun','moonboots','sword']";
    source = source.replace("const SPECIAL_ITEM_TYPES = ['frisbee','pump','ball','dart'];",`const SPECIAL_ITEM_TYPES = ${types};`);
    source = source.replace("const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];",`const SPECIAL_ITEM_BY_SLOT = ${types};`);
    source = source.split("const valid = ['frisbee','pump','ball','dart'];").join(`const valid = ${types};`);
    source = source.split("const fallback = ['frisbee','pump','ball','dart','frisbee','pump'];").join(`const fallback = ${types};`);

    const labelNeedle = `    if(type === 'dart') return 'Sticky darts';\n    return 'Item';`;
    const labelCode = `    if(type === 'dart') return 'Sticky darts';
    if(type === 'boomerang') return 'Boomerang';
    if(type === 'dartgun') return 'Dart blaster';
    if(type === 'moonboots') return 'Moon boots';
    if(type === 'sword') return 'Huge sword';
    return 'Item';`;
    source = source.split(labelNeedle).join(labelCode);

    const bodyNeedle = `    }else if(type === 'pump'){
      body = Bodies.rectangle(x,y,44,60,{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});
      gripPoint = {x:0,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    const bodyCode = `    }else if(type === 'pump'){
      body = Bodies.rectangle(x,y,44,60,{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});
      gripPoint = {x:0,y:0};
    }else if(type === 'boomerang'){
      body = Bodies.rectangle(x,y,54,11,{density:.00072,restitution:.58,friction:.18,frictionAir:.0035,chamfer:{radius:5}});
      gripPoint = {x:-17,y:0};
    }else if(type === 'dartgun'){
      body = Bodies.rectangle(x,y,46,18,{density:.00115,restitution:.2,friction:.34,frictionAir:.006,chamfer:{radius:4}});
      gripPoint = {x:-9,y:5};
    }else if(type === 'moonboots'){
      body = Bodies.rectangle(x,y,54,24,{density:.0011,restitution:.24,friction:.72,frictionAir:.009,chamfer:{radius:6}});
      gripPoint = {x:0,y:0};
    }else if(type === 'sword'){
      body = Bodies.rectangle(x,y,106,12,{density:.0036,restitution:.08,friction:.46,frictionAir:.003,chamfer:{radius:3}});
      gripPoint = {x:-43,y:0};
    }else{
      body = Bodies.rectangle(x,y,44,6,{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
      gripPoint = {x:-13,y:0};
    }`;
    if(source.includes(bodyNeedle)) source = source.replace(bodyNeedle,bodyCode);
    else console.warn('Expanded items: could not extend makeProp bodies.');

    const stillOutNeedle = `  function specialItemStillOut(slot){
    const id = specialItems.get(slot);
    return !!(id && props.has(id));
  }`;
    const stillOutCode = `  function specialItemStillOut(slot){
    const p = puppets.get(slot);
    if(p?._moonBoots) return true;
    const id = specialItems.get(slot);
    return !!(id && props.has(id));
  }`;
    if(source.includes(stillOutNeedle)) source = source.replace(stillOutNeedle,stillOutCode);

    const positionNeedle = `    if(type === 'pump'){
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
    return {ok:true,type,propId:prop.id,message:'Brought out '+specialItemLabel(type)+'.'};`;
    const positionCode = `    if(type === 'pump'){
      x = clamp(x,52,W-52);
      y = H-68;
    }else if(type === 'moonboots'){
      const left = grabWorldPoint(p,'leftFoot');
      const right = grabWorldPoint(p,'rightFoot');
      x = clamp((left.x+right.x)*.5,34,W-34);
      y = clamp(Math.min(H-38,Math.max(left.y,right.y)-8),44,H-38);
    }else{
      const hand = grabWorldPoint(p,'rightHand');
      x = clamp(hand.x + (slot%2 ? -34 : 34),30,W-30);
      y = clamp(hand.y-8,46,H-54);
    }
    if(type === 'dart'){
      let first = null;
      for(let i=0;i<6;i++){
        const dart = makeProp('dart',clamp(x+(i-2.5)*10,24,W-24),clamp(y+(i%2)*12,36,H-36));
        dart.specialOwner = slot;
        if(!first) first = dart;
      }
      if(first) specialItems.set(slot,first.id);
      return {ok:!!first,type,propId:first?.id||null,message:first?'Brought out Sticky darts.':'Could not bring out darts.'};
    }
    const prop = makeProp(type,x,y);
    prop.specialOwner = slot;
    specialItems.set(slot,prop.id);
    return {ok:true,type,propId:prop.id,message:'Brought out '+specialItemLabel(type)+'.'};`;
    if(source.includes(positionNeedle)) source = source.replace(positionNeedle,positionCode);
    else console.warn('Expanded items: could not extend special-item spawn positions.');

    const helperNeedle = `  function handleSpecialItemInput(slot,msg){`;
    const helpers = `  function propCloseToEffector(slot,prop,maxDistance=118){
    const p=puppets.get(slot);
    if(!p||!prop) return false;
    const targets=['leftHand','rightHand','leftFoot','rightFoot'];
    return targets.some(part=>{
      const q=grabWorldPoint(p,part);
      return q && Math.hypot(q.x-prop.body.position.x,q.y-prop.body.position.y)<=maxDistance;
    });
  }
  function fireDartBlaster(slot,propId){
    const gun=props.get(propId);
    if(!gun||gun.type!=='dartgun') return {ok:false,message:'That is not a dart blaster.'};
    if(gun.heldBy?.slot!==slot) return {ok:false,message:'Hold the dart blaster first.'};
    const now=performance.now();
    if(now-(gun._lastShotAt||0)<180) return {ok:false,message:'Blaster cycling.'};
    const angle=gun.body.angle||0;
    const dir={x:Math.cos(angle),y:Math.sin(angle)};
    const muzzle={x:gun.body.position.x+dir.x*31,y:gun.body.position.y+dir.y*31};
    const dart=makeProp('dart',muzzle.x,muzzle.y);
    Body.setAngle(dart.body,angle);
    Body.setVelocity(dart.body,{x:(gun.body.velocity?.x||0)+dir.x*15.5,y:(gun.body.velocity?.y||0)+dir.y*15.5});
    Body.setAngularVelocity(dart.body,0);
    dart.specialOwner=slot;
    gun._lastShotAt=now;
    return {ok:true,propId:gun.id,message:'Pfft.'};
  }
  function equipMoonBoots(slot,propId){
    const boots=props.get(propId);
    const p=puppets.get(slot);
    if(!boots||boots.type!=='moonboots'||!p) return {ok:false,message:'Those are not moon boots.'};
    if(p._moonBoots) return {ok:false,message:'Moon boots already equipped.'};
    if(boots.heldBy && boots.heldBy.slot!==slot) return {ok:false,message:'Someone else has the moon boots.'};
    if(!propCloseToEffector(slot,boots,130)) return {ok:false,message:'Get closer to the moon boots.'};
    if(boots.heldBy) releasePropHolder(boots,false);
    if(boots.attachedTo) detachPropAttachment(boots);
    Composite.remove(engine.world,boots.body);
    props.delete(boots.id);
    p._moonBoots=true;
    p._moonBootsSince=performance.now();
    specialItems.set(slot,'equipped-moonboots-'+slot);
    return {ok:true,propId:propId,message:'Moon boots equipped.'};
  }
  function driveExpandedItems(now){
    for(const p of puppets.values()){
      if(!p?._moonBoots) continue;
      for(const body of p.bodies||[]){
        if(!body||body.isStatic) continue;
        Body.applyForce(body,body.position,{x:0,y:-body.mass*engine.gravity.y*engine.gravity.scale*2.22});
      }
    }
    for(const prop of props.values()){
      if(prop.type!=='boomerang'||prop.heldBy||prop.attachedTo||!prop._boomerangThrownAt) continue;
      const age=now-prop._boomerangThrownAt;
      const b=prop.body;
      const vx=b.velocity?.x||0,vy=b.velocity?.y||0;
      const speed=Math.hypot(vx,vy);
      if(age<60000){
        if(speed>1.1){
          const nx=-vy/speed,ny=vx/speed;
          Body.applyForce(b,b.position,{x:nx*b.mass*.00022,y:ny*b.mass*.00022});
          if(speed<5.8) Body.setVelocity(b,{x:vx*1.018,y:vy*1.018});
          else if(speed>12.5) Body.setVelocity(b,{x:vx*.985,y:vy*.985});
        }
      }else{
        let target=null;
        for(const p of puppets.values()){
          const q=p?.head?.position;
          if(!q) continue;
          if(!target||q.y<target.point.y) target={p,point:q};
        }
        if(target){
          prop._boomerangTargetSlot=target.p.slot;
          const dx=target.point.x-b.position.x,dy=target.point.y-b.position.y,d=Math.hypot(dx,dy)||1;
          Body.applyForce(b,b.position,{x:dx/d*b.mass*.00135,y:dy/d*b.mass*.00135});
        }
      }
    }
  }
  function installExpandedItemPhysics(){
    Matter.Events.on(engine,'collisionStart',event=>{
      const now=performance.now();
      for(const pair of event.pairs||[]){
        let prop=propForBody(pair.bodyA),other=pair.bodyB;
        if(!prop){prop=propForBody(pair.bodyB);other=pair.bodyA;}
        if(!prop) continue;
        const target=puppetPartForBody(other);
        if(prop.type==='boomerang'&&target&&prop._boomerangTargetSlot===target.slot&&now-(prop._boomerangThrownAt||0)>=60000){
          attachPropToBody(prop,target);
          prop._boomerangThrownAt=0;
          prop._boomerangTargetSlot=null;
          continue;
        }
        if(prop.type!=='sword'||!target||now-(prop._lastSwordCutAt||0)<180) continue;
        const rvx=(prop.body.velocity?.x||0)-(other.velocity?.x||0);
        const rvy=(prop.body.velocity?.y||0)-(other.velocity?.y||0);
        const edgeSpeed=Math.hypot(rvx,rvy)+Math.abs(prop.body.angularVelocity||0)*52;
        if(edgeSpeed<7.2) continue;
        const p=puppets.get(target.slot);
        if(!p) continue;
        const point=other.position;
        let best=null;
        if(p.joints&&p.severedJoints){
          for(const [name,c] of Object.entries(p.joints)){
            if(p.severedJoints.has(name)) continue;
            const q=jointCutPoint(c);if(!q) continue;
            const d=Math.hypot(q.x-point.x,q.y-point.y);
            if(d<38&&(!best||d<best.d)) best={kind:'joint',name,d};
          }
        }
        if(p.seams&&p.brokenSeams&&typeof seamCutPoint==='function'){
          for(const name of Object.keys(p.seams)){
            if(p.brokenSeams.has(name)) continue;
            const q=seamCutPoint(p,name);if(!q) continue;
            const d=Math.hypot(q.x-point.x,q.y-point.y);
            if(d<34&&(!best||d<best.d)) best={kind:'seam',name,d};
          }
        }
        if(!best) continue;
        const cut=best.kind==='seam'&&typeof severSeam==='function'?severSeam(p,best.name):severJoint(p,best.name);
        if(cut){prop._lastSwordCutAt=now;Body.setAngularVelocity(prop.body,(prop.body.angularVelocity||0)*.72);}
      }
    });
  }

${helperNeedle}`;
    if(source.includes(helperNeedle)) source = source.replace(helperNeedle,helpers);
    else console.warn('Expanded items: could not insert helpers.');

    const handlerNeedle = `  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop') return;`;
    const handlerCode = `  function handlePropInput(slot,msg){
    if(msg?.type !== 'prop') return;
    if(msg.action === 'fire-dartgun'){
      const result=fireDartBlaster(slot,msg.propId);
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
      return;
    }
    if(msg.action === 'equip-moonboots'){
      const result=equipMoonBoots(slot,msg.propId);
      send(conns.get(slot),{type:'prop-result',propId:msg.propId,...result});
      return;
    }`;
    if(source.includes(handlerNeedle)) source = source.replace(handlerNeedle,handlerCode);
    else console.warn('Expanded items: could not extend prop input.');

    const throwNeedle = `    }else{
      Body.setAngularVelocity(prop.body,spin);
    }
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};`;
    const throwCode = `    }else if(prop.type === 'boomerang'){
      Body.setAngularVelocity(prop.body,clamp(spin*1.5+Math.sign(vx||1)*.24,-.72,.72));
      prop._boomerangThrownAt=performance.now();
      prop._boomerangTargetSlot=null;
    }else{
      Body.setAngularVelocity(prop.body,spin);
    }
    return {ok:true,thrown:true,propId:prop.id,message:'Threw '+prop.type+'.'};`;
    if(source.includes(throwNeedle)) source = source.replace(throwNeedle,throwCode);
    else console.warn('Expanded items: could not arm boomerang throws.');

    const tickNeedle = `    driveProps();
    Engine.update(engine,dt);`;
    const tickCode = `    driveProps();
    driveExpandedItems(now);
    Engine.update(engine,dt);`;
    if(source.includes(tickNeedle)) source = source.replace(tickNeedle,tickCode);
    else console.warn('Expanded items: could not add item drive tick.');

    const initNeedle = `  installPropContactPhysics();
  requestAnimationFrame(tick);`;
    const initCode = `  installPropContactPhysics();
  installExpandedItemPhysics();
  requestAnimationFrame(tick);`;
    if(source.includes(initNeedle)) source = source.replace(initNeedle,initCode);
    else console.warn('Expanded items: could not install impact physics.');

    const anatomyNeedle = `slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,`;
    const anatomyCode = `slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,moonBoots:!!p._moonBoots,`;
    if(source.includes(anatomyNeedle)) source = source.replace(anatomyNeedle,anatomyCode);

    const radiusNeedle = `      const radius = prop.type === 'frisbee' ? 48 : prop.type === 'pump' ? 44 : prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;`;
    const radiusCode = `      const radius = prop.type === 'sword' ? 64 : prop.type === 'boomerang' ? 50 : prop.type === 'dartgun' ? 48 : prop.type === 'moonboots' ? 50 : prop.type === 'frisbee' ? 48 : prop.type === 'pump' ? 44 : prop.type === 'balloon' ? 38 : prop.type === 'ball' ? 34 : 32;`;
    if(source.includes(radiusNeedle)) source = source.replace(radiusNeedle,radiusCode);

    const pointerNeedle = `    if(prop.type === 'pump'){
      event.preventDefault();`;
    const pointerCode = `    if(prop.type === 'dartgun' && prop.heldBy?.slot === slot){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'fire-dartgun',propId:prop.id});
      return;
    }
    if(prop.type === 'moonboots'){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(conn?.open && slot !== null) send(conn,{type:'prop',action:'equip-moonboots',propId:prop.id});
      return;
    }
    if(prop.type === 'pump'){
      event.preventDefault();`;
    if(source.includes(pointerNeedle)) source = source.replace(pointerNeedle,pointerCode);
    else console.warn('Expanded items: could not add direct item actions.');

    const drawNeedle = `  }else if(p.type === 'pump'){
    ctx.fillStyle='#08090a';roundRect(ctx,-25*s,-33*s,50*s,66*s,7*s);ctx.fill();`;
    const drawCode = `  }else if(p.type === 'boomerang'){
    ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(12,14*s);ctx.beginPath();ctx.moveTo(-22*s,-15*s);ctx.quadraticCurveTo(-4*s,-1*s,0,16*s);ctx.quadraticCurveTo(5*s,-1*s,24*s,-14*s);ctx.stroke();
    ctx.strokeStyle='#f1c84c';ctx.lineWidth=Math.max(7,9*s);ctx.beginPath();ctx.moveTo(-22*s,-15*s);ctx.quadraticCurveTo(-4*s,-1*s,0,16*s);ctx.quadraticCurveTo(5*s,-1*s,24*s,-14*s);ctx.stroke();
  }else if(p.type === 'dartgun'){
    ctx.fillStyle='#08090a';roundRect(ctx,-26*s,-11*s,52*s,22*s,5*s);ctx.fill();
    ctx.fillStyle='#d9dde2';roundRect(ctx,-22*s,-8*s,40*s,16*s,4*s);ctx.fill();
    ctx.fillStyle='#f1c84c';roundRect(ctx,17*s,-5*s,14*s,10*s,3*s);ctx.fill();
    ctx.fillStyle='#08090a';roundRect(ctx,-10*s,7*s,13*s,22*s,3*s);ctx.fill();
  }else if(p.type === 'moonboots'){
    ctx.fillStyle='#08090a';roundRect(ctx,-29*s,-14*s,58*s,28*s,7*s);ctx.fill();
    ctx.fillStyle='#d9dde2';roundRect(ctx,-25*s,-10*s,22*s,20*s,5*s);ctx.fill();roundRect(ctx,3*s,-10*s,22*s,20*s,5*s);ctx.fill();
    ctx.fillStyle='#f1c84c';roundRect(ctx,-25*s,5*s,22*s,5*s,2*s);ctx.fill();roundRect(ctx,3*s,5*s,22*s,5*s,2*s);ctx.fill();
  }else if(p.type === 'sword'){
    ctx.fillStyle='#08090a';roundRect(ctx,-52*s,-7*s,104*s,14*s,3*s);ctx.fill();
    ctx.fillStyle='#d9dde2';roundRect(ctx,-35*s,-4*s,86*s,8*s,2*s);ctx.fill();
    ctx.fillStyle='#f1c84c';roundRect(ctx,-45*s,-11*s,7*s,22*s,2*s);ctx.fill();
    ctx.fillStyle='#191b1f';roundRect(ctx,-53*s,-5*s,13*s,10*s,3*s);ctx.fill();
  }else if(p.type === 'pump'){
    ctx.fillStyle='#08090a';roundRect(ctx,-25*s,-33*s,50*s,66*s,7*s);ctx.fill();`;
    if(source.includes(drawNeedle)) source = source.replace(drawNeedle,drawCode);
    else console.warn('Expanded items: could not add prop renderers.');

    const torsoNeedle = `  const tx = p.torso.x*w;`;
    const bootRender = `  if(p.moonBoots){
    for(const foot of [p.al,p.ar]){
      if(!foot) continue;
      const q=typeof displayPoint==='function'?displayPoint(foot,w,h):{x:foot.x*w,y:foot.y*h};
      ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='#08090a';roundRect(ctx,-12*scale,-6*scale,24*scale,12*scale,4*scale);ctx.fill();ctx.fillStyle='#d9dde2';roundRect(ctx,-9*scale,-4*scale,18*scale,8*scale,3*scale);ctx.fill();ctx.restore();
    }
  }
  const tx = p.torso.x*w;`;
    if(source.includes(torsoNeedle)) source = source.replace(torsoNeedle,bootRender);

    return source;
  }

  window.fetch = async (...args)=>{
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url||args[0]||'');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
