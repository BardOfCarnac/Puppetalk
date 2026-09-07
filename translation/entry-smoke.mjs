import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,appSourceDecorators} from './manifest.mjs';

const html=fs.readFileSync('translation/index.html','utf8');
const actualStyles=[...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);
const bare=src=>src.replace(/\?.*$/,'');

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve shared assets from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles changed unexpectedly.');

const retiredRuntimeScripts=[
  './fullscreen-controller.js','./look-migration.js','./scene-camera.js','./device-projection.js','./foreground-tuning.js',
  './stability.js','./pose-tuning.js','./locomotion.js','./segmented-stance-compat.js','./jump-feel.js','./control-feel.js'
];
for(const retired of retiredRuntimeScripts){
  assert.ok(!actualScripts.some(src=>bare(src)===retired),`Retired legacy runtime script survived translation: ${retired}`);
}
for(const decorator of appSourceDecorators){
  assert.ok(!actualScripts.some(src=>bare(src)===`./${decorator}`),`Runtime source decorator survived translation: ${decorator}`);
}
assert.ok(!actualScripts.some(src=>bare(src)==='./boot.js'),'V1 source-rewriting boot.js survived in translation runtime.');
assert.ok(!actualScripts.some(src=>src.includes('precomposed-fetch.js')),'Preboot fetch adapter survived after final source freeze.');

const requiredShared=[
  'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'
];
for(const src of requiredShared) assert.ok(actualScripts.includes(src),`Required shared dependency is missing: ${src}`);

const requiredTranslated=[
  './translation/character/stability-runtime.js?v=1',
  './translation/character/pose-runtime.js?v=1',
  './translation/character/locomotion-runtime.js?v=1',
  './translation/character/look-model.js?v=1',
  './translation/core/runtime-helpers.js?v=1',
  './translation/core/runtime-route.js?v=1',
  './translation/core/runtime-config.js?v=1',
  './translation/core/depth-system.js?v=1',
  './translation/render/scene-camera.js?v=1',
  './translation/controller/device-projection.js?v=1',
  './translation/render/scene-renderer.js?v=1',
  './translation/render/random-photo-backdrop.js?v=1',
  './translation/render/seat-projection.js?v=1',
  './translation/ui/shells.js?v=1',
  './translation/character/rig-core.js?v=1',
  './translation/character/grab-geometry.js?v=1',
  './translation/character/drive-forces.js?v=1',
  './translation/character/recovery-geometry.js?v=1',
  './translation/character/rig-factory.js?v=1',
  './translation/character/recovery-system.js?v=1',
  './translation/character/scene-state.js?v=1',
  './translation/character/input-system.js?v=1',
  './translation/character/puppet-driver.js?v=1',
  './translation/character/puppet-lifecycle.js?v=1',
  './translation/stage/stage-loop.js?v=1',
  './translation/stage/stage-lifecycle.js?v=1',
  './translation/stage/app.js?v=1',
  './translation/network/host-session.js?v=1',
  './translation/props/prop-factory.js?v=1',
  './translation/props/prop-geometry.js?v=1',
  './translation/props/prop-state.js?v=1',
  './translation/props/grip-core.js?v=1',
  './translation/props/attachment-core.js?v=1',
  './translation/props/balloon-lift.js?v=1',
  './translation/props/pump-balloon.js?v=1',
  './translation/props/balloon-pops.js?v=1',
  './translation/props/prop-driver.js?v=1',
  './translation/props/depth-assist.js?v=1',
  './translation/props/laser-frisbee.js?v=1',
  './translation/props/prop-input.js?v=1',
  './translation/props/special-items.js?v=1',
  './translation/props/dart-impacts.js?v=1',
  './translation/props/contact-physics.js?v=1',
  './translation/controller/canvas-lifecycle.js?v=1',
  './translation/controller/session.js?v=1',
  './translation/controller/puppet-interaction.js?v=1',
  './translation/controller/item-interactions.js?v=1',
  './translation/controller/character-creator.js?v=1',
  './translation/controller/throw-gesture.js?v=1',
  './translation/controller/audio-controls.js?v=1',
  './translation/controller/command-panel.js?v=1',
  './translation/controller/app.js?v=1',
  './translation/bootstrap.js?v=2'
];
for(const src of requiredTranslated) assert.ok(actualScripts.includes(src),`Translated runtime module is missing: ${src}`);

const translatedPositions=requiredTranslated.map(src=>actualScripts.indexOf(src));
for(let i=1;i<translatedPositions.length;i++){
  assert.ok(translatedPositions[i]>translatedPositions[i-1],`Translated module order is invalid around ${requiredTranslated[i]}`);
}
assert.equal(actualScripts.at(-1),'./translation/bootstrap.js?v=2','Translated bootstrap should remain the final application script.');

assert.ok(fs.existsSync('translation/generated/app-preboot.js'),'Frozen preboot control specimen is missing.');
assert.ok(fs.existsSync('translation/generated/app-final.js'),'Frozen final control specimen is missing.');
assert.ok(fs.existsSync('translation/runtime/app.js'),'Translated runtime source is missing.');

const bootstrap=fs.readFileSync('translation/bootstrap.js','utf8');
assert.match(bootstrap,/translation\/runtime\/app\.js/,'Bootstrap is not loading the translated runtime.');
assert.doesNotMatch(bootstrap,/translation\/generated\/app-final\.js/,'Bootstrap still loads the frozen control specimen.');

console.log('Translation entry owns all Puppetalk behavior modules, excludes retired/source-rewriting patches and boots the translated runtime while retaining V1 only as a test specimen.');
