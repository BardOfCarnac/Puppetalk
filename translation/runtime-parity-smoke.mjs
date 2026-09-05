import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const temp='/tmp/puppetalk-translated-runtime.js';
execFileSync(process.execPath,['translation/build-runtime.mjs',temp],{stdio:'inherit'});
const expected=fs.readFileSync(temp,'utf8');
const actual=fs.readFileSync('translation/runtime/app.js','utf8');
assert.equal(actual,expected,'Committed translated runtime drifted from deterministic extraction.');

assert.match(actual,/PuppetalkCharacterRigCore/,'Translated runtime is not connected to extracted rig core.');
assert.match(actual,/PuppetalkGrabGeometry/,'Translated runtime is not connected to extracted grab geometry.');
assert.match(actual,/PuppetalkDriveForces/,'Translated runtime is not connected to extracted drive forces.');
assert.match(actual,/PuppetalkRecoveryGeometry/,'Translated runtime is not connected to extracted recovery geometry.');
assert.match(actual,/PuppetalkRigFactory/,'Translated runtime is not connected to extracted rig factory.');
assert.doesNotMatch(actual,/function makePuppet\(slot\)/,'Embedded makePuppet survived rig-factory extraction.');
assert.doesNotMatch(actual,/function tagHiddenSegment\(body,slot,part,segment\)/,'Embedded tagHiddenSegment survived rig-factory extraction.');
assert.doesNotMatch(actual,/const joint = \(a,pa,b,pb,stiff=/,'Embedded rig joint constructor survived rig-factory extraction.');
assert.doesNotMatch(actual,/function ensureRig\(p\)/,'Embedded ensureRig survived character extraction.');
assert.doesNotMatch(actual,/function antiTangleTarget\(p,part,desired,age\)/,'Embedded antiTangleTarget survived character extraction.');
assert.doesNotMatch(actual,/function rootFollow\(part\)/,'Embedded rootFollow survived character extraction.');
assert.doesNotMatch(actual,/function worldPoint\(body,local\)/,'Embedded worldPoint survived grab-geometry extraction.');
assert.doesNotMatch(actual,/function grabBody\(p,part\)/,'Embedded grabBody survived grab-geometry extraction.');
assert.doesNotMatch(actual,/function grabWorldPoint\(p,part\)/,'Embedded grabWorldPoint survived grab-geometry extraction.');
assert.doesNotMatch(actual,/function servo\(body,target,strength=/,'Embedded servo survived drive-force extraction.');
assert.doesNotMatch(actual,/function springPull\(body,point,target,stiffness/,'Embedded springPull survived drive-force extraction.');
assert.doesNotMatch(actual,/function jointWorldPoint\(constraint,side\)/,'Embedded jointWorldPoint survived recovery-geometry extraction.');
assert.doesNotMatch(actual,/function jointGap\(constraint\)/,'Embedded jointGap survived recovery-geometry extraction.');
assert.doesNotMatch(actual,/function jointCutPoint\(constraint\)/,'Embedded jointCutPoint survived recovery-geometry extraction.');
assert.doesNotMatch(actual,/function seamCutPoint\(p,name\)/,'Embedded seamCutPoint survived recovery-geometry extraction.');
assert.match(actual,/const \{makePuppet\} = rigFactory;/,'Runtime callers are not bound to the extracted makePuppet.');
assert.match(actual,/resetPins\(rig\);/,'Translated pose-change path is not using extracted pin reset.');

for(const invariant of [
  'function severJoint(p,name){',
  'function repairSeveredJoints(p){',
  'function repairBrokenSeams(p){',
  'function drivePuppet(p){',
  'springPull(body,point,item.guided,strength,.0026);',
  'servo(t,base+balanceLean,.018*muscle);',
  "servo(p.head,base*.2,.011*muscle);",
  'const strength = i < 4 ? (i%2 ? .0062 : .0072) : (i%2 ? .014 : .0155);'
]){
  assert.ok(actual.includes(invariant),`Character/recovery call-site invariant changed during extraction: ${invariant}`);
}

console.log('Translated character runtime matches frozen V1 with rig construction and helper seams extracted.');