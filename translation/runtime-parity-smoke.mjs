import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const temp='/tmp/puppetalk-translated-runtime.js';
execFileSync(process.execPath,['translation/build-runtime.mjs',temp],{stdio:'inherit'});
const expected=fs.readFileSync(temp,'utf8');
const actual=fs.readFileSync('translation/runtime/app.js','utf8');
assert.equal(actual,expected,'Committed translated runtime drifted from deterministic extraction.');

assert.match(actual,/PuppetalkCharacterRigCore/,'Translated runtime is not connected to extracted rig core.');
assert.doesNotMatch(actual,/function ensureRig\(p\)/,'Embedded ensureRig survived character extraction.');
assert.doesNotMatch(actual,/function antiTangleTarget\(p,part,desired,age\)/,'Embedded antiTangleTarget survived character extraction.');
assert.doesNotMatch(actual,/function rootFollow\(part\)/,'Embedded rootFollow survived character extraction.');
assert.match(actual,/resetPins\(rig\);/,'Translated pose-change path is not using extracted pin reset.');

for(const invariant of [
  'function drivePuppet(p){',
  'springPull(body,point,item.guided,strength,.0026);',
  'servo(t,base+balanceLean,.018*muscle);',
  "servo(p.head,base*.2,.011*muscle);",
  'const strength = i < 4 ? (i%2 ? .0062 : .0072) : (i%2 ? .014 : .0155);'
]){
  assert.ok(actual.includes(invariant),`Character force/servo invariant changed during extraction: ${invariant}`);
}

console.log('Translated character runtime deterministically matches the frozen V1 program plus rig-core extraction.');
