import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(label,from,to){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} marker.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} marker.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
  'walking lift calculation',
  [
    '  let torsoDx=-Infinity,leftTravel=0,rightTravel=0,leftLift=0,rightLift=0;',
    '  for(const p of samples){',
    '    torsoDx=Math.max(torsoDx,Number(p.torso.x)-Number(startScene.torso.x));',
    '    leftTravel=Math.max(leftTravel,Math.abs(Number(p.al.x)-Number(startScene.al.x)));',
    '    rightTravel=Math.max(rightTravel,Math.abs(Number(p.ar.x)-Number(startScene.ar.x)));',
    '    leftLift=Math.max(leftLift,Number(startScene.al.y)-Number(p.al.y));',
    '    rightLift=Math.max(rightLift,Number(startScene.ar.y)-Number(p.ar.y));',
    '  }'
  ].join('\n'),
  [
    '  let torsoDx=-Infinity,leftTravel=0,rightTravel=0,leftLift=0,rightLift=0;',
    '  const startLeftRelY=Number(startScene.al.y)-Number(startScene.torso.y);',
    '  const startRightRelY=Number(startScene.ar.y)-Number(startScene.torso.y);',
    '  for(const p of samples){',
    '    torsoDx=Math.max(torsoDx,Number(p.torso.x)-Number(startScene.torso.x));',
    '    leftTravel=Math.max(leftTravel,Math.abs(Number(p.al.x)-Number(startScene.al.x)));',
    '    rightTravel=Math.max(rightTravel,Math.abs(Number(p.ar.x)-Number(startScene.ar.x)));',
    '    leftLift=Math.max(leftLift,startLeftRelY-(Number(p.al.y)-Number(p.torso.y)));',
    '    rightLift=Math.max(rightLift,startRightRelY-(Number(p.ar.y)-Number(p.torso.y)));',
    '  }'
  ].join('\n')
);

replaceOnce(
  'walking input normalization',
  "  if(walking?.input) walking.input.dx=Number(Number(walking.input.dx).toFixed(2));",
  [
    '  if(walking?.input){',
    '    const dx=Number(walking.input.dx);',
    "    walking.input.dx=dx>=.15?'right-substantial':dx<=-.15?'left-substantial':'small';",
    '  }'
  ].join('\n')
);

fs.writeFileSync(path,source);
console.log('Walking parity now measures foot lift relative to the torso and normalizes substantial drag direction.');
