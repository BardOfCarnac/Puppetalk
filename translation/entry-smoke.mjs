import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,scripts,appSourceDecorators} from './manifest.mjs';

const html=fs.readFileSync('translation/index.html','utf8');
const actualStyles=[...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);

const decoratorSet=new Set(appSourceDecorators.map(file=>`./${file}`));
const expectedRuntime=scripts.filter(src=>{
  const bare=src.replace(/\?.*$/,'');
  return !decoratorSet.has(bare) && bare!=='./boot.js';
});
expectedRuntime.push('./translation/bootstrap.js?v=1');

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve frozen runtime files from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles differ from frozen Puppetalk.');
assert.deepEqual(actualScripts,expectedRuntime,'Translation entry changed frozen runtime ordering before translated bootstrap.');

for(const decorator of appSourceDecorators){
  assert.ok(!actualScripts.some(src=>src.replace(/\?.*$/,'')===`./${decorator}`),`Runtime source decorator survived translation: ${decorator}`);
}
assert.ok(!actualScripts.some(src=>src.replace(/\?.*$/,'')==='./boot.js'),'V1 source-rewriting boot.js survived in translation runtime.');
assert.ok(!actualScripts.some(src=>src.includes('precomposed-fetch.js')),'Preboot fetch adapter survived after final source freeze.');
assert.ok(actualScripts.includes('./translation/bootstrap.js?v=1'),'Translated bootstrap is missing.');
assert.ok(fs.existsSync('translation/generated/app-preboot.js'),'Frozen preboot source is missing.');
assert.ok(fs.existsSync('translation/generated/app-final.js'),'Frozen final source is missing.');

console.log('Translation entry runs frozen final Puppetalk without runtime source rewriting.');
