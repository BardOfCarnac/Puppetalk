import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const boot=html.indexOf('./boot.js');
const sidecar=html.indexOf('./sound-sidecar.js');
if(boot<0) throw new Error('boot.js missing from live page');
if(sidecar<0) throw new Error('sound-sidecar.js missing from live page');
if(sidecar<boot) throw new Error('sound sidecar must load after boot.js');
if(html.includes('./sound-runtime.js')) throw new Error('old pre-boot sound runtime must not be loaded');

const source=fs.readFileSync('sound-sidecar.js','utf8');
for(const forbidden of ['Peer.prototype','prototype.on =','prototype.connect =','window.fetch =','mediaDevices.getUserMedia =']){
  if(source.includes(forbidden)) throw new Error(`sound sidecar must not patch ${forbidden}`);
}
new Function(source);
console.log('Post-boot sound sidecar smoke check passed.');