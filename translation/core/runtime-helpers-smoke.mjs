import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('translation/core/runtime-helpers.js','utf8');
const sandbox={Math,JSON,globalThis:{}};
sandbox.window=sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'runtime-helpers.js'});

const records=new Map();
const storage={
  getItem:key=>records.has(key)?records.get(key):null,
  setItem:(key,value)=>records.set(key,String(value))
};
const cleanLook=value=>value&&typeof value==='object'?{...value,clean:true}:{clean:true};
const defaultLook=()=>({default:true});
const api=sandbox.window.PuppetalkRuntimeHelpers.create({
  cleanLook,defaultLook,getStorage:()=>storage,random:()=>0
});
assert.ok(api,'Runtime helper factory did not initialize.');

assert.equal(api.clamp(9,0,4),4);
assert.equal(api.clamp(-2,0,4),0);
assert.equal(api.clean(' ab-cd!12efgh '),'ABCD12EF');
assert.equal(api.peerId('AB12'),'puppetalk-ab12');
assert.equal(api.cleanPlayerName('  Ada   Lovelace  '),'Ada Lovelace');
assert.equal(api.roomCode(),'AAAAA');
assert.ok(Math.abs(api.angleDelta(Math.PI+.2,0)-(-Math.PI+.2))<1e-9);

let sent=null;
api.send({open:false,send:value=>{sent=value;}},{x:1});
assert.equal(sent,null);
api.send({open:true,send:value=>{sent=value;}},{x:2});
assert.deepEqual(sent,{x:2});

assert.deepEqual(api.savedLook(),{clean:true});
api.saveLook({color:'#abc'});
assert.equal(records.get('puppetalk-look'),JSON.stringify({color:'#abc',clean:true}));
assert.deepEqual(api.savedLook(),{color:'#abc',clean:true});
records.set('puppetalk-look','{bad json');
assert.deepEqual(api.savedLook(),{default:true});
records.set('puppetalk-name','  Rowan   Vale  ');
assert.equal(api.savedPlayerName(),'Rowan Vale');

const throwing=sandbox.window.PuppetalkRuntimeHelpers.create({
  cleanLook,defaultLook,getStorage:()=>({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}})
});
assert.deepEqual(throwing.savedLook(),{default:true});
assert.equal(throwing.savedPlayerName(),'');
assert.doesNotThrow(()=>throwing.saveLook({x:1}));

console.log('Frozen runtime helper semantics preserved.');
