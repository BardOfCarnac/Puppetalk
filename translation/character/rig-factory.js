// Candidate extraction of frozen V1 makePuppet().
// Not wired into the live translation until its construction contract is proven.
(() => {
  function create({Bodies,Body,Composite,Constraint,engine,puppets,getDimensions,NAMES,COLORS,defaultLook}){
    if(!Bodies?.rectangle || !Body?.nextGroup || !Composite?.add || !Constraint?.create){
      throw new Error('Puppetalk rig factory requires Matter body/constraint constructors.');
    }
    if(!engine?.world || !puppets || typeof getDimensions!=='function' || typeof defaultLook!=='function'){
      throw new Error('Puppetalk rig factory requires engine, puppet map, dimensions and defaultLook.');
    }

    const joint = (a,pa,b,pb,stiff=.97) => Constraint.create({
      bodyA:a,pointA:pa,bodyB:b,pointB:pb,length:1,stiffness:stiff,damping:.13
    });

    function tagHiddenSegment(body,slot,part,segment){
      body.plugin = body.plugin || {};
      delete body.plugin.puppetalkPart;
      body.plugin.puppetalkSegmentPart = part;
      body.plugin.puppetalkSegment = segment;
      body.plugin.puppetalkSlot = slot;
      return body;
    }

    function makePuppet(slot){
      if(puppets.has(slot)) return puppets.get(slot);
      const {W,H}=getDimensions();
      const x = W*(.16+slot*.135);
      const y = Math.min(H-170,H*.62);
      const group = Body.nextGroup(true);
      const opt = {collisionFilter:{group},frictionAir:.04,restitution:.08,friction:.8};

      // Canonical first ten: creation order is part of the frozen behaviour contract.
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
      const shR2 = tagHiddenSegment(Bodies.rectangle(x+14,y+131.5,17,27,opt),slot,'shR','distal');

      const seams = {
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
      const constraints = [...Object.values(joints),...Object.values(seams)];
      const puppet = {
        slot,
        name:NAMES[slot] || `Puppet ${slot+1}`,
        color:COLORS[slot] || '#aaa',
        look:defaultLook(slot),
        torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,
        torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2,
        bodies:[torso,head,uaL,faL,uaR,faR,thL,shL,thR,shR,torsoTop,torsoBottom,headTop,uaL2,faL2,uaR2,faR2,thL2,shL2,thR2,shR2],
        constraints,joints,seams,seamMeta,
        brokenSeams:new Set(),
        severedJoints:new Set(),
        recoverVersion:0,
        repairRequested:false,
        target:{x:x/W,y:y/H},
        grabTarget:{x:x/W,y:y/H},
        grabPart:'torso',
        grabbing:false,
        pose:'stand',
        rag:false,
        mouth:0
      };
      Composite.add(engine.world,[...puppet.bodies,...constraints]);
      puppets.set(slot,puppet);
      return puppet;
    }

    return {makePuppet,tagHiddenSegment,joint};
  }

  window.PuppetalkRigFactory = {create};
})();