import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const out='/tmp/puppetalk-translated-runtime.js';
execFileSync(process.execPath,['translation/build-runtime.mjs',out],{stdio:'inherit'});
const actual=fs.readFileSync(out,'utf8');

assert.match(actual,/\(function\(\)\{/,'Translated runtime wrapper missing.');
assert.match(actual,/const \{LOOK_PALETTE,LOOK_PARTS,defaultLook,cleanLook\} = window\.PuppetalkLookModel \|\| \{\};/,'Runtime is not bound to the extracted look model.');
assert.match(actual,/const runtimeHelpers = window\.PuppetalkRuntimeHelpers\?\.create\?\.\(\{/,'Runtime is not bound to extracted frozen runtime helpers.');
assert.match(actual,/const \{clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,savedLook,saveLook,roomCode,angleDelta\} = runtimeHelpers;/,'Runtime helper callers are not bound to the extracted helper module.');
assert.doesNotMatch(actual,/function savedLook\(\)/,'Embedded saved-look helper survived runtime-helper extraction.');
assert.doesNotMatch(actual,/function saveLook\(look\)/,'Embedded save-look helper survived runtime-helper extraction.');
assert.doesNotMatch(actual,/const clamp = \(v,a,b\) => Math\.max\(a,Math\.min\(b,v\)\);/,'Embedded clamp helper survived runtime-helper extraction.');
assert.doesNotMatch(actual,/function roomCode\(\)/,'Embedded room-code helper survived runtime-helper extraction.');
assert.doesNotMatch(actual,/function angleDelta\(target,current\)/,'Embedded angle helper survived runtime-helper extraction.');

// The remainder of this smoke file is intentionally generated from the prior contract below.
