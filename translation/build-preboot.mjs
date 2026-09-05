import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {appSourceDecorators,rawAppSource} from './manifest.mjs';

export async function composePrebootSource(){
  const appSource = fs.readFileSync(rawAppSource,'utf8');

  const stubNode = () => ({
    appendChild(){}, remove(){}, pause(){}, select(){}, prepend(){},
    play(){ return Promise.resolve(); },
    setAttribute(){}, addEventListener(){},
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset:{}, style:{}, textContent:'', innerHTML:'', srcObject:null,
    childElementCount:0
  });
  const document = {
    documentElement:stubNode(),
    head:stubNode(),
    body:stubNode(),
    title:'Puppetalk',
    createElement:stubNode,
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    execCommand(){ return true; }
  };
  class MutationObserver { observe(){} disconnect(){} }
  const location = {href:'https://puppetalk.test/app.js',origin:'https://puppetalk.test'};

  const context = {
    console,
    performance,
    Response,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    document,
    MutationObserver,
    location,
    navigator:{},
    localStorage:{getItem(){return null;},setItem(){}},
    window:{}
  };
  context.window.window=context.window;
  context.window.document=document;
  context.window.location=location;
  context.window.localStorage=context.localStorage;
  context.window.fetch=async()=>new Response(appSource,{status:200});
  context.fetch=(...args)=>context.window.fetch(...args);
  context.globalThis=context;

  for(const file of appSourceDecorators){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }

  const response = await context.window.fetch('app.js');
  if(!response.ok) throw new Error(`Composed app fetch failed (${response.status}).`);
  return response.text();
}

if(import.meta.url === new URL(`file://${process.argv[1]}`).href){
  const output = process.argv[2] || 'translation/generated/app-preboot.js';
  const source = await composePrebootSource();
  new Function(source);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,source.endsWith('\n')?source:`${source}\n`,'utf8');
  console.log(`Wrote ${output} (${source.length} chars) from ${appSourceDecorators.length} frozen decorators.`);
}
