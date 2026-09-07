import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
if(!html.includes('./boot.js')) throw new Error('boot.js missing from live page');
if(!html.includes('./voice-layer.js')) throw new Error('voice-layer.js must be loaded for live table audio');
if(html.indexOf('./voice-layer.js') > html.indexOf('./boot.js')) throw new Error('voice-layer.js must load before boot.js so it can decorate app.js safely');
for(const forbidden of ['./sound-runtime.js','./sound-sidecar.js','./voice-stage-compat.js']){
  if(html.includes(forbidden)) throw new Error(`${forbidden} must stay off the production loader until it has a separate proven integration path`);
}

for(const path of ['sound-runtime.js','sound-sidecar.js']){
  const source=fs.readFileSync(path,'utf8');
  new Function(source);
}
console.log('Production loader uses the isolated voice layer while experimental sound sidecars remain off.');