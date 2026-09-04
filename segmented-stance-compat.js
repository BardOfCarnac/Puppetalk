// Keeps the accepted Puppetalk standing/jump rig compatible with pre-segmented bodies.
// Uncut destructible seams must behave like rigid welds: the extra hidden segmentation
// is for cutting, not an extra set of visible joints or pseudo-3D foreshortening.
(() => {
  const NativeBlob = window.Blob;
  if (!NativeBlob || window.PuppetalkSegmentedStanceCompat) return;

  function patchPuppetSource(source) {
    if (typeof source !== 'string' || !source.includes('PUPPETALK_SEGMENTED_PUPPET_V1')) return source;
    let patched = source;

    patched = patched.replace(
`    const legSpread = crouched ? 22 : 16;
    const thighY = standingY+(crouched ? 48 : 61);
    const shinY = standingY+(crouched ? 88 : 112);
    const footY = floorY-2;`,
`    const legSpread = crouched ? 22 : 12;
    // thighY/shinY describe the centre of the historic whole limb. The control
    // bodies are now the proximal halves, so shift their centre targets upward.
    const wholeThighY = standingY+(crouched ? 48 : 61);
    const wholeShinY = standingY+(crouched ? 88 : 112);
    const thighY = wholeThighY-(p.thL2 ? 14.5 : 0);
    const shinY = wholeShinY-(p.shL2 ? 13.5 : 0);
    const footY = floorY-2;`
    );

    patched = patched.replace(
      "springPull(p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00017,.0059);",
      "springPull(p.shL2 || p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},crouched?.00017:.00023,crouched?.0059:.0065);"
    );
    patched = patched.replace(
      "springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);",
      "springPull(p.shR2 || p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},crouched?.00017:.00023,crouched?.0059:.0065);"
    );

    // jump-feel has already rewritten this support by the time this Blob wrapper
    // runs. Keep the rendered/virtual head centred at the old -65 position by
    // targeting the lower physical half 12px lower.
    patched = patched.replace(
      "const headY = rig.air?.active ? t.position.y-65 : standingY-65;",
      "const headOffset = p.headTop ? 12 : 0;\n      const headY = rig.air?.active ? t.position.y-65+headOffset : standingY-65+headOffset;"
    );

    // Segmentation adds extra physical mass pieces. Float/jump counter-gravity must
    // act on all of them, not only the ten legacy control bodies.
    patched = patched.replace(
      "return [p.torso,p.head,p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].filter(Boolean);",
      "return [p.torso,p.torsoTop,p.torsoBottom,p.head,p.headTop,p.uaL,p.uaL2,p.faL,p.faL2,p.uaR,p.uaR2,p.faR,p.faR2,p.thL,p.thL2,p.shL,p.shL2,p.thR,p.thR2,p.shR,p.shR2].filter(Boolean);"
    );

    // A one-point Matter constraint is a hinge. That is correct for shoulders/knees,
    // but wrong for the hidden destructible seams in the middle of a limb. While a
    // seam is intact, restore near-rigid linear stiffness and strongly align the two
    // segment angles. Once severSeam marks it broken, all of this disappears.
    patched = patched.replace(
`  function repairBrokenSeams(p){`,
`  function stabilizeIntactSeams(p){
    if(!p?.seams) return;
    for(const [name,c] of Object.entries(p.seams)){
      if(!c?.bodyA || !c?.bodyB || p.brokenSeams?.has(name)) continue;

      c.stiffness = .999;
      c.damping = Math.max(.28,c.damping || 0);

      const a=c.bodyA, b=c.bodyB;
      let delta=(b.angle||0)-(a.angle||0);
      while(delta>Math.PI) delta-=Math.PI*2;
      while(delta< -Math.PI) delta+=Math.PI*2;
      const relativeSpin=(b.angularVelocity||0)-(a.angularVelocity||0);
      const correction=clamp(delta*.040+relativeSpin*.012,-.075,.075);
      a.torque += correction;
      b.torque -= correction;
    }
  }

  function repairBrokenSeams(p){`
    );

    patched = patched.replace(
      `puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); repairSeveredJoints(p); });`,
      `puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); stabilizeIntactSeams(p); repairSeveredJoints(p); });`
    );

    // In Stand the hands should settle into the same narrow neutral silhouette shown
    // on the character card, while manual grabs still override this immediately.
    patched = patched.replace(
`    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');`,
`    if(p.pose === 'stand' && !rig.air?.active){
      if(!activeParts.has('leftHand') && !rig.pins.leftHand){
        springPull(grabBody(p,'leftHand'),grabWorldPoint(p,'leftHand'),{x:anchorX-34,y:standingY+50},.00012,.0062);
      }
      if(!activeParts.has('rightHand') && !rig.pins.rightHand){
        springPull(grabBody(p,'rightHand'),grabWorldPoint(p,'rightHand'),{x:anchorX+34,y:standingY+50},.00012,.0062);
      }
    }

    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');`
    );

    return patched;
  }

  function SegmentedStanceBlob(parts = [], options = {}) {
    let nextParts = parts;
    if (options?.type === 'text/javascript' && parts.length === 1 && typeof parts[0] === 'string') {
      const patched = patchPuppetSource(parts[0]);
      if (patched !== parts[0]) nextParts = [patched];
    }
    return new NativeBlob(nextParts, options);
  }

  SegmentedStanceBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(SegmentedStanceBlob, NativeBlob);
  window.Blob = SegmentedStanceBlob;
  window.PuppetalkSegmentedStanceCompat = { version: 4 };
})();
