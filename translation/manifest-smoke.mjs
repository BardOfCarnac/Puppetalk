import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,scripts,appSourceDecorators,bootScript} from './manifest.mjs';

const html=fs.readFileSync('index.html','utf8');
const actualStyles=[...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);

assert.deepEqual(actualStyles,[...styles],'Translation manifest styles differ from frozen index.html.');
assert.deepEqual(actualScripts,[...scripts],'Translation manifest script order differs from frozen index.html.');

const localPath=value=>value.replace(/^\.\//,'').replace(/\?.*$/,'');
const localScripts=scripts.map(localPath);
let previous=-1;
for(const decorator of appSourceDecorators){
  const index=localScripts.indexOf(decorator);
  assert.notEqual(index,-1,`Source decorator missing from runtime manifest: ${decorator}`);
  assert.ok(index>previous,`Source decorator order changed around ${decorator}`);
  previous=index;
}
const bootIndex=localScripts.indexOf(bootScript);
assert.notEqual(bootIndex,-1,'boot.js missing from runtime manifest.');
assert.ok(previous<bootIndex,'A source decorator is loaded after boot.js.');
assert.equal(appSourceDecorators.at(-1),'visual-thickness.js','Final V1 visual-thickness decorator must remain last.');

// These are deliberately imported here so the ordinary smoke workflow locks
// both frozen translation stages without any workflow auto-regeneration.
await import('./generated-parity-smoke.mjs');
await import('./final-parity-smoke.mjs');

console.log(`Frozen Puppetalk composition captured: ${styles.length} styles, ${scripts.length} scripts, ${appSourceDecorators.length} app-source decorators.`);
