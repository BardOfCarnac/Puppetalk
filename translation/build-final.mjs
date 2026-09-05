import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export async function composeFinalSource(){
  const appSource = fs.readFileSync('translation/generated/app-preboot.js','utf8');

  const stubNode = () => ({
    appendChild(){}, remove(){}, pause(){}, select(){},
    play(){ return Promise.resolve(); },
    setAttribute(){}, addEventListener(){}, prepend(){},
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset:{}, style:{}, textContent:'', innerHTML:'', srcObject:null
  });
  const app = stubNode();
  const body = stubNode();
  const document = {
    documentElement:stubNode(),
    head:stubNode(),
    body,
    title:'Puppetalk',
    createElement(){ return stubNode(); },
    querySelector(selector){ return selector === '#app' ? app : null; },
    querySelectorAll(){ return []; },
    execCommand(){ return true; }
  };
  class MutationObserver { observe(){} disconnect(){} }
  class BuildBlob {
    constructor(parts=[],options={}){ this.parts=parts; this.type=options.type||''; }
  }
  let captured='';
  class BuildURL extends URL {
    static createObjectURL(blob){
      captured = (blob?.parts || []).map(String).join('');
      return 'blob:puppetalk-final-build';
    }
    static revokeObjectURL(){}
  }
  const location = {
    href:'https://puppetalk.test/?mode=controller&room=TEST12&lobby=done',
    origin:'https://puppetalk.test',
    search:'?mode=controller&room=TEST12&lobby=done'
  };
  const context = {
    console,
    performance,
    Response,
    URL:BuildURL,
    URLSearchParams,
    Blob:BuildBlob,
    MutationObserver,
    location,
    navigator:{},
    history:{replaceState(){}},
    crypto:{getRandomValues(array){ for(let i=0;i<array.length;i++) array[i]=i+1; return array; }},
    localStorage:{getItem(){return null;},setItem(){}},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document,
    window:{
      addEventListener(){},
      removeEventListener(){},
      dispatchEvent(){},
      devicePixelRatio:1
    }
  };
  context.globalThis=context;
  context.window.window=context.window;
  context.window.document=document;
  context.window.location=location;
  context.window.Blob=BuildBlob;
  context.window.URL=BuildURL;
  context.window.localStorage=context.localStorage;
  context.window.fetch=async()=>new Response(appSource,{status:200});
  context.fetch=(...args)=>context.window.fetch(...args);

  vm.runInNewContext(fs.readFileSync('boot.js','utf8'),context,{filename:'boot.js'});

  for(let i=0;i<80 && !captured;i++) await new Promise(resolve=>setTimeout(resolve,10));
  if(!captured){
    throw new Error(`boot.js did not produce final source. Startup text: ${app.innerHTML || app.textContent || '(none)'}`);
  }
  new Function(captured);
  return captured;
}

if(import.meta.url === new URL(`file://${process.argv[1]}`).href){
  const output = process.argv[2] || 'translation/generated/app-final.js';
  const source = await composeFinalSource();
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,source.endsWith('\n')?source:`${source}\n`,'utf8');
  console.log(`Wrote ${output} (${source.length} chars) from frozen preboot source + boot transformations.`);
}
