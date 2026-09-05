import fs from 'node:fs';
import assert from 'node:assert/strict';
import {composePrebootSource} from './build-preboot.mjs';

const generatedPath = 'translation/generated/app-preboot.js';
assert.ok(fs.existsSync(generatedPath),'Committed translated preboot source is missing.');

const expectedRaw = await composePrebootSource();
const expected = expectedRaw.endsWith('\n') ? expectedRaw : `${expectedRaw}\n`;
const actual = fs.readFileSync(generatedPath,'utf8');

assert.equal(
  actual,
  expected,
  'Committed translated preboot source has drifted from the frozen V1 decorator pipeline.'
);

console.log(`Generated preboot source exactly matches the frozen V1 pipeline (${actual.length} chars).`);
