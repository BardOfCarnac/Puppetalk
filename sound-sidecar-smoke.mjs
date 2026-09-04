import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
if(!html.includes('./boot.js')) throw new Error('boot.js missing from live page');
for(const forbidden of ['./sound-runtime.js','./sound-sidecar.js','./voice-layer.js','./voice-stage-compat.js']){
  if(html.includes(forbidden)) throw new Error(`${forbidden} must stay off the production loader until audio has a separate proven integration path`);
}

for(const path of ['sound-runtime.js','sound-sidecar.js']){
  const source=fs.readFileSync(path,'utf8');
  new Function(source);
}
console.log('Production loader is isolated from experimental sound code.');
