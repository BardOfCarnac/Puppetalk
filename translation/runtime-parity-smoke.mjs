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
assert.match(actual,/PuppetalkRecoverySystem/,'Translated runtime is not connected to extracted recovery system.');
assert.match(actual,/PuppetalkCharacterSceneState/,'Translated runtime is not connected to extracted character scene state.');
assert.match(actual,/PuppetalkCharacterInputSystem/,'Translated runtime is not connected to extracted character input system.');
assert.match(actual,/PuppetalkPuppetDriver/,'Translated runtime is not connected to extracted puppet driver.');
assert.match(actual,/PuppetalkPuppetLifecycle/,'Translated runtime is not connected to extracted puppet lifecycle.');
assert.match(actual,/PuppetalkStageLoop/,'Translated runtime is not connected to extracted stage loop.');
assert.match(actual,/PuppetalkHostSession/,'Translated runtime is not connected to extracted host session.');

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
assert.doesNotMatch(actual,/function severJoint\(p,name\)/,'Embedded severJoint survived recovery-system extraction.');
assert.doesNotMatch(actual,/function repairSeveredJoints\(p\)/,'Embedded repairSeveredJoints survived recovery-system extraction.');
assert.doesNotMatch(actual,/function handleJointRecovery\(slot,msg\)/,'Embedded handleJointRecovery survived recovery-system extraction.');
assert.doesNotMatch(actual,/function severSeam\(p,name\)/,'Embedded severSeam survived recovery-system extraction.');
assert.doesNotMatch(actual,/function repairBrokenSeams\(p\)/,'Embedded repairBrokenSeams survived recovery-system extraction.');
assert.doesNotMatch(actual,/function drivePuppet\(p\)/,'Embedded drivePuppet survived puppet-driver extraction.');
assert.doesNotMatch(actual,/function removePuppet\(slot\)/,'Embedded removePuppet survived puppet-lifecycle extraction.');
assert.doesNotMatch(actual,/function norm\(point\)/,'Embedded norm survived scene-state extraction.');
assert.doesNotMatch(actual,/function segmentState\(body\)/,'Embedded segmentState survived scene-state extraction.');
assert.doesNotMatch(actual,/function anatomy\(p\)/,'Embedded anatomy survived scene-state extraction.');
assert.doesNotMatch(actual,/function applyInput\(slot,msg\)/,'Embedded applyInput survived input-system extraction.');
assert.doesNotMatch(actual,/function drawStage\(\)/,'Embedded drawStage survived stage-loop extraction.');
assert.doesNotMatch(actual,/function broadcastScene\(now\)/,'Embedded broadcastScene survived stage-loop extraction.');
assert.doesNotMatch(actual,/function tick\(now\)/,'Embedded tick survived stage-loop extraction.');
assert.doesNotMatch(actual,/function updateStatus\(extra=''\)/,'Embedded updateStatus survived host-session extraction.');
assert.doesNotMatch(actual,/function freeSlot\(\)/,'Embedded freeSlot survived host-session extraction.');
assert.doesNotMatch(actual,/const peer = new Peer\(peerId\(room\)\);/,'Embedded host Peer construction survived host-session extraction.');

assert.match(actual,/const \{makePuppet\} = rigFactory;/,'Runtime callers are not bound to the extracted makePuppet.');
assert.match(actual,/const \{severJoint,repairSeveredJoints,handleJointRecovery,severSeam,repairBrokenSeams\} = recoverySystem;/,'Runtime callers are not bound to the extracted recovery system.');
assert.match(actual,/const \{anatomy\} = sceneState;/,'Runtime callers are not bound to the extracted anatomy serializer.');
assert.match(actual,/const \{applyInput\} = inputSystem;/,'Runtime callers are not bound to the extracted input normalizer.');
assert.match(actual,/const \{drivePuppet\} = puppetDriver;/,'Runtime callers are not bound to the extracted puppet driver.');
assert.match(actual,/const \{removePuppet\} = puppetLifecycle;/,'Runtime callers are not bound to the extracted puppet lifecycle.');
assert.match(actual,/const \{drawStage,broadcastScene,tick\} = stageLoop;/,'Runtime callers are not bound to the extracted stage loop.');
assert.match(actual,/const \{peer,updateStatus,freeSlot\} = hostSession;/,'Runtime is not bound to the extracted host session.');

for(const invariant of [
  "addEventListener('resize',resize,{passive:true});",
  'installPropContactPhysics();',
  'requestAnimationFrame(tick);'
]){
  assert.ok(actual.includes(invariant),`Post-network startup invariant changed during extraction: ${invariant}`);
}

console.log('Translated runtime matches frozen V1 with character systems, stage loop and host session extracted.');
