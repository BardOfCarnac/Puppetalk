import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(from,to,label){
  const first=source.indexOf(from);
  if(first<0) throw new Error(`Missing ${label} anchor.`);
  if(source.indexOf(from,first+from.length)>=0) throw new Error(`Ambiguous ${label} anchor.`);
  source=source.slice(0,first)+to+source.slice(first+from.length);
}

replaceOnce(
`    const stageH=r.width*(360/320);
    const offsetY=r.height*.79-stageH*.90;
    return {
      x:r.left+torso.x*r.width,
      y:r.top+offsetY+torso.y*stageH
    };`,
`    return {
      x:r.left+torso.x*r.width,
      y:r.top+torso.y*r.height
    };`,
'depth torso hit coordinates'
);

fs.writeFileSync(path,source);
console.log('Depth parity now uses the same proven canvas hit coordinates as direct torso dragging.');
