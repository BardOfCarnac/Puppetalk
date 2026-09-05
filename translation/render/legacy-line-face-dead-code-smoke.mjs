import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('translation/generated/app-final.js','utf8');
const startMarker="const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];";
const endMarker='function savedLook(){';
const start=source.indexOf(startMarker);
const end=source.indexOf(endMarker,start+startMarker.length);
assert.ok(start>=0,'Frozen legacy line-face block start is missing.');
assert.ok(end>start,'Frozen legacy line-face block end is missing.');

const identifiers=[
  'PUPPET_HEAD_STYLES','LINE_FACE_EYES','LINE_FACE_NOSES','legacyHeadStyle','puppetHeadPath',
  'drawLineFaceEyes','drawLineFaceNose','LINE_FACE_MOUTHS','LINE_FACE_MOUTH_NAMES',
  'LINE_FACE_MOUTH_CACHE','lineFaceMouthSamples','drawLineFaceMouth'
];
for(const identifier of identifiers){
  let count=0;
  let index=-1;
  while((index=source.indexOf(identifier,index+1))>=0){
    count++;
    assert.ok(index>=start && index<end,`${identifier} has a live reference outside the frozen legacy line-face block.`);
  }
  assert.ok(count>0,`${identifier} disappeared from the frozen legacy line-face specimen.`);
}

// The current live renderer is separately frozen behind PuppetalkSceneRenderer;
// this audit only proves that the older pre-renderer specimen has no consumers.
assert.match(source,/function drawBackdrop\(ctx,w,h\)/,'Frozen live scene renderer tail is missing.');
assert.match(source,/function drawAnatomy\(ctx,p,w,h,highlight=false,alpha=1\)/,'Frozen live anatomy renderer is missing.');

console.log('Frozen legacy LINE_FACE renderer block is self-contained dead code: all of its identifiers are referenced only inside that obsolete specimen.');
