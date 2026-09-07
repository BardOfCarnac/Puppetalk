import fs from 'node:fs';
import assert from 'node:assert/strict';
import {styles,appSourceDecorators} from './manifest.mjs';

const html=fs.readFileSync('translation/index.html','utf8');
const actualStyles=[...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
const actualScripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);
const bare=src=>src.replace(/\?.*$/,'');
const actualBareScripts=actualScripts.map(bare);

assert.match(html,/<title>Puppetalk<\/title>/,'Translation entry changed the product name.');
assert.match(html,/<main id="app" aria-live="polite"><\/main>/,'Translation entry changed the app mount.');
assert.match(html,/<base href="\.\.\/"\s*\/>/,'Translation entry must resolve shared assets from repository root.');
assert.deepEqual(actualStyles,[...styles],'Translation entry styles changed unexpectedly.');

const retiredRuntimeScripts=[
  './fullscreen-controller.js','./look-migration.js','./scene-camera.js','./device-projection.js','./foreground-tuning.js',
  './stability.js','./pose-tuning.js','./locomotion.js','./segmented-stance-compat.js','./jump-feel.js','./control-feel.js'
];
for(const retired of retiredRuntimeScripts){
  assert.ok(!actualBareScripts.includes(retired),`Retired legacy runtime script survived translation: ${retired}`);
}
for(const decorator of appSourceDecorators){
  assert.ok(!actualBareScripts.includes(`./${decorator}`),`Runtime source decorator survived translation: ${decorator}`);
}
assert.ok(!actualBareScripts.includes('./boot.js'),'V1 source-rewriting boot.js survived in translation runtime.');
assert.ok(!actualBareScripts.some(src=>src.includes('precomposed-fetch.js')),'Preboot fetch adapter survived after final source freeze.');

const requiredShared=[
  'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'
];
for(const src of requiredShared) assert.ok(actualScripts.includes(src),`Required shared dependency is missing: ${src}`);

const requiredTranslated=[
  './translation/character/stability-runtime.js',
  './translation/character/pose-runtime.js',
  './translation/character/locomotion-runtime.js',
  './translation/character/look-model.js',
  './translation/core/runtime-helpers.js',
  './translation/core/runtime-route.js',
  './translation/core/runtime-config.js',
  './translation/core/depth-system.js',
  './translation/render/scene-camera.js',
  './translation/controller/device-projection.js',
  './translation/render/scene-renderer.js',
  './translation/render/random-photo-backdrop.js',
  './translation/render/seat-projection.js',
  './translation/ui/shells.js',
  './translation/character/rig-core.js',
  './translation/character/grab-geometry.js',
  './translation/character/drive-forces.js',
  './translation/character/recovery-geometry.js',
  './translation/character/rig-factory.js',
  './translation/character/recovery-system.js',
  './translation/character/scene-state.js',
  './translation/character/input-system.js',
  './translation/character/puppet-driver.js',
  './translation/character/puppet-lifecycle.js',
  './translation/stage/stage-loop.js',
  './translation/stage/stage-lifecycle.js',
  './translation/stage/app.js',
  './translation/network/host-session.js',
  './translation/props/prop-factory.js',
  './translation/props/prop-geometry.js',
  './translation/props/prop-state.js',
  './translation/props/grip-core.js',
  './translation/props/attachment-core.js',
  './translation/props/balloon-lift.js',
  './translation/props/pump-balloon.js',
  './translation/props/balloon-pops.js',
  './translation/props/prop-driver.js',
  './translation/props/depth-assist.js',
  './translation/props/laser-frisbee.js',
  './translation/props/prop-input.js',
  './translation/props/special-items.js',
  './translation/props/dart-impacts.js',
  './translation/props/contact-physics.js',
  './translation/controller/canvas-lifecycle.js',
  './translation/controller/session.js',
  './translation/controller/puppet-interaction.js',
  './translation/controller/item-interactions.js',
  './translation/controller/character-creator.js',
  './translation/controller/throw-gesture.js',
  './translation/controller/audio-controls.js',
  './translation/controller/command-panel.js',
  './translation/controller/app.js',
  './translation/bootstrap.js'
];
for(const src of requiredTranslated) assert.ok(actualBareScripts.includes(src),`Translated runtime module is missing: ${src}`);

const translatedPositions=requiredTranslated.map(src=>actualBareScripts.indexOf(src));
for(let i=1;i<translatedPositions.length;i++){
  assert.ok(translatedPositions[i]>translatedPositions[i-1],`Translated module order is invalid around ${requiredTranslated[i]}`);
}
assert.equal(actualBareScripts.at(-1),'./translation/bootstrap.js','Translated bootstrap should remain the final application script.');

assert.ok(fs.existsSync('translation/generated/app-preboot.js'),'Frozen preboot control specimen is missing.');
assert.ok(fs.existsSync('translation/generated/app-final.js'),'Frozen final control specimen is missing.');
assert.ok(fs.existsSync('translation/runtime/app.js'),'Translated runtime source is missing.');

const bootstrap=fs.readFileSync('translation/bootstrap.js','utf8');
assert.match(bootstrap,/translation\/runtime\/app\.js/,'Bootstrap is not loading the translated runtime.');
assert.doesNotMatch(bootstrap,/translation\/generated\/app-final\.js/,'Bootstrap still loads the frozen control specimen.');

console.log('Translation entry owns all Puppetalk behavior modules, excludes retired/source-rewriting patches and boots the translated runtime while retaining V1 only as a test specimen.');