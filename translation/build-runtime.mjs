import fs from 'node:fs';

const input='translation/generated/app-final.js';
const output=process.argv[2]||'translation/runtime/app.js';
let source=fs.readFileSync(input,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Could not find ${label} in frozen final source.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce('pose/grab constants',`const POSES = {
  stand:  [.12,.05,-.12,-.05,.04,.02,-.04,-.02,0],
  point:  [1.48,1.48,-.18,-.08,.02,0,-.03,0,-.05],
  cheer:  [2.55,2.75,-2.55,-2.75,.08,-.04,-.08,.04,0],
  shrug:  [1.02,1.9,-1.02,-1.9,.03,0,-.03,0,0],
  crouch: [.25,.5,-.25,-.5,.38,-.55,-.38,.55,.13]
};
const GRAB_PARTS = new Set(['torso','pelvis','leftShoulder','rightShoulder','head','leftHand','rightHand','leftFoot','rightFoot']);`, `const {
  POSES,GRAB_PARTS,ensureRig,resetPins,antiTangleTarget,rootFollow
} = window.PuppetalkCharacterRigCore || {};
if(!POSES || !GRAB_PARTS || !ensureRig || !resetPins || !antiTangleTarget || !rootFollow){
  throw new Error('Puppetalk character rig core failed to load.');
}`);

replaceOnce('embedded rig helpers',`  function ensureRig(p){
    if(p._rig) return p._rig;
    p._rig = {
      sessions:{},
      lastPose:p.pose,
      lastPoseVersion:p.poseVersion || 0,
      pins:{head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null}
    };
    return p._rig;
  }

  function antiTangleTarget(p,part,desired,age){
    if(!(part.includes('Hand') || part.includes('Foot'))) return desired;
    const t = p.torso.position;
    let clear = desired;
    if(part === 'leftHand') clear = {x:t.x-54,y:t.y+4};
    if(part === 'rightHand') clear = {x:t.x+54,y:t.y+4};
    if(part === 'leftFoot') clear = {x:t.x-23,y:t.y+132};
    if(part === 'rightFoot') clear = {x:t.x+23,y:t.y+132};
    const fade = 1-clamp(age/190,0,1);
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

`,``);

replaceOnce('pose pin reset',`      rig.pins = {head:null,leftHand:null,rightHand:null,leftFoot:null,rightFoot:null};`,`      resetPins(rig);`);

new Function(source);
fs.mkdirSync('translation/runtime',{recursive:true});
fs.writeFileSync(output,source.endsWith('\n')?source:`${source}\n`,'utf8');
console.log(`Built ${output}: character rig core extracted without changing force/servo code.`);