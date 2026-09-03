import fs from 'node:fs';
import vm from 'node:vm';

const appSource = fs.readFileSync('app.js','utf8');
const decorators = [
  'character-creator-patch.js',
  'character-creator-hotfix.js',
  'line-face-mouths-patch.js',
  'toy-system.js',
  'toy-tap.js',
  'dart-stick.js',
  'balloon-tie.js',
  'toy-throw.js',
  'prop-extremities.js',
  'balloon-buoyancy.js'
];

const context = {
  console,
  performance,
  Response,
  setTimeout,
  clearTimeout,
  window: {}
};
context.window.fetch = async () => new Response(appSource,{status:200});
context.globalThis = context;

for(const file of decorators){
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

const response = await context.window.fetch('app.js');
const composed = await response.text();

for(const marker of [
  'PUPPETALK_TOY_SYSTEM_V1',
  'PUPPETALK_TOY_TAP_V1',
  'PUPPETALK_DART_STICK_V1',
  'PUPPETALK_BALLOON_TIE_V1',
  'PUPPETALK_TOY_THROW_V1',
  'PUPPETALK_PROP_EXTREMITIES_V1',
  'PUPPETALK_BALLOON_BUOYANCY_V1'
]){
  if(!composed.includes(marker)) throw new Error(`Missing composed marker: ${marker}`);
}

// Parse the final generated app source too. Individual decorator syntax checks do not
// catch bad replacement output or mismatched source needles.
new Function(composed);
console.log('Composed app source smoke check passed.');
