import fs from 'node:fs';

function replaceOnce(source,label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label}.`);
  if(source.indexOf(from,first+1)>=0) throw new Error(`${label} matched more than once.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const buildPath='translation/build-runtime.mjs';
let build=fs.readFileSync(buildPath,'utf8');
const transformAnchor="removeBetweenOnce(\n  'embedded look model',";
const routeTransform=`replaceOnce(
  'embedded runtime route and character config',
  \`const qs = new URLSearchParams(location.search);
const mode = qs.get('mode') === 'controller' ? 'controller' : 'stage';
const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

const COLORS = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8'];
const NAMES = ['Mara','Ivo','Nix','Odo','Vale','Pip'];\`,
  \`const runtimeRoute = window.PuppetalkRuntimeRoute?.create?.({URLSearchParamsClass:URLSearchParams});
if(!runtimeRoute) throw new Error('Puppetalk runtime route failed to load.');
const {mode,room} = runtimeRoute.parse(location.search);
const {COLORS,NAMES} = window.PuppetalkRuntimeConfig || {};
if(!COLORS || !NAMES) throw new Error('Puppetalk runtime config failed to load.');\`
);

`;
if(!build.includes(transformAnchor)) throw new Error('Missing initial runtime transform anchor.');
build=build.replace(transformAnchor,routeTransform+transformAnchor);
fs.writeFileSync(buildPath,build);

const indexPath='translation/index.html';
let index=fs.readFileSync(indexPath,'utf8');
index=replaceOnce(index,'runtime helper script',
  '  <script src="./translation/core/runtime-helpers.js?v=1"></script>\n',
  '  <script src="./translation/core/runtime-helpers.js?v=1"></script>\n  <script src="./translation/core/runtime-route.js?v=1"></script>\n  <script src="./translation/core/runtime-config.js?v=1"></script>\n'
);
fs.writeFileSync(indexPath,index);

const entryPath='translation/entry-smoke.mjs';
let entry=fs.readFileSync(entryPath,'utf8');
entry=replaceOnce(entry,'expected runtime helper scripts',
  "expectedRuntime.push('./translation/core/runtime-helpers.js?v=1');\n",
  "expectedRuntime.push('./translation/core/runtime-helpers.js?v=1');\nexpectedRuntime.push('./translation/core/runtime-route.js?v=1');\nexpectedRuntime.push('./translation/core/runtime-config.js?v=1');\n"
);
entry=replaceOnce(entry,'runtime helper entry assertion',
  "assert.ok(actualScripts.includes('./translation/core/runtime-helpers.js?v=1'),'Extracted frozen runtime helpers are missing.');\n",
  "assert.ok(actualScripts.includes('./translation/core/runtime-helpers.js?v=1'),'Extracted frozen runtime helpers are missing.');\nassert.ok(actualScripts.includes('./translation/core/runtime-route.js?v=1'),'Extracted frozen runtime route is missing.');\nassert.ok(actualScripts.includes('./translation/core/runtime-config.js?v=1'),'Extracted frozen runtime config is missing.');\n"
);
fs.writeFileSync(entryPath,entry);

const parityPath='translation/runtime-parity-smoke.mjs';
let parity=fs.readFileSync(parityPath,'utf8');
parity=replaceOnce(parity,'top-level route module assertion',
  "assert.match(actual,/PuppetalkLookModel/,'Translated runtime is not connected to extracted character look model.');\n",
  "assert.match(actual,/PuppetalkRuntimeRoute/,'Translated runtime is not connected to extracted runtime route.');\nassert.match(actual,/PuppetalkRuntimeConfig/,'Translated runtime is not connected to extracted runtime config.');\nassert.match(actual,/PuppetalkLookModel/,'Translated runtime is not connected to extracted character look model.');\n"
);
parity=replaceOnce(parity,'runtime helper parity block tail',
  "assert.doesNotMatch(actual,/function angleDelta\\(target,current\\)/,'Embedded angleDelta survived runtime-helper extraction.');\n",
  "assert.doesNotMatch(actual,/function angleDelta\\(target,current\\)/,'Embedded angleDelta survived runtime-helper extraction.');\nassert.match(actual,/const runtimeRoute = window\\.PuppetalkRuntimeRoute\\?\\.create\\?\\.\\(\\{URLSearchParamsClass:URLSearchParams\\}\\);/,'Runtime route binding is missing.');\nassert.match(actual,/const \\{mode,room\\} = runtimeRoute\\.parse\\(location\\.search\\);/,'Runtime route parse binding is missing.');\nassert.match(actual,/const \\{COLORS,NAMES\\} = window\\.PuppetalkRuntimeConfig \\|\\| \\{\\};/,'Runtime config binding is missing.');\nassert.doesNotMatch(actual,/const qs = new URLSearchParams\\(location\\.search\\);/,'Embedded query route parser survived extraction.');\nassert.doesNotMatch(actual,/const COLORS = \\[/,'Embedded runtime COLORS survived config extraction.');\nassert.doesNotMatch(actual,/const NAMES = \\[/,'Embedded runtime NAMES survived config extraction.');\n"
);
fs.writeFileSync(parityPath,parity);

console.log('Staged frozen runtime route and config extraction.');
