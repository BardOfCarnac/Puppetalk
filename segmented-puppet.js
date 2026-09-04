// Puppetalk pre-segmented puppet pass.
// Bodies are born as stable hidden pieces. Cutting removes existing seam constraints;
// it never destroys/recreates Matter bodies during a collision.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('PUPPETALK_ITEM_POLISH_V1') || source.includes('PUPPETALK_SEGMENTED_PUPPET_V1')) return source;
    source = source.replace(
      '  // PUPPETALK_ITEM_POLISH_V1',
      '  // PUPPETALK_ITEM_POLISH_V1\n  // PUPPETALK_SEGMENTED_PUPPET_V1'
    );

    const makeNeedle = `  function makePuppet(slot){`;
    const makeCode = `  function tagHiddenSegment(body,slot,part,segment){
    body.plugin = body.plugin || {};
    delete body.plugin.puppetalkPart;
    body.plugin.puppetalkSegmentPart = part;
    body.plugin.puppetalkSegment = segment;
    body.plugin.puppetalkSlot = slot;
    return body;
  }

  function makePuppet(slot){`;
    if(!source.includes(makeNeedle)) throw new Error('Segmented puppet patch failed: makePuppet hook');
    source = source.replace(makeNeedle,makeCode);

    const bodiesNeedle = `    const torso = Bodies.rectangle(x,y,48,78,{...opt,chamfer:{radius:13},density:.0022});
    const head = Bodies.circle(x,y-65,26,{...opt,density:.0018});
    const uaL = Bodies.rectangle(x-37,y-17,16,52,opt);
    const faL = Bodies.rectangle(x-42,y+30,15,49,opt);
    const uaR = Bodies.rectangle(x+37,y-17,16,52,opt);
    const faR = Bodies.rectangle(x+42,y+30,15,49,opt);
    const thL = Bodies.rectangle(x-14,y+65,19,58,opt);
    const shL = Bodies.rectangle(x-14,y+118,17,54,opt);
    const thR = Bodies.rectangle(x+14,y+65,19,58,opt);
    const shR = Bodies.rectangle(x+14,y+118,17,54,opt);`;
    const bodiesCode = `    // Keep these first ten bodies in the historic creation order. stability.js
    // therefore continues to tag the canonical control parts exactly as before.
    const torso = Bodies.rectangle(x,y,48,26,{...opt,chamfer:{radius:7},density:.0022});
    const head = Bodies.rectangle(x,y-53,44,24,{...opt,chamfer:{radius:11},density:.00068});
    const uaL = Bodies.rectangle(x-37,y-30,16,26,opt);
    const faL = Bodies.rectangle(x-42,y+18,15,25,opt);
    const uaR = Bodies.rectangle(x+37,y-30,16,26,opt);
    const faR = Bodies.rectangle(x+42,y+18,15,25,opt);
    const thL = Bodies.rectangle(x-14,y+50.5,19,29,opt);
    const shL = Bodies.rectangle(x-14,y+104.5,17,27,opt);
    const thR = Bodies.rectangle(x+14,y+50.5,19,29,opt);
    const shR = Bodies.rectangle(x+14,y+104.5,17,27,opt);

    const torsoTop = tagHiddenSegment(Bodies.rectangle(x,y-26,48,26,{...opt,chamfer:{radius:7},density:.0022}),slot,'torso','top');
    const torsoBottom = tagHiddenSegment(Bodies.rectangle(x,y+26,48,26,{...opt,chamfer:{radius:7},density:.0022}),slot,'torso','bottom');
    const headTop = tagHiddenSegment(Bodies.rectangle(x,y-77,44,24,{...opt,chamfer:{radius:11},density:.00068}),slot,'head','top');
    const uaL2 = tagHiddenSegment(Bodies.rectangle(x-37,y-4,16,26,opt),slot,'uaL','distal');
    const faL2 = tagHiddenSegment(Bodies.rectangle(x-42,y+42.5,15,24,opt),slot,'faL','distal');
    const uaR2 = tagHiddenSegment(Bodies.rectangle(x+37,y-4,16,26,opt),slot,'uaR','distal');
    const faR2 = tagHiddenSegment(Bodies.rectangle(x+42,y+42.5,15,24,opt),slot,'faR','distal');
    const thL2 = tagHiddenSegment(Bodies.rectangle(x-14,y+79.5,19,29,opt),slot,'thL','distal');
    const shL2 = tagHiddenSegment(Bodies.rectangle(x-14,y+131.5,17,27,opt),slot,'shL','distal');
    const thR2 = tagHiddenSegment(Bodies.rectangle(x+14,y+79.5,19,29,opt),slot,'thR','distal');
    const shR2 = tagHiddenSegment(Bodies.rectangle(x+14,y+131.5,17,27,opt),slot,'shR','distal');`;
    if(!source.includes(bodiesNeedle)) throw new Error('Segmented puppet patch failed: body construction');
    source = source.replace(bodiesNeedle,bodiesCode);

    const jointsNeedle = `    const joints = {
      neck:joint(torso,{x:0,y:-39},head,{x:0,y:24}),
      leftShoulder:joint(torso,{x:-24,y:-27},uaL,{x:0,y:-25}),
      leftElbow:joint(uaL,{x:0,y:25},faL,{x:0,y:-23}),
      rightShoulder:joint(torso,{x:24,y:-27},uaR,{x:0,y:-25}),
      rightElbow:joint(uaR,{x:0,y:25},faR,{x:0,y:-23}),
      leftHip:joint(torso,{x:-14,y:38},thL,{x:0,y:-27}),
      leftKnee:joint(thL,{x:0,y:27},shL,{x:0,y:-25}),
      rightHip:joint(torso,{x:14,y:38},thR,{x:0,y:-27}),
      rightKnee:joint(thR,{x:0,y:27},shR,{x:0,y:-25})
    };
    const constraints = Object.values(joints);`;
    const jointsCode = `    const seams = {
      torsoUpper:joint(torsoTop,{x:0,y:13},torso,{x:0,y:-13},.995),
      torsoLower:joint(torso,{x:0,y:13},torsoBottom,{x:0,y:-13},.995),
      headMiddle:joint(head,{x:0,y:-12},headTop,{x:0,y:12},.995),
      leftUpperArm:joint(uaL,{x:0,y:13},uaL2,{x:0,y:-13},.995),
      leftForearm:joint(faL,{x:0,y:12},faL2,{x:0,y:-12},.995),
      rightUpperArm:joint(uaR,{x:0,y:13},uaR2,{x:0,y:-13},.995),
      rightForearm:joint(faR,{x:0,y:12},faR2,{x:0,y:-12},.995),
      leftThigh:joint(thL,{x:0,y:14.5},thL2,{x:0,y:-14.5},.995),
      leftShin:joint(shL,{x:0,y:13.5},shL2,{x:0,y:-13.5},.995),
      rightThigh:joint(thR,{x:0,y:14.5},thR2,{x:0,y:-14.5},.995),
      rightShin:joint(shR,{x:0,y:13.5},shR2,{x:0,y:-13.5},.995)
    };
    const seamMeta = {
      torsoUpper:{radius:29,part:'torso'},torsoLower:{radius:29,part:'torso'},
      headMiddle:{radius:27,part:'head'},
      leftUpperArm:{radius:13,part:'uaL'},leftForearm:{radius:13,part:'faL'},
      rightUpperArm:{radius:13,part:'uaR'},rightForearm:{radius:13,part:'faR'},
      leftThigh:{radius:14,part:'thL'},leftShin:{radius:14,part:'shL'},
      rightThigh:{radius:14,part:'thR'},rightShin:{radius:14,part:'shR'}
    };
    const joints = {
      neck:joint(torsoTop,{x:0,y:-13},head,{x:0,y:12}),
      leftShoulder:joint(torsoTop,{x:-24,y:-1},uaL,{x:0,y:-13}),
      leftElbow:joint(uaL2,{x:0,y:13},faL,{x:0,y:-12}),
      rightShoulder:joint(torsoTop,{x:24,y:-1},uaR,{x:0,y:-13}),
      rightElbow:joint(uaR2,{x:0,y:13},faR,{x:0,y:-12}),
      leftHip:joint(torsoBottom,{x:-14,y:12},thL,{x:0,y:-14.5}),
      leftKnee:joint(thL2,{x:0,y:14.5},shL,{x:0,y:-13.5}),
      rightHip:joint(torsoBottom,{x:14,y:12},thR,{x:0,y:-14.5}),
      rightKnee:joint(thR2,{x:0,y:14.5},shR,{x:0,y:-13.5})
    };
    const constraints = [...Object.values(joints),...Object.values(seams)];`;
    if(!source.includes(jointsNeedle)) throw new Error('Segmented puppet patch failed: joint/seam construction');
    source = source.replace(jointsNeedle,jointsCode);

    const bodyListNeedle = `      torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,
      bodies:[torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR],
      constraints,joints,
      severedJoints:new Set(),`;
    const bodyListCode = `      torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,
      torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2,
      bodies:[torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2],
      constraints,joints,seams,seamMeta,
      brokenSeams:new Set(),
      severedJoints:new Set(),`;
    if(!source.includes(bodyListNeedle)) throw new Error('Segmented puppet patch failed: puppet body registry');
    source = source.replace(bodyListNeedle,bodyListCode);

    const grabBodyNeedle = `  function grabBody(p,part){
    if(part === 'head') return p.head;
    if(part === 'leftHand') return p.faL;
    if(part === 'rightHand') return p.faR;
    if(part === 'leftFoot') return p.shL;
    if(part === 'rightFoot') return p.shR;
    return p.torso;
  }`;
    const grabBodyCode = `  function grabBody(p,part){
    if(part === 'head') return p.head;
    if(part === 'leftHand') return p.faL2 || p.faL;
    if(part === 'rightHand') return p.faR2 || p.faR;
    if(part === 'leftFoot') return p.shL2 || p.shL;
    if(part === 'rightFoot') return p.shR2 || p.shR;
    return p.torso;
  }`;
    if(!source.includes(grabBodyNeedle)) throw new Error('Segmented puppet patch failed: grab body');
    source = source.replace(grabBodyNeedle,grabBodyCode);

    source = source.replace(`    if(part === 'leftHand') return worldPoint(p.faL,{x:0,y:23});`,`    if(part === 'leftHand') return worldPoint(p.faL2 || p.faL,{x:0,y:12});`);
    source = source.replace(`    if(part === 'rightHand') return worldPoint(p.faR,{x:0,y:23});`,`    if(part === 'rightHand') return worldPoint(p.faR2 || p.faR,{x:0,y:12});`);
    source = source.replace(`    if(part === 'leftFoot') return worldPoint(p.shL,{x:0,y:25});`,`    if(part === 'leftFoot') return worldPoint(p.shL2 || p.shL,{x:0,y:13.5});`);
    source = source.replace(`    if(part === 'rightFoot') return worldPoint(p.shR,{x:0,y:25});`,`    if(part === 'rightFoot') return worldPoint(p.shR2 || p.shR,{x:0,y:13.5});`);

    const handBodyNeedle = `  function handBody(p,hand){
    if(hand === 'left') return p.faL;
    if(hand === 'right') return p.faR;
    if(hand === 'leftFoot') return p.shL;
    if(hand === 'rightFoot') return p.shR;
    return null;
  }`;
    const handBodyCode = `  function handBody(p,hand){
    if(hand === 'left') return p.faL2 || p.faL;
    if(hand === 'right') return p.faR2 || p.faR;
    if(hand === 'leftFoot') return p.shL2 || p.shL;
    if(hand === 'rightFoot') return p.shR2 || p.shR;
    return null;
  }`;
    if(!source.includes(handBodyNeedle)) throw new Error('Segmented puppet patch failed: prop extremity body');
    source = source.replace(handBodyNeedle,handBodyCode);
    source = source.replace(
      `  function propGripLocalPoint(hand){
    return hand === 'leftFoot' || hand === 'rightFoot' ? {x:0,y:25} : {x:0,y:23};
  }`,
      `  function propGripLocalPoint(hand){
    return hand === 'leftFoot' || hand === 'rightFoot' ? {x:0,y:13.5} : {x:0,y:12};
  }`
    );

    const attachNeedle = `  function puppetPartForBody(body){
    if(!body) return null;
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        if(p[part] === body) return {slot:p.slot,part,body};
      }
    }
    return null;
  }`;
    const attachCode = `  function puppetPartForBody(body){
    if(!body) return null;
    if(Number.isInteger(body.plugin?.puppetalkSlot) && body.plugin?.puppetalkSegmentPart){
      return {slot:body.plugin.puppetalkSlot,part:body.plugin.puppetalkSegmentPart,body};
    }
    for(const p of puppets.values()){
      for(const part of ATTACHABLE_PARTS){
        if(p[part] === body) return {slot:p.slot,part,body};
      }
    }
    return null;
  }`;
    if(!source.includes(attachNeedle)) throw new Error('Segmented puppet patch failed: attachment body recognition');
    source = source.replace(attachNeedle,attachCode);

    const removeNeedle = `  function removePuppet(slot){`;
    const seamHelpers = `  function severSeam(p,name){
    if(!p?.seams?.[name] || p.brokenSeams?.has(name)) return false;
    Composite.remove(engine.world,p.seams[name]);
    p.brokenSeams.add(name);
    p.repairRequested = false;
    return true;
  }
  function seamCutPoint(p,name){
    const c=p?.seams?.[name];
    return c ? jointCutPoint(c) : null;
  }
  function repairBrokenSeams(p){
    if(!p?.repairRequested || !p.brokenSeams?.size) return;
    for(const name of [...p.brokenSeams]){
      const c=p.seams?.[name];
      if(!c?.bodyA || !c?.bodyB) continue;
      const a=jointWorldPoint(c,'A');
      const b=jointWorldPoint(c,'B');
      if(!a || !b) continue;
      const dx=b.x-a.x,dy=b.y-a.y;
      const gap=Math.hypot(dx,dy);
      if(gap < 20){
        Composite.add(engine.world,c);
        p.brokenSeams.delete(name);
        continue;
      }
      const pull=Math.min(.00032,.00011+gap*.0000024);
      const ma=Math.max(.2,c.bodyA.mass||1),mb=Math.max(.2,c.bodyB.mass||1);
      Body.applyForce(c.bodyA,a,{x:dx*pull*ma,y:dy*pull*ma});
      Body.applyForce(c.bodyB,b,{x:-dx*pull*mb,y:-dy*pull*mb});
      const rel=angleDelta(c.bodyB.angle||0,c.bodyA.angle||0);
      c.bodyA.torque += clamp(rel*.0025,-.012,.012);
      c.bodyB.torque -= clamp(rel*.0025,-.012,.012);
    }
    if(!p.brokenSeams.size && !p.severedJoints?.size) p.repairRequested=false;
  }

${removeNeedle}`;
    if(!source.includes(removeNeedle)) throw new Error('Segmented puppet patch failed: seam helpers');
    source = source.replace(removeNeedle,seamHelpers);

    const tickNeedle = `    puppets.forEach(p=>{ drivePuppet(p); repairSeveredJoints(p); });
    driveProps();`;
    const tickCode = `    puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); repairSeveredJoints(p); });
    driveProps();`;
    if(!source.includes(tickNeedle)) throw new Error('Segmented puppet patch failed: recovery tick');
    source = source.replace(tickNeedle,tickCode);

    const anatomyMarker = `  function anatomy(p){`;
    if(!source.includes(anatomyMarker)) throw new Error('Segmented puppet patch failed: anatomy hook');
    source = source.replace(anatomyMarker,`  function segmentState(body){ return {x:body.position.x/W,y:body.position.y/H,a:body.angle||0}; }\n${anatomyMarker}`);

    const anatomyHeadNeedle = `      head:{x:p.head.position.x/W,y:p.head.position.y/H,a:p.head.angle},`;
    const anatomyHeadCode = `      head:{x:(p.head.position.x+p.headTop.position.x)/(2*W),y:(p.head.position.y+p.headTop.position.y)/(2*H),a:((p.head.angle||0)+(p.headTop.angle||0))*.5},`;
    if(!source.includes(anatomyHeadNeedle)) throw new Error('Segmented puppet patch failed: virtual head');
    source = source.replace(anatomyHeadNeedle,anatomyHeadCode);

    const severedNeedle = `      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,severed:[...(p.severedJoints||[])],`;
    const severedCode = `      slot:p.slot,name:p.name,color:p.color,mouth:p.mouth,rag:p.rag,severed:[...(p.severedJoints||[])],brokenSeams:[...(p.brokenSeams||[])],
      segTorsoTop:segmentState(p.torsoTop),segTorsoBottom:segmentState(p.torsoBottom),
      segHeadLower:segmentState(p.head),segHeadTop:segmentState(p.headTop),`;
    if(!source.includes(severedNeedle)) throw new Error('Segmented puppet patch failed: seam scene state');
    source = source.replace(severedNeedle,severedCode);

    const endpointReplacements = [
      [`worldPoint(p.uaL,{x:0,y:25})`,`worldPoint(p.uaL2,{x:0,y:13})`],
      [`worldPoint(p.uaR,{x:0,y:25})`,`worldPoint(p.uaR2,{x:0,y:13})`],
      [`worldPoint(p.faL,{x:0,y:23})`,`worldPoint(p.faL2,{x:0,y:12})`],
      [`worldPoint(p.faR,{x:0,y:23})`,`worldPoint(p.faR2,{x:0,y:12})`],
      [`worldPoint(p.thL,{x:0,y:27})`,`worldPoint(p.thL2,{x:0,y:14.5})`],
      [`worldPoint(p.thR,{x:0,y:27})`,`worldPoint(p.thR2,{x:0,y:14.5})`],
      [`worldPoint(p.shL,{x:0,y:25})`,`worldPoint(p.shL2,{x:0,y:13.5})`],
      [`worldPoint(p.shR,{x:0,y:25})`,`worldPoint(p.shR2,{x:0,y:13.5})`],
      [`worldPoint(p.uaL,{x:0,y:-25})`,`worldPoint(p.uaL,{x:0,y:-13})`],
      [`worldPoint(p.uaR,{x:0,y:-25})`,`worldPoint(p.uaR,{x:0,y:-13})`],
      [`worldPoint(p.faL,{x:0,y:-23})`,`worldPoint(p.faL,{x:0,y:-12})`],
      [`worldPoint(p.faR,{x:0,y:-23})`,`worldPoint(p.faR,{x:0,y:-12})`],
      [`worldPoint(p.thL,{x:0,y:-27})`,`worldPoint(p.thL,{x:0,y:-14.5})`],
      [`worldPoint(p.thR,{x:0,y:-27})`,`worldPoint(p.thR,{x:0,y:-14.5})`],
      [`worldPoint(p.shL,{x:0,y:-25})`,`worldPoint(p.shL,{x:0,y:-13.5})`],
      [`worldPoint(p.shR,{x:0,y:-25})`,`worldPoint(p.shR,{x:0,y:-13.5})`]
    ];
    for(const [a,b] of endpointReplacements) source=source.split(a).join(b);

    const anatomyTailNeedle = `      thRt:norm(worldPoint(p.thR,{x:0,y:-14.5})),shRt:norm(worldPoint(p.shR,{x:0,y:-13.5}))`;
    const anatomyTailCode = `      thRt:norm(worldPoint(p.thR,{x:0,y:-14.5})),shRt:norm(worldPoint(p.shR,{x:0,y:-13.5})),
      uaLmA:norm(worldPoint(p.uaL,{x:0,y:13})),uaLmB:norm(worldPoint(p.uaL2,{x:0,y:-13})),
      faLmA:norm(worldPoint(p.faL,{x:0,y:12})),faLmB:norm(worldPoint(p.faL2,{x:0,y:-12})),
      uaRmA:norm(worldPoint(p.uaR,{x:0,y:13})),uaRmB:norm(worldPoint(p.uaR2,{x:0,y:-13})),
      faRmA:norm(worldPoint(p.faR,{x:0,y:12})),faRmB:norm(worldPoint(p.faR2,{x:0,y:-12})),
      thLmA:norm(worldPoint(p.thL,{x:0,y:14.5})),thLmB:norm(worldPoint(p.thL2,{x:0,y:-14.5})),
      shLmA:norm(worldPoint(p.shL,{x:0,y:13.5})),shLmB:norm(worldPoint(p.shL2,{x:0,y:-13.5})),
      thRmA:norm(worldPoint(p.thR,{x:0,y:14.5})),thRmB:norm(worldPoint(p.thR2,{x:0,y:-14.5})),
      shRmA:norm(worldPoint(p.shR,{x:0,y:13.5})),shRmB:norm(worldPoint(p.shR2,{x:0,y:-13.5}))`;
    if(!source.includes(anatomyTailNeedle)) throw new Error('Segmented puppet patch failed: seam endpoints');
    source = source.replace(anatomyTailNeedle,anatomyTailCode);

    const cutLoopNeedle = `      let best = null;
      for(const p of puppets.values()){
        if(!p.joints || !p.severedJoints) continue;
        for(const [name,constraint] of Object.entries(p.joints)){
          if(p.severedJoints.has(name)) continue;
          const q = jointCutPoint(constraint);
          if(!q) continue;
          const distance = pointSegmentDistance(q,previous,current);
          // The physical disc is ~23px radius, but only the central 13px joint corridor
          // counts as a cutting line. Ordinary limb/torso collisions therefore just bounce.
          if(distance <= 13 && (!best || distance < best.distance)) best = {p,name,distance};
        }
      }
      if(!best) continue;

      if(severJoint(best.p,best.name)){`;
    const cutLoopCode = `      let best = null;
      for(const p of puppets.values()){
        if(p.joints && p.severedJoints){
          for(const [name,constraint] of Object.entries(p.joints)){
            if(p.severedJoints.has(name)) continue;
            const q = jointCutPoint(constraint);
            if(!q) continue;
            const distance = pointSegmentDistance(q,previous,current);
            if(distance <= 13 && (!best || distance < best.distance)) best = {p,name,kind:'joint',distance};
          }
        }
        if(p.seams && p.brokenSeams){
          for(const [name,constraint] of Object.entries(p.seams)){
            if(p.brokenSeams.has(name)) continue;
            const q = seamCutPoint(p,name);
            if(!q) continue;
            const distance = pointSegmentDistance(q,previous,current);
            const radius = p.seamMeta?.[name]?.radius || 14;
            if(distance <= radius && (!best || distance < best.distance)) best = {p,name,kind:'seam',distance};
          }
        }
      }
      if(!best) continue;

      const cut = best.kind === 'seam' ? severSeam(best.p,best.name) : severJoint(best.p,best.name);
      if(cut){`;
    if(!source.includes(cutLoopNeedle)) throw new Error('Segmented puppet patch failed: frisbee seam candidates');
    source = source.replace(cutLoopNeedle,cutLoopCode);

    const pickupNeedle = `      prop._frisbeePrev = null;
    }`;
    if(source.includes(pickupNeedle)) source=source.replace(pickupNeedle,`      prop._frisbeePrev = null;\n      prop.body.isSensor = false;\n    }`);
    const throwSensorNeedle = `      prop._frisbeePrev = {x:prop.body.position.x,y:prop.body.position.y};`;
    if(!source.includes(throwSensorNeedle)) throw new Error('Segmented puppet patch failed: frisbee throw sensor');
    source = source.replace(throwSensorNeedle,`${throwSensorNeedle}\n      prop.body.isSensor = true;`);

    const speedNeedle = `      const edgeSpeed = linear+spin*23;
      if(linear < 5.6 || spin < .14 || edgeSpeed < 9.5){
        if(linear < 3.5 && age > 280) prop._cutArmed = false;
        continue;
      }`;
    const speedCode = `      const edgeSpeed = linear+spin*23;
      const dangerous = linear >= 5.2 && spin >= .12 && edgeSpeed >= 8.8;
      b.isSensor = !!(prop._cutArmed && dangerous);
      if(!dangerous){
        if(linear < 3.5 && age > 280) prop._cutArmed = false;
        if(!prop._cutArmed) b.isSensor = false;
        continue;
      }`;
    if(!source.includes(speedNeedle)) throw new Error('Segmented puppet patch failed: frisbee pass-through threshold');
    source = source.replace(speedNeedle,speedCode);
    source = source.replace(`        prop._cutArmed = false;\n        Body.setVelocity(b,`, `        prop._cutArmed = false;\n        b.isSensor = false;\n        Body.setVelocity(b,`);

    const severedRenderNeedle = `  const severed = new Set(Array.isArray(p.severed)?p.severed:[]);
  chain([severed.has('leftHip')?p.thLt:p.hl,p.kl],p.color,17);
  chain([severed.has('leftKnee')?p.shLt:p.kl,p.al],p.color,17);
  chain([severed.has('rightHip')?p.thRt:p.hr,p.kr],p.color,17);
  chain([severed.has('rightKnee')?p.shRt:p.kr,p.ar],p.color,17);
  chain([severed.has('leftShoulder')?p.uaLt:p.sl,p.el],p.color,15);
  chain([severed.has('leftElbow')?p.faLt:p.el,p.wl],p.color,15);
  chain([severed.has('rightShoulder')?p.uaRt:p.sr,p.er],p.color,15);
  chain([severed.has('rightElbow')?p.faRt:p.er,p.wr],p.color,15);`;
    const severedRenderCode = `  const severed = new Set(Array.isArray(p.severed)?p.severed:[]);
  const broken = new Set(Array.isArray(p.brokenSeams)?p.brokenSeams:[]);
  const splitChain = (start,a,b,end,seam,color,width)=>{
    if(broken.has(seam)){ chain([start,a],color,width); chain([b,end],color,width); }
    else chain([start,end],color,width);
  };
  splitChain(severed.has('leftHip')?p.thLt:p.hl,p.thLmA,p.thLmB,p.kl,'leftThigh',p.color,17);
  splitChain(severed.has('leftKnee')?p.shLt:p.kl,p.shLmA,p.shLmB,p.al,'leftShin',p.color,17);
  splitChain(severed.has('rightHip')?p.thRt:p.hr,p.thRmA,p.thRmB,p.kr,'rightThigh',p.color,17);
  splitChain(severed.has('rightKnee')?p.shRt:p.kr,p.shRmA,p.shRmB,p.ar,'rightShin',p.color,17);
  splitChain(severed.has('leftShoulder')?p.uaLt:p.sl,p.uaLmA,p.uaLmB,p.el,'leftUpperArm',p.color,15);
  splitChain(severed.has('leftElbow')?p.faLt:p.el,p.faLmA,p.faLmB,p.wl,'leftForearm',p.color,15);
  splitChain(severed.has('rightShoulder')?p.uaRt:p.sr,p.uaRmA,p.uaRmB,p.er,'rightUpperArm',p.color,15);
  splitChain(severed.has('rightElbow')?p.faRt:p.er,p.faRmA,p.faRmB,p.wr,'rightForearm',p.color,15);`;
    if(!source.includes(severedRenderNeedle)) throw new Error('Segmented puppet patch failed: limb seam renderer');
    source = source.replace(severedRenderNeedle,severedRenderCode);

    const torsoNeedle = `  const tx = p.torso.x*w;
  const ty = p.torso.y*h;
  ctx.save();
  ctx.translate(tx,ty);
  ctx.rotate(p.torso.a || 0);
  const tw = Math.max(20,48*scale);
  const th = Math.max(34,78*scale);
  ctx.fillStyle = '#08090a';
  roundRect(ctx,-tw/2-3,-th/2-3,tw+6,th+6,Math.max(7,13*scale));
  ctx.fill();
  ctx.fillStyle = p.color;
  roundRect(ctx,-tw/2,-th/2,tw,th,Math.max(6,11*scale));
  ctx.fill();
  ctx.restore();`;
    const torsoCode = `  const drawSegmentRect = (q,pw,ph,radius)=>{
    if(!q) return;
    const x=q.x*w,y=q.y*h,sw=Math.max(8,pw*scale),sh=Math.max(8,ph*scale);
    ctx.save();ctx.translate(x,y);ctx.rotate(q.a||0);
    ctx.fillStyle='#08090a';roundRect(ctx,-sw/2-3,-sh/2-3,sw+6,sh+6,Math.max(4,radius*scale));ctx.fill();
    ctx.fillStyle=p.color;roundRect(ctx,-sw/2,-sh/2,sw,sh,Math.max(3,(radius-2)*scale));ctx.fill();ctx.restore();
  };
  const torsoSplit = broken.has('torsoUpper') || broken.has('torsoLower');
  if(torsoSplit){
    drawSegmentRect(p.segTorsoTop,48,26,7);
    drawSegmentRect(p.torso,48,26,7);
    drawSegmentRect(p.segTorsoBottom,48,26,7);
  }else{
    const tx = p.torso.x*w;
    const ty = p.torso.y*h;
    ctx.save();
    ctx.translate(tx,ty);
    ctx.rotate(p.torso.a || 0);
    const tw = Math.max(20,48*scale);
    const th = Math.max(34,78*scale);
    ctx.fillStyle = '#08090a';
    roundRect(ctx,-tw/2-3,-th/2-3,tw+6,th+6,Math.max(7,13*scale));
    ctx.fill();
    ctx.fillStyle = p.color;
    roundRect(ctx,-tw/2,-th/2,tw,th,Math.max(6,11*scale));
    ctx.fill();
    ctx.restore();
  }`;
    if(!source.includes(torsoNeedle)) throw new Error('Segmented puppet patch failed: torso renderer');
    source = source.replace(torsoNeedle,torsoCode);

    const headNeedle = `  const hx = p.head.x*w;`;
    const headCode = `  if(broken.has('headMiddle')){
    drawSegmentRect(p.segHeadLower,44,24,11);
    drawSegmentRect(p.segHeadTop,44,24,11);
    ctx.restore();
    return;
  }

  const hx = p.head.x*w;`;
    if(!source.includes(headNeedle)) throw new Error('Segmented puppet patch failed: head renderer');
    source = source.replace(headNeedle,headCode);

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
