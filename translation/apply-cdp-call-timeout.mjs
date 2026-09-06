import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const from=`  async call(method,params={}){\n    await this.ready;\n    const id=this.next++;\n    const promise=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));\n    this.ws.send(JSON.stringify({id,method,params}));\n    return promise;\n  }`;
const to=`  async call(method,params={}){\n    await this.ready;\n    const id=this.next++;\n    let timer;\n    const promise=new Promise((resolve,reject)=>{\n      timer=setTimeout(()=>{\n        if(!this.pending.delete(id))return;\n        reject(new Error(\`CDP call timed out: \${method}\`));\n      },12000);\n      this.pending.set(id,{\n        resolve:value=>{clearTimeout(timer);resolve(value);},\n        reject:error=>{clearTimeout(timer);reject(error);}\n      });\n    });\n    this.ws.send(JSON.stringify({id,method,params}));\n    return promise;\n  }`;
const first=source.indexOf(from);
if(first<0)throw new Error('Missing Cdp.call marker.');
if(source.indexOf(from,first+from.length)>=0)throw new Error('Ambiguous Cdp.call marker.');
source=source.slice(0,first)+to+source.slice(first+from.length);
fs.writeFileSync(path,source);
console.log('Added bounded timeout to browser parity CDP calls.');
