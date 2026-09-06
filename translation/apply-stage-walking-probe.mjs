import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

const start='async function latestWalkingScene(cdp){';
const end='\nasync function exerciseDepthGestures(controller,stage,label){';
const a=source.indexOf(start);
const b=source.indexOf(end,a);
if(a<0||b<0) throw new Error('Could not locate walking parity block.');
if(source.indexOf(start,a+start.length)>=0) throw new Error('Walking parity block is ambiguous.');

const replacement=fs.readFileSync('translation/stage-walking-block.txt','utf8').trimEnd();
source=source.slice(0,a)+replacement+source.slice(b);
replaceOnce(
  'walking stage argument',
  '  const walking=await exerciseWalking(controller,label);',
  '  const walking=await exerciseWalking(controller,stage,label);'
);
fs.writeFileSync(path,source);
console.log('Moved walking parity observation to stage-side Matter bodies.');
