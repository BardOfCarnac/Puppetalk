import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const readyFrom="    this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});";
const readyTo=`    this.ready=new Promise((resolve,reject)=>{\n      const timer=setTimeout(()=>reject(new Error('CDP WebSocket open timed out.')),12000);\n      this.ws.onopen=()=>{clearTimeout(timer);resolve();};\n      this.ws.onerror=error=>{clearTimeout(timer);reject(error);};\n    });`;
if(!source.includes(readyFrom))throw new Error('Missing CDP ready marker.');
source=source.replace(readyFrom,readyTo);
const fetchFrom="  const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});";
const fetchTo="  const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT',signal:AbortSignal.timeout(12000)});";
if(!source.includes(fetchFrom))throw new Error('Missing Chrome target fetch marker.');
source=source.replace(fetchFrom,fetchTo);
fs.writeFileSync(path,source);
console.log('Bound CDP WebSocket readiness and Chrome target creation.');
