import fs from 'node:fs';
import assert from 'node:assert/strict';
import {composeFinalSource} from './build-final.mjs';

const generatedPath='translation/generated/app-final.js';
assert.ok(fs.existsSync(generatedPath),'Committed final Puppetalk source is missing.');

const expectedRaw=await composeFinalSource();
const expected=expectedRaw.endsWith('\n')?expectedRaw:`${expectedRaw}\n`;
const actual=fs.readFileSync(generatedPath,'utf8');
assert.equal(actual,expected,'Committed final Puppetalk source has drifted from frozen V1 boot output.');
new Function(actual);
console.log(`Final translated source exactly matches frozen V1 boot output (${actual.length} chars).`);
