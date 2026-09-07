import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const sourcePath=new URL('./live-browser-parity.mjs',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const needle='const geometry=await latestHandScreenPoints(controller);';
const replacement='const geometry=await latestProjectedHandScreenPoints(controller);';
if(!source.includes(needle)) throw new Error('Projected-hand parity probe could not find the multitouch geometry call.');
const patched=source.replace(needle,replacement);
const temp=path.join(os.tmpdir(),`puppetalk-live-browser-parity-projected-${process.pid}.mjs`);
fs.writeFileSync(temp,patched,'utf8');
try{
  await import(pathToFileURL(temp).href);
}finally{
  fs.rmSync(temp,{force:true});
}
