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
expectedRuntime.push('./translation/character/rig-core.js?v=1');
expectedRuntime.push('./translation/character/grab-geometry.js?v=1');
expectedRuntime.push('./translation/character/drive-forces.js?v=1');
expectedRuntime.push('./translation/character/recovery-geometry.js?v=1');
expectedRuntime.push('./translation/character/rig-factory.js?v=1');
expectedRuntime.push('./translation/character/recovery-system.js?v=1');
expectedRuntime.push('./translation/character/scene-state.js?v=1');
expectedRuntime.push('./translation/character/input-system.js?v=1');
expectedRuntime.push('./translation/character/puppet-driver.js?v=1');
expectedRuntime.push('./translation/character/puppet-lifecycle.js?v=1');
expectedRuntime.push('./translation/stage/stage-loop.js?v=1');
expectedRuntime.push('./translation/network/host-session.js?v=1');
expectedRuntime.push('./translation/props/prop-geometry.js?v=1');
expectedRuntime.push('./translation/props/grip-core.js?v=1');
expectedRuntime.push('./translation/props/attachment-core.js?v=1');
expectedRuntime.push('./translation/props/dart-impacts.js?v=1');
expectedRuntime.push('./translation/props/contact-physics.js?v=1');
expectedRuntime.push('./translation/bootstrap.js?v=2');

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve frozen runtime files from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles differ from frozen Puppetalk.');
assert.deepEqual(actualScripts,expectedRuntime,'Translation entry changed frozen runtime ordering before translated modules.');

for(const decorator of appSourceDecorators){
  assert.ok(!actualScripts.some(src=>src.replace(/\?.*$/,'')===`./${decorator}`),`Runtime source decorator survived translation: ${decorator}`);
}
assert.ok(!actualScripts.some(src=>src.replace(/\?.*$/,'')==='./boot.js'),'V1 source-rewriting boot.js survived in translation runtime.');
assert.ok(!actualScripts.some(src=>src.includes('precomposed-fetch.js')),'Preboot fetch adapter survived after final source freeze.');
assert.ok(actualScripts.includes('./translation/character/rig-core.js?v=1'),'Extracted character rig core is missing.');
assert.ok(actualScripts.includes('./translation/character/grab-geometry.js?v=1'),'Extracted grab geometry is missing.');
assert.ok(actualScripts.includes('./translation/character/drive-forces.js?v=1'),'Extracted drive forces are missing.');
assert.ok(actualScripts.includes('./translation/character/recovery-geometry.js?v=1'),'Extracted recovery geometry is missing.');
assert.ok(actualScripts.includes('./translation/character/rig-factory.js?v=1'),'Extracted rig factory is missing.');
assert.ok(actualScripts.includes('./translation/character/recovery-system.js?v=1'),'Extracted recovery system is missing.');
assert.ok(actualScripts.includes('./translation/character/scene-state.js?v=1'),'Extracted character scene state is missing.');
assert.ok(actualScripts.includes('./translation/character/input-system.js?v=1'),'Extracted character input system is missing.');
assert.ok(actualScripts.includes('./translation/character/puppet-driver.js?v=1'),'Extracted puppet driver is missing.');
assert.ok(actualScripts.includes('./translation/character/puppet-lifecycle.js?v=1'),'Extracted puppet lifecycle is missing.');
assert.ok(actualScripts.includes('./translation/stage/stage-loop.js?v=1'),'Extracted stage loop is missing.');
assert.ok(actualScripts.includes('./translation/network/host-session.js?v=1'),'Extracted host session is missing.');
assert.ok(actualScripts.includes('./translation/props/prop-geometry.js?v=1'),'Extracted prop geometry is missing.');
assert.ok(actualScripts.includes('./translation/props/grip-core.js?v=1'),'Extracted prop grip core is missing.');
assert.ok(actualScripts.includes('./translation/props/attachment-core.js?v=1'),'Extracted prop attachment core is missing.');
assert.ok(actualScripts.includes('./translation/props/dart-impacts.js?v=1'),'Extracted dart impacts are missing.');
assert.ok(actualScripts.includes('./translation/props/contact-physics.js?v=1'),'Extracted prop contact physics is missing.');
assert.ok(actualScripts.includes('./translation/bootstrap.js?v=2'),'Translated bootstrap is missing.');
assert.ok(fs.existsSync('translation/generated/app-preboot.js'),'Frozen preboot source is missing.');
assert.ok(fs.existsSync('translation/generated/app-final.js'),'Frozen final source is missing.');
assert.ok(fs.existsSync('translation/runtime/app.js'),'Translated runtime source is missing.');

const bootstrap=fs.readFileSync('translation/bootstrap.js','utf8');
assert.match(bootstrap,/translation\/runtime\/app\.js/,'Bootstrap is not loading the translated runtime.');
assert.doesNotMatch(bootstrap,/translation\/generated\/app-final\.js/,'Bootstrap still loads the frozen control specimen.');

console.log('Translation entry boots extracted character, stage, host-session and prop modules while retaining frozen V1 as control.');
