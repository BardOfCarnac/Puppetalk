import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s.endsWith('\n')?s:`${s}\n`,'utf8');

function replaceOnce(text,label,from,to){
  const i=text.indexOf(from);
  if(i<0) throw new Error(`Missing ${label} marker.`);
  if(text.indexOf(from,i+from.length)>=0) throw new Error(`${label} marker matched more than once.`);
  return text.slice(0,i)+to+text.slice(i+from.length);
}
function insertBefore(text,label,marker,addition){
  if(text.includes(addition.trim())) return text;
  return replaceOnce(text,label,marker,addition+marker);
}

let build=read('translation/build-runtime.mjs');
const finalSyntax='new Function(source);';
const prune=`removeBetweenOnce(\n  'dead legacy line-face renderer',\n  \`const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];\`,\n  \`function savedLook(){\`\n);\n\n`;
if(!build.includes("'dead legacy line-face renderer'")) build=insertBefore(build,'legacy line-face prune',finalSyntax,prune);
write('translation/build-runtime.mjs',build);

let parity=read('translation/runtime-parity-smoke.mjs');
const oldGuard="assert.match(actual,/const LINE_FACE_EYES = \\{/,'Upper frozen line-face specimen moved during live-renderer extraction.');\n";
const deadGuards="assert.doesNotMatch(actual,/const PUPPET_HEAD_STYLES =/,'Dead legacy head-style table survived pruning.');\nassert.doesNotMatch(actual,/const LINE_FACE_EYES =/,'Dead legacy line-face eye table survived pruning.');\nassert.doesNotMatch(actual,/const LINE_FACE_NOSES =/,'Dead legacy line-face nose table survived pruning.');\nassert.doesNotMatch(actual,/function legacyHeadStyle\\(head,hair\\)/,'Dead legacy head-style mapper survived pruning.');\nassert.doesNotMatch(actual,/function puppetHeadPath\\(ctx,style,r\\)/,'Dead legacy head path survived pruning.');\nassert.doesNotMatch(actual,/function drawLineFaceEyes\\(ctx,name,hr\\)/,'Dead legacy eye renderer survived pruning.');\nassert.doesNotMatch(actual,/function drawLineFaceNose\\(ctx,name,hr\\)/,'Dead legacy nose renderer survived pruning.');\nassert.doesNotMatch(actual,/const LINE_FACE_MOUTHS =/,'Dead legacy mouth table survived pruning.');\nassert.doesNotMatch(actual,/function lineFaceMouthSamples\\(name\\)/,'Dead legacy mouth sampler survived pruning.');\nassert.doesNotMatch(actual,/function drawLineFaceMouth\\(ctx,name,state,hr\\)/,'Dead legacy mouth renderer survived pruning.');\nassert.match(actual,/function savedLook\\(\\)/,'Legacy renderer prune crossed into live saved-look code.');\n";
if(parity.includes(oldGuard)) parity=replaceOnce(parity,'legacy line-face parity guard',oldGuard,deadGuards);
else if(!parity.includes('Dead legacy head-style table survived pruning.')) throw new Error('Missing legacy line-face parity guard.');
write('translation/runtime-parity-smoke.mjs',parity);

console.log('Prepared proven-dead legacy line-face renderer pruning against the current translated runtime.');
