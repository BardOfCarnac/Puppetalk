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
  "      if(msg.kind==='data'&&msg.from!==this.id){\n        note('recv',{owner:this.id,from:msg.from,connId:msg.connId,...msgInfo(msg.data)});\n        this.connections.get(msg.connId)?.emit('data',msg.data);\n        return;\n      }",
  "      if(msg.kind==='data'&&msg.from!==this.id){\n        const conn=this.connections.get(msg.connId);\n        note('recv',{\n          owner:this.id,from:msg.from,connId:msg.connId,...msgInfo(msg.data),\n          foregroundPatched:!!conn?.__puppetalkForegroundPatched,\n          foregroundSlot:Number.isInteger(conn?.__puppetalkForegroundSlot)?conn.__puppetalkForegroundSlot:null,\n          stabilityPatched:!!conn?.__puppetalkPatched,\n          stabilitySlot:Number.isInteger(conn?.__puppetalkSlot)?conn.__puppetalkSlot:null,\n          locomotionPatched:!!conn?.__puppetalkLocomotionPatched,\n          locomotionSlot:Number.isInteger(conn?.__locomotionSlot)?conn.__locomotionSlot:null\n        });\n        conn?.emit('data',msg.data);\n        return;\n      }",
  'stage transport wrapper trace'
);

const stageAnchor=[
  '  const stageCloser=await waitEval(stage,`(()=>{',
  '    const api=window.PuppetalkDepthState;',
  '    if(!api)return null;',
  '    const plane=api.getPlaneForSlot(0);',
  '    const depth=api.getDepthForSlot(0);',
  '    return plane===5&&depth>.005?{plane,depth}:null;',
  '  })()`,`${label} stage closer depth state`);'
].join('\n');
const stageReplacement=[
  '  let stageCloser;',
  '  try{',
  '    stageCloser=await waitEval(stage,`(()=>{',
  '      const api=window.PuppetalkDepthState;',
  '      if(!api)return null;',
  '      const plane=api.getPlaneForSlot(0);',
  '      const depth=api.getDepthForSlot(0);',
  '      return plane===5&&depth>.005?{plane,depth}:null;',
  '    })()`,`${label} stage closer depth state`);',
  '  }catch(error){',
  '    const stageDiagnostic=await evaluate(stage,`(()=>{',
  '      const api=window.PuppetalkDepthState;',
  '      const trace=(window.__PUPPETALK_PARITY_TRACE__||[]).filter(e=>e.event===\'recv\'&&e.type===\'depth-step\');',
  '      return {',
  '        foreground:window.PuppetalkForegroundTuning||null,',
  '        plane:api?.getPlaneForSlot?.(0)??null,',
  '        depth:api?.getDepthForSlot?.(0)??null,',
  '        depthSteps:trace.slice(-4)',
  '      };',
  '    })()`);',
  '    throw new Error(`${error.message}\\n${label} stage depth diagnostics: ${JSON.stringify(stageDiagnostic,null,2)}`);',
  '  }'
].join('\n');
replaceOnce(stageAnchor,stageReplacement,'stage depth state diagnostics');

fs.writeFileSync(path,source);
console.log('Instrumented stage depth transport with wrapper markers and host-state diagnostics.');
