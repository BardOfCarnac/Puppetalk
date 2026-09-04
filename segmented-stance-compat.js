// Keeps the accepted Puppetalk standing/jump rig compatible with pre-segmented bodies.
// The old rig targets whole-limb centres. Segmented puppets expose proximal control
// bodies plus distal pieces, so pulls must target the correct half/body or they create
// large artificial torques and crooked resting poses.
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
`    const legSpread = crouched ? 22 : 16;
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
      "springPull(p.shL2 || p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00017,.0059);"
    );
    patched = patched.replace(
      "springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);",
      "springPull(p.shR2 || p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);"
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

    // The old single-piece arms were stable enough with angle servos alone. The
    // extra seam degree of freedom benefits from a very soft neutral hand target in
    // Stand. It is deliberately weak: grabs/pins still win immediately and other
    // poses remain untouched.
    patched = patched.replace(
`    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');`,
`    if(p.pose === 'stand' && !rig.air?.active){
      if(!activeParts.has('leftHand') && !rig.pins.leftHand){
        springPull(grabBody(p,'leftHand'),grabWorldPoint(p,'leftHand'),{x:anchorX-42,y:standingY+53},.000052,.0051);
      }
      if(!activeParts.has('rightHand') && !rig.pins.rightHand){
        springPull(grabBody(p,'rightHand'),grabWorldPoint(p,'rightHand'),{x:anchorX+42,y:standingY+53},.000052,.0051);
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
  window.PuppetalkSegmentedStanceCompat = { version: 1 };
})();
