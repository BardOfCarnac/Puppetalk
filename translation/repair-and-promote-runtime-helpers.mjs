import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const prior='522fe5b0292bf72b10b976dda8a05a960d6a70f9';
execFileSync('git',['fetch','origin',prior,'--depth=1'],{stdio:'inherit'});
const old=execFileSync('git',['show',`${prior}:translation/runtime-parity-smoke.mjs`],{encoding:'utf8'});
const stale="assert.match(actual,/function savedLook\\(\\)/,'Legacy renderer prune crossed into live saved-look code.');";
const fresh=[
  "assert.match(actual,/const runtimeHelpers = window\\.PuppetalkRuntimeHelpers\\?\\.create\\?\\.\\(\\{/,'Runtime is not bound to extracted frozen runtime helpers.');",
  "assert.match(actual,/const \\{clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta\\} = runtimeHelpers;/,'Runtime helper callers are not bound to the extracted helper module.');",
  "assert.doesNotMatch(actual,/function savedLook\\(\\)/,'Embedded savedLook survived runtime-helper extraction.');",
  "assert.doesNotMatch(actual,/function saveLook\\(look\\)/,'Embedded saveLook survived runtime-helper extraction.');",
  "assert.doesNotMatch(actual,/const clamp = \\(v,a,b\\) => Math\\.max\\(a,Math\\.min\\(b,v\\)\\);/,'Embedded clamp survived runtime-helper extraction.');",
  "assert.doesNotMatch(actual,/function roomCode\\(\\)/,'Embedded roomCode survived runtime-helper extraction.');",
  "assert.doesNotMatch(actual,/function angleDelta\\(target,current\\)/,'Embedded angleDelta survived runtime-helper extraction.');"
].join('\n');
if(!old.includes(stale)) throw new Error('Could not find stale savedLook parity assertion in known-good contract.');
fs.writeFileSync('translation/runtime-parity-smoke.mjs',old.replace(stale,fresh));
console.log('Restored full runtime parity contract and updated it for extracted helpers.');
