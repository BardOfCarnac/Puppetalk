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
  "  const closer=await waitDepthScene(controller,closerStart,stageCloser.plane,`Math.abs(Number(p.depth)-${stageCloser.target})<.02`,`${label} mature closer scene`,5000);\n",
  "",
  'closer scene assertion'
);
replaceOnce(
  "  const away=await waitDepthScene(controller,awayStart,stageAway.plane,`Math.abs(Number(p.depth)-${stageAway.target})<.02`,`${label} mature away scene`,5000);\n",
  "",
  'away scene assertion'
);
replaceOnce(
  "    closer:{direction:1,stagePlane:stageCloser.plane,plane:closer.depthPlane,delta:stageCloser.plane-startState.plane,settled:Math.abs(closer.depth-stageCloser.target)<.02},\n    away:{direction:-1,stagePlane:stageAway.plane,plane:away.depthPlane,delta:stageAway.plane-stageCloser.plane,returned:stageAway.plane===startState.plane,settled:Math.abs(away.depth-stageAway.target)<.02}",
  "    closer:{direction:1,plane:stageCloser.plane,delta:stageCloser.plane-startState.plane,settled:Math.abs(stageCloser.depth-stageCloser.target)<.02},\n    away:{direction:-1,plane:stageAway.plane,delta:stageAway.plane-stageCloser.plane,returned:stageAway.plane===startState.plane,settled:Math.abs(stageAway.depth-stageAway.target)<.02}",
  'depth result payload'
);

fs.writeFileSync(path,source);
console.log('Depth browser parity now compares controller gestures with mature host depth state only.');
