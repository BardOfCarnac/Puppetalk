// Puppetalk general body slicing pass.
// Fast, spinning laser frisbees can split rigid puppet bodies into physical convex pieces.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_ITEM_POLISH_V1') || source.includes('PUPPETALK_BODY_SLICING_V1')) return source;

    source = source.replace(
      '  // PUPPETALK_ITEM_POLISH_V1',
      '  // PUPPETALK_ITEM_POLISH_V1\n  // PUPPETALK_BODY_SLICING_V1'
    );

    const makeNeedle = `  function makePuppet(slot){`;
    const helpers = `  const BODY_SLICE_PARTS = ['torso','head','uaL','faL','uaR','faR','thL','shL','thR','shR'];
  const BODY_SLICE_SHAPES = {
    torso:{kind:'rect',w:48,h:78,r:13,density:.0022},
    head:{kind:'circle',r:26,density:.0018},
    uaL:{kind:'rect',w:16,h:52},faL:{kind:'rect',w:15,h:49},
    uaR:{kind:'rect',w:16,h:52},faR:{kind:'rect',w:15,h:49},
    thL:{kind:'rect',w:19,h:58},shL:{kind:'rect',w:17,h:54},
    thR:{kind:'rect',w:19,h:58},shR:{kind:'rect',w:17,h:54}
  };
  const BODY_SLICE_CONTROL = {
    torso:{x:0,y:0},head:{x:0,y:0},
    uaL:{x:0,y:-25},uaR:{x:0,y:-25},
    faL:{x:0,y:23},faR:{x:0,y:23},
    thL:{x:0,y:-27},thR:{x:0,y:-27},
    shL:{x:0,y:25},shR:{x:0,y:25}
  };

  function cutCross(a,b,p){ return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x); }
  function worldToBodyLocal(body,point){
    return Vector.rotate({x:point.x-body.position.x,y:point.y-body.position.y},-(body.angle||0));
  }
  function bodyLocalToWorld(body,point){
    const r = Vector.rotate(point,body.angle||0);
    return {x:body.position.x+r.x,y:body.position.y+r.y};
  }
  function polygonArea(poly){
    let sum=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      sum += a.x*b.y-b.x*a.y;
    }
    return Math.abs(sum)*.5;
  }
  function polygonCentroid(poly){
    let twice=0,cx=0,cy=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const cross=a.x*b.y-b.x*a.y;
      twice+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;
    }
    if(Math.abs(twice)<1e-6){
      const n=Math.max(1,poly.length);
      return poly.reduce((o,p)=>({x:o.x+p.x/n,y:o.y+p.y/n}),{x:0,y:0});
    }
    return {x:cx/(3*twice),y:cy/(3*twice)};
  }
  function clipPolygonHalf(poly,a,b,positive){
    const out=[];
    const eps=.0001;
    for(let i=0;i<poly.length;i++){
      const cur=poly[i],next=poly[(i+1)%poly.length];
      const sc=cutCross(a,b,cur),sn=cutCross(a,b,next);
      const cin=positive ? sc>=-eps : sc<=eps;
      const nin=positive ? sn>=-eps : sn<=eps;
      if(cin) out.push({x:cur.x,y:cur.y});
      if(cin!==nin){
        const denom=sc-sn;
        if(Math.abs(denom)>1e-8){
          const t=sc/denom;
          out.push({x:cur.x+(next.x-cur.x)*t,y:cur.y+(next.y-cur.y)*t});
        }
      }
    }
    return out;
  }
  function pointInsidePolygon(p,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      const crosses=((a.y>p.y)!==(b.y>p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);
      if(crosses) inside=!inside;
    }
    return inside;
  }
  function segmentEdgeT(a,b,c,d){
    const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
    const den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-8) return null;
    const qx=c.x-a.x,qy=c.y-a.y;
    const t=(qx*sy-qy*sx)/den;
    const u=(qx*ry-qy*rx)/den;
    return t>=0&&t<=1&&u>=0&&u<=1 ? t : null;
  }
  function segmentPolygonFirstT(a,b,poly){
    if(pointInsidePolygon(a,poly)) return 0;
    let best=null;
    for(let i=0;i<poly.length;i++){
      const t=segmentEdgeT(a,b,poly[i],poly[(i+1)%poly.length]);
      if(t!==null&&(best===null||t<best)) best=t;
    }
    return best;
  }
  function pointSegmentProjection(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
    if(d<1e-8) return {t:0,x:a.x,y:a.y,distance:Math.hypot(point.x-a.x,point.y-a.y)};
    const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/d,0,1);
    const x=a.x+dx*t,y=a.y+dy*t;
    return {t,x,y,distance:Math.hypot(point.x-x,point.y-y)};
  }
  function sliceLineForBody(body,previous,current){
    if(!body?.vertices?.length || body.isStatic) return null;
    const poly=body.vertices.map(v=>worldToBodyLocal(body,v));
    let a=worldToBodyLocal(body,previous),b=worldToBodyLocal(body,current);
    let t=segmentPolygonFirstT(a,b,poly);
    if(t===null){
      const centre=pointSegmentProjection({x:0,y:0},a,b);
      let radius=0;
      for(const v of poly) radius=Math.max(radius,Math.hypot(v.x,v.y));
      if(centre.distance>radius+18) return null;
      const toward={x:-centre.x,y:-centre.y};
      const len=Math.hypot(toward.x,toward.y)||1;
      const shift=Math.min(18,Math.max(0,centre.distance-radius*.72));
      a={x:a.x+toward.x/len*shift,y:a.y+toward.y/len*shift};
      b={x:b.x+toward.x/len*shift,y:b.y+toward.y/len*shift};
      t=segmentPolygonFirstT(a,b,poly);
      if(t===null) return null;
    }
    const pos=clipPolygonHalf(poly,a,b,true);
    const neg=clipPolygonHalf(poly,a,b,false);
    const total=polygonArea(poly),pa=polygonArea(pos),na=polygonArea(neg);
    if(pos.length<3||neg.length<3||pa<55||na<55||Math.min(pa,na)<total*.10) return null;
    return {a,b,t,poly,pos,neg};
  }
  function partForBody(p,body){
    if(body?._sliceOriginPart) return body._sliceOriginPart;
    for(const part of BODY_SLICE_PARTS) if(p?.[part]===body) return part;
    return null;
  }
  function bodyOptionsFrom(body){
    return {
      collisionFilter:{...body.collisionFilter},
      friction:body.friction,frictionStatic:body.frictionStatic,
      frictionAir:body.frictionAir,restitution:body.restitution,
      density:Math.max(.00001,body.density||.001),slop:body.slop,
      isSensor:false
    };
  }
  function makeSlicePiece(old,verts,part){
    const centreLocal=polygonCentroid(verts);
    const centreWorld=bodyLocalToWorld(old,centreLocal);
    const piece=Bodies.fromVertices(centreWorld.x,centreWorld.y,[verts.map(v=>({x:v.x,y:v.y}))],bodyOptionsFrom(old),true);
    Body.setAngle(piece,old.angle||0);
    Body.setVelocity(piece,{x:old.velocity.x,y:old.velocity.y});
    Body.setAngularVelocity(piece,old.angularVelocity||0);
    piece.plugin={...(old.plugin||{})};
    delete piece.plugin.puppetalkPart;
    piece._sliceOriginPart=part;
    piece._slicePrimary=false;
    return piece;
  }
  function choosePieceForWorldPoint(old,line,positive,negative,point){
    const local=worldToBodyLocal(old,point);
    return cutCross(line.a,line.b,local)>=0 ? positive : negative;
  }
  function endpointWorld(body,local){ return bodyLocalToWorld(body,local||{x:0,y:0}); }
  function transferConstraintSide(c,side,old,line,positive,negative,isJoint,part){
    const bodyKey=side==='A'?'bodyA':'bodyB';
    const pointKey=side==='A'?'pointA':'pointB';
    if(c?.[bodyKey]!==old) return;
    const world=endpointWorld(old,c[pointKey]||{x:0,y:0});
    if(isJoint){
      const storeKey=side==='A'?'_puppetalkSliceOriginalA':'_puppetalkSliceOriginalB';
      if(!c[storeKey]) c[storeKey]={part,point:{...(c[pointKey]||{x:0,y:0})}};
    }
    const next=choosePieceForWorldPoint(old,line,positive,negative,world);
    c[bodyKey]=next;
    c[pointKey]=worldToBodyLocal(next,world);
  }
  function transferBodyAttachments(old,line,positive,negative){
    for(const prop of props.values()){
      const a=prop?.attachedTo;
      if(a?.body!==old) continue;
      const world=bodyLocalToWorld(old,a.offset||{x:0,y:0});
      const next=choosePieceForWorldPoint(old,line,positive,negative,world);
      a.body=next;
      a.offset=worldToBodyLocal(next,world);
    }
  }
  function splitPuppetBody(p,old,line){
    if(!p||!old||p.bodies.length>=28) return false;
    const part=partForBody(p,old);
    if(!part) return false;
    const positive=makeSlicePiece(old,line.pos,part);
    const negative=makeSlicePiece(old,line.neg,part);
    if(!positive||!negative) return false;

    const activeJoints=new Set(Object.values(p.joints||{}));
    const constraints=new Set([...engine.world.constraints,...activeJoints]);
    for(const c of constraints){
      transferConstraintSide(c,'A',old,line,positive,negative,activeJoints.has(c),part);
      transferConstraintSide(c,'B',old,line,positive,negative,activeJoints.has(c),part);
    }
    transferBodyAttachments(old,line,positive,negative);

    const oldWasPrimary=p[part]===old;
    let primary=null;
    if(oldWasPrimary){
      const control=BODY_SLICE_CONTROL[part]||{x:0,y:0};
      primary=cutCross(line.a,line.b,control)>=0?positive:negative;
      const fragment=primary===positive?negative:positive;
      primary._slicePrimary=true;
      primary.plugin={...(old.plugin||{}),puppetalkPart:part};
      fragment.plugin={...(fragment.plugin||{})};delete fragment.plugin.puppetalkPart;
      p[part]=primary;
    }

    const index=p.bodies.indexOf(old);
    if(index>=0) p.bodies.splice(index,1,positive,negative);
    else p.bodies.push(positive,negative);
    Composite.remove(engine.world,old);
    Composite.add(engine.world,[positive,negative]);

    const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,len=Math.hypot(dx,dy)||1;
    const normalWorld=Vector.rotate({x:-dy/len,y:dx/len},old.angle||0);
    Body.translate(positive,{x:normalWorld.x*1.5,y:normalWorld.y*1.5});
    Body.translate(negative,{x:-normalWorld.x*1.5,y:-normalWorld.y*1.5});
    Body.setVelocity(positive,{x:old.velocity.x+normalWorld.x*.24,y:old.velocity.y+normalWorld.y*.24});
    Body.setVelocity(negative,{x:old.velocity.x-normalWorld.x*.24,y:old.velocity.y-normalWorld.y*.24});
    Body.setAngularVelocity(positive,(old.angularVelocity||0)+.018);
    Body.setAngularVelocity(negative,(old.angularVelocity||0)-.018);

    p._slicedParts=p._slicedParts||new Set();
    p._slicedParts.add(part);
    p._hasBodySlices=true;
    return true;
  }
  function bodyPieceState(p){
    if(!p?._hasBodySlices) return null;
    return p.bodies.map(body=>({
      part:partForBody(p,body),
      primary:BODY_SLICE_PARTS.some(part=>p[part]===body),
      c:{x:body.position.x/W,y:body.position.y/H},
      a:body.angle||0,
      v:body.vertices.map(v=>({x:v.x/W,y:v.y/H}))
    }));
  }
  function canonicalPartBody(part,template){
    const shape=BODY_SLICE_SHAPES[part];
    if(!shape||!template) return null;
    const opt=bodyOptionsFrom(template);
    opt.collisionFilter={...template.collisionFilter};
    opt.density=shape.density||.001;
    let body;
    if(shape.kind==='circle') body=Bodies.circle(template.position.x,template.position.y,shape.r,opt);
    else body=Bodies.rectangle(template.position.x,template.position.y,shape.w,shape.h,{...opt,chamfer:{radius:shape.r||0}});
    Body.setAngle(body,template.angle||0);
    Body.setVelocity(body,{x:template.velocity.x,y:template.velocity.y});
    Body.setAngularVelocity(body,template.angularVelocity||0);
    body.plugin={...(template.plugin||{}),puppetalkPart:part};
    body._sliceOriginPart=part;
    body._slicePrimary=true;
    return body;
  }
  function healBodySlices(p){
    if(!p?._slicedParts?.size) return;
    for(const part of [...p._slicedParts]){
      const pieces=p.bodies.filter(b=>partForBody(p,b)===part);
      if(pieces.length<2){p._slicedParts.delete(part);continue;}
      const template=p[part]&&pieces.includes(p[part])?p[part]:pieces[0];
      const replacement=canonicalPartBody(part,template);
      if(!replacement) continue;
      const pieceSet=new Set(pieces);
      const activeJoints=new Set(Object.values(p.joints||{}));
      const constraints=new Set([...engine.world.constraints,...activeJoints]);
      for(const c of constraints){
        for(const side of ['A','B']){
          const bodyKey=side==='A'?'bodyA':'bodyB';
          const pointKey=side==='A'?'pointA':'pointB';
          if(!pieceSet.has(c?.[bodyKey])) continue;
          const currentBody=c[bodyKey];
          const world=endpointWorld(currentBody,c[pointKey]||{x:0,y:0});
          const stored=c[side==='A'?'_puppetalkSliceOriginalA':'_puppetalkSliceOriginalB'];
          c[bodyKey]=replacement;
          c[pointKey]=stored?.part===part?{...stored.point}:worldToBodyLocal(replacement,world);
        }
      }
      for(const prop of props.values()){
        const a=prop?.attachedTo;
        if(!pieceSet.has(a?.body)) continue;
        const world=bodyLocalToWorld(a.body,a.offset||{x:0,y:0});
        a.body=replacement;a.offset=worldToBodyLocal(replacement,world);
      }
      const first=Math.max(0,Math.min(...pieces.map(b=>p.bodies.indexOf(b)).filter(i=>i>=0)));
      p.bodies=p.bodies.filter(b=>!pieceSet.has(b));
      p.bodies.splice(first,0,replacement);
      pieces.forEach(body=>Composite.remove(engine.world,body));
      Composite.add(engine.world,replacement);
      p[part]=replacement;
      p._slicedParts.delete(part);
    }
    p._hasBodySlices=!!p._slicedParts.size;
  }
  function prepareLaserFrisbeePass(now){
    for(const prop of props.values()){
      if(prop.type!=='frisbee') continue;
      const ghost=!prop.heldBy&&(prop._cutArmed||now<(prop._cutGhostUntil||0));
      prop._sliceSensorWas=!!prop.body.isSensor;
      if(ghost) prop.body.isSensor=true;
    }
  }
  function finishLaserFrisbeePass(){
    for(const prop of props.values()){
      if(prop.type!=='frisbee'||prop._sliceSensorWas===undefined) continue;
      prop.body.isSensor=prop._sliceSensorWas;
      delete prop._sliceSensorWas;
    }
  }

${makeNeedle}`;
    if(!source.includes(makeNeedle)) throw new Error('Body slicing patch failed: stage helper insertion');
    source=source.replace(makeNeedle,helpers);

    const addNeedle=`    Composite.add(engine.world,[...puppet.bodies,...constraints]);`;
    const addCode=`    for(const part of BODY_SLICE_PARTS){
      const body=puppet[part];
      if(!body) continue;
      body._sliceOriginPart=part;
      body._slicePrimary=true;
    }
    Composite.add(engine.world,[...puppet.bodies,...constraints]);`;
    if(!source.includes(addNeedle)) throw new Error('Body slicing patch failed: base body tagging');
    source=source.replace(addNeedle,addCode);

    // Body geometry is sent only once a puppet has actually been cut.
    const severedNeedle=`severed:[...(p.severedJoints||[])],`;
    if(!source.includes(severedNeedle)) throw new Error('Body slicing patch failed: anatomy slice state');
    source=source.replace(severedNeedle,`severed:[...(p.severedJoints||[])],pieces:bodyPieceState(p),`);

    // Explicit Recover heals split rigid bodies as well as reconnecting named joints.
    const recoverNeedle=`      p.recoverVersion = version;
      p.repairRequested = true;`;
    const recoverCode=`      p.recoverVersion = version;
      healBodySlices(p);
      p.repairRequested = true;`;
    if(!source.includes(recoverNeedle)) throw new Error('Body slicing patch failed: recover healing');
    source=source.replace(recoverNeedle,recoverCode);

    const cutPattern=/  function driveLaserFrisbeeCuts\(now\)\{[\s\S]*?\n  \}\n\n  function driveProps\(\)\{/;
    const cutCode=`  function driveLaserFrisbeeCuts(now){
    for(const prop of props.values()){
      if(prop.type!=='frisbee') continue;
      const b=prop.body;
      const current={x:b.position.x,y:b.position.y};
      const previous=prop._frisbeePrev||current;
      prop._frisbeePrev=current;
      if(!prop._cutArmed||prop.heldBy||prop.contest||prop.attachedTo) continue;
      const age=now-(prop._thrownAt||0);
      if(age<120) continue;

      const linear=Math.hypot(b.velocity?.x||0,b.velocity?.y||0);
      const spin=Math.abs(b.angularVelocity||0);
      const edgeSpeed=linear+spin*23;
      if(linear<5.0||spin<.12||edgeSpeed<8.7){
        if(linear<3.3&&age>280) prop._cutArmed=false;
        continue;
      }

      const candidates=[];
      for(const p of puppets.values()){
        if(!p.joints||!p.severedJoints) continue;
        for(const [name,constraint] of Object.entries(p.joints)){
          if(p.severedJoints.has(name)) continue;
          const q=jointCutPoint(constraint);
          if(!q) continue;
          const distance=pointSegmentDistance(q,previous,current);
          if(distance>15) continue;
          const projection=pointSegmentProjection(q,previous,current);
          candidates.push({kind:'joint',p,name,t:projection.t,priority:0});
        }
        for(const body of p.bodies){
          const line=sliceLineForBody(body,previous,current);
          if(line) candidates.push({kind:'body',p,body,line,t:line.t,priority:1});
        }
      }
      candidates.sort((a,b)=>Math.abs(a.t-b.t)<.035?a.priority-b.priority:a.t-b.t);

      let cut=false;
      for(const hit of candidates){
        if(hit.kind==='joint') cut=severJoint(hit.p,hit.name);
        else cut=splitPuppetBody(hit.p,hit.body,hit.line);
        if(cut) break;
      }

      if(cut){
        // One real cut per throw. Keep almost all momentum and stay ghosted briefly
        // so the disc exits the new cut instead of bouncing off a fresh fragment.
        prop._cutArmed=false;
        prop._cutGhostUntil=now+115;
        Body.setVelocity(b,{x:(b.velocity?.x||0)*.92,y:(b.velocity?.y||0)*.92});
        Body.setAngularVelocity(b,(b.angularVelocity||0)*.88);
        continue;
      }

      // Armed throws ignore puppet collision response, but the stage itself still
      // behaves as a boundary: touching it disarms and produces a normal bounce.
      const vx=b.velocity?.x||0,vy=b.velocity?.y||0;
      if(current.y>H-32){prop._cutArmed=false;Body.setPosition(b,{x:current.x,y:H-34});Body.setVelocity(b,{x:vx*.72,y:-Math.abs(vy)*.72});}
      else if(current.y<6){prop._cutArmed=false;Body.setPosition(b,{x:current.x,y:8});Body.setVelocity(b,{x:vx*.72,y:Math.abs(vy)*.72});}
      else if(current.x<6){prop._cutArmed=false;Body.setPosition(b,{x:8,y:current.y});Body.setVelocity(b,{x:Math.abs(vx)*.72,y:vy*.72});}
      else if(current.x>W-6){prop._cutArmed=false;Body.setPosition(b,{x:W-8,y:current.y});Body.setVelocity(b,{x:-Math.abs(vx)*.72,y:vy*.72});}
    }
  }

  function driveProps(){`;
    if(!cutPattern.test(source)) throw new Error('Body slicing patch failed: laser cut replacement');
    source=source.replace(cutPattern,cutCode);

    const tickNeedle=`    Engine.update(engine,dt);
    driveLaserFrisbeeCuts(now);`;
    const tickCode=`    prepareLaserFrisbeePass(now);
    Engine.update(engine,dt);
    finishLaserFrisbeePass();
    driveLaserFrisbeeCuts(now);`;
    if(!source.includes(tickNeedle)) throw new Error('Body slicing patch failed: sensor pass');
    source=source.replace(tickNeedle,tickCode);

    const drawNeedle=`function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){
  if(!p?.torso || !p?.head) return;`;
    const drawHelpers=`function drawSlicedPuppet(ctx,p,w,h,highlight=false,alpha=1){
  const pieces=Array.isArray(p?.pieces)?p.pieces:[];
  if(!pieces.length) return false;
  const point=q=>typeof displayPoint==='function'?displayPoint(q,w,h):{x:q.x*w,y:q.y*h};
  const scale=(typeof projectionRenderScale==='function'?projectionRenderScale(w,h):Math.min(w/900,h/650))*(p.visualScale||1);
  const transformed=pieces.map(piece=>({...piece,pts:(piece.v||[]).map(point),center:point(piece.c)}));
  ctx.save();ctx.globalAlpha=alpha;
  if(highlight){
    const torso=transformed.find(x=>x.part==='torso'&&x.primary)||transformed[0];
    if(torso){ctx.beginPath();ctx.arc(torso.center.x,torso.center.y,Math.max(38,58*scale),0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.34)';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.stroke();ctx.setLineDash([]);}
  }
  for(const piece of transformed){
    if(piece.pts.length<3) continue;
    ctx.beginPath();ctx.moveTo(piece.pts[0].x,piece.pts[0].y);for(const q of piece.pts.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();
    ctx.fillStyle=p.color;ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(2.5,5*scale);ctx.lineJoin='round';ctx.fill();ctx.stroke();
  }
  const head=transformed.find(x=>x.part==='head'&&x.primary);
  if(head&&head.pts.length>=3){
    ctx.save();ctx.beginPath();ctx.moveTo(head.pts[0].x,head.pts[0].y);for(const q of head.pts.slice(1))ctx.lineTo(q.x,q.y);ctx.closePath();ctx.clip();
    const hr=Math.max(13,26*scale),c=head.center;
    ctx.translate(c.x,c.y);ctx.rotate(head.a||0);ctx.fillStyle='#08090a';
    const eyeY=-hr*.18;ctx.beginPath();ctx.arc(-hr*.3,eyeY,Math.max(1.8,hr*.1),0,Math.PI*2);ctx.arc(hr*.3,eyeY,Math.max(1.8,hr*.1),0,Math.PI*2);ctx.fill();
    ctx.beginPath();if(p.mouth===0)roundRect(ctx,-hr*.27,hr*.34,hr*.54,Math.max(2,hr*.11),2);else if(p.mouth===1)roundRect(ctx,-hr*.28,hr*.22,hr*.56,hr*.38,hr*.16);else ctx.ellipse(0,hr*.4,hr*.34,hr*.42,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  let top=Infinity,labelX=w*.5;
  for(const piece of transformed)for(const q of piece.pts){if(q.y<top){top=q.y;labelX=q.x;}}
  ctx.font=\`${'${highlight?\'700\':\'600\'}'} ${'${Math.max(10,12*scale)}'}px system-ui,sans-serif\`;ctx.textAlign='center';ctx.fillStyle=highlight?'#fff':'rgba(255,255,255,.78)';ctx.fillText(highlight?\`${'${p.name}'} · YOU\`:p.name,labelX,Math.max(14,top-10));
  ctx.restore();return true;
}

function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){
  if(!p?.torso || !p?.head) return;
  if(Array.isArray(p.pieces)&&p.pieces.length&&drawSlicedPuppet(ctx,p,w,h,highlight,alpha)) return;`;
    if(!source.includes(drawNeedle)) throw new Error('Body slicing patch failed: sliced renderer');
    source=source.replace(drawNeedle,drawHelpers);

    return source;
  }

  window.fetch=async (...args)=>{
    const response=await decoratedFetch(...args);
    const target=String(args[0]?.url||args[0]||'');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text=await response.text();
    return new Response(patch(text),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
