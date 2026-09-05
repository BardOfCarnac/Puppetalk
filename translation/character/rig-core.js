// Behaviour-preserving character rig constants/helpers translated from frozen V1.
// Keep numeric values and mutability identical until the character parity suite explicitly allows change.
(() => {
  const POSES = {
    stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
    point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
    cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
    shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
    crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
  };

  const GRAB_PART_NAMES = [
    'torso','pelvis','leftShoulder','rightShoulder','head',
    'leftHand','rightHand','leftFoot','rightFoot'
  ];
  const GRAB_PARTS = new Set(GRAB_PART_NAMES);

  function makePins(){
    return {head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null};
  }

  function ensureRig(p){
    if(p._rig) return p._rig;
    p._rig = {
      sessions:{},
      lastPose:p.pose,
      lastPoseVersion:p.poseVersion || 0,
      pins:makePins()
    };
    return p._rig;
  }

  function resetPins(rig){
    rig.pins = makePins();
    return rig.pins;
  }

  function antiTangleTarget(p,part,desired,age){
    if(!(part.includes('Hand') || part.includes('Foot'))) return desired;
    const t = p.torso.position;
    let clear = desired;
    if(part === 'leftHand') clear = {x:t.x-54,y:t.y+4};
    if(part === 'rightHand') clear = {x:t.x+54,y:t.y+4};
    if(part === 'leftFoot') clear = {x:t.x-23,y:t.y+132};
    if(part === 'rightFoot') clear = {x:t.x+23,y:t.y+132};
    const fade = 1-Math.max(0,Math.min(1,age/190));
    const amount = .3*fade;
    return {x:desired.x+(clear.x-desired.x)*amount,y:desired.y+(clear.y-desired.y)*amount};
  }

  function rootFollow(part){
    if(part === 'torso') return 1;
    if(part === 'pelvis') return .92;
    if(part.includes('Shoulder')) return .82;
    if(part === 'head') return .72;
    if(part.includes('Hand')) return .42;
    return .3;
  }

  window.PuppetalkCharacterRigCore = {
    POSES,
    GRAB_PART_NAMES,
    GRAB_PARTS,
    ensureRig,
    resetPins,
    antiTangleTarget,
    rootFollow
  };
})();