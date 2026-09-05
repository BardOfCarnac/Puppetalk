import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,scripts,appSourceDecorators} from './manifest.mjs';

const html = fs.readFileSync('translation/index.html','utf8');
const actualStyles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);

const decoratorSet = new Set(appSourceDecorators.map(file=>`./${file}`));
const frozenNonDecoratorScripts = scripts.filter(src=>{
  const bare = src.replace(/\?.*$/,'');
  return !decoratorSet.has(bare);
});
const bootIndex = frozenNonDecoratorScripts.findIndex(src=>src.replace(/\?.*$/,'') === './boot.js');
assert.notEqual(bootIndex,-1,'Frozen manifest lost boot.js.');
const expectedTranslationScripts = [...frozenNonDecoratorScripts];
expectedTranslationScripts.splice(bootIndex,0,'./translation/precomposed-fetch.js?v=1');

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve frozen runtime files from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles differ from frozen Puppetalk.');
assert.deepEqual(actualScripts,expectedTranslationScripts,'Translation entry does not preserve the frozen runtime order around the precomposed source adapter.');

for(const decorator of appSourceDecorators){
  assert.ok(!actualScripts.some(src=>src.replace(/\?.*$/,'') === `./${decorator}`),`Runtime source decorator survived translation: ${decorator}`);
}
assert.ok(actualScripts.includes('./translation/precomposed-fetch.js?v=1'),'Translation entry is not serving precomposed V1 source.');
assert.ok(fs.existsSync('translation/generated/app-preboot.js'),'Generated preboot source is missing.');

console.log('Translation entry preserves Puppetalk while removing the runtime source-decorator stack.');
