import fs from 'node:fs';
import vm from 'node:vm';

class FakeBlob {
  constructor(parts=[],options={}){ this.parts=parts; this.type=options.type||''; }
}

const window={Blob:FakeBlob};
const context={window,console};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('segmented-stance-compat.js','utf8'),context,{filename:'segmented-stance-compat.js'});

const source=`
// PUPPETALK_SEGMENTED_PUPPET_V1
function airborneBodies(p){
  return [p.torso,p.head,p.uaL,p.faL,p.uaR,p.faR,p.thL,p.shL,p.thR,p.shR].filter(Boolean);
}
function drivePuppet(p){
    const legSpread = crouched ? 22 : 16;
    const thighY = standingY+(crouched ? 48 : 61);
    const shinY = standingY+(crouched ? 88 : 112);
    const footY = floorY-2;
    if(!activeParts.has('leftFoot') && !rig.pins.leftFoot && !rig.air?.active){
      springPull(p.shL,p.shL.position,{x:anchorX-legSpread,y:shinY},.0001,.0057);
      springPull(p.shL,grabWorldPoint(p,'leftFoot'),{x:anchorX-legSpread,y:footY},.00017,.0059);
    }
    if(!activeParts.has('rightFoot') && !rig.pins.rightFoot && !rig.air?.active){
      springPull(p.shR,p.shR.position,{x:anchorX+legSpread,y:shinY},.0001,.0057);
      springPull(p.shR,grabWorldPoint(p,'rightFoot'),{x:anchorX+legSpread,y:footY},.00017,.0059);
    }
    const headY = rig.air?.active ? t.position.y-65 : standingY-65;
    springPull(p.head,p.head.position,{x:anchorX,y:headY},.000095,.0046);
    const leftFoot = grabWorldPoint(p,'leftFoot');
    const rightFoot = grabWorldPoint(p,'rightFoot');
}
  function repairBrokenSeams(p){}
function repairSeveredJoints(p){}
function tick(){
    puppets.forEach(p=>{ drivePuppet(p); repairBrokenSeams(p); repairSeveredJoints(p); });
}
`;

const blob=new window.Blob([source],{type:'text/javascript'});
const out=String(blob.parts[0]);
for(const expected of [
  'const wholeThighY = standingY+(crouched ? 48 : 61);',
  "springPull(p.shL2 || p.shL,grabWorldPoint(p,'leftFoot')",
  "springPull(p.shR2 || p.shR,grabWorldPoint(p,'rightFoot')",
  'const headOffset = p.headTop ? 12 : 0;',
  "p.pose === 'stand' && !rig.air?.active",
  'p.torsoTop,p.torsoBottom',
  'function stabilizeIntactSeams(p)',
  'c.stiffness = .999;',
  'delta*.040+relativeSpin*.012',
  'repairBrokenSeams(p); stabilizeIntactSeams(p); repairSeveredJoints(p);',
  'p.faL2',
  'p.shR2'
]){
  if(!out.includes(expected)) throw new Error('Missing segmented stance compatibility hook: '+expected);
}
console.log('Segmented stance compatibility smoke check passed.');
