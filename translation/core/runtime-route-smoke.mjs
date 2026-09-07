import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sandbox={URLSearchParams,globalThis:{}};
sandbox.window=sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('translation/core/runtime-route.js','utf8'),sandbox,{filename:'runtime-route.js'});
vm.runInContext(fs.readFileSync('translation/core/runtime-config.js','utf8'),sandbox,{filename:'runtime-config.js'});

const route=sandbox.window.PuppetalkRuntimeRoute.create({URLSearchParamsClass:URLSearchParams});
assert.ok(route,'Runtime route factory did not initialize.');
assert.deepEqual({...route.parse('')},{mode:'stage',room:''});
assert.deepEqual({...route.parse('?mode=controller&room=ab-cd!12efgh')},{mode:'controller',room:'ABCD12EF'});
assert.deepEqual({...route.parse('?mode=CONTROLLER&room=%20x_9%20')},{mode:'stage',room:'X9'});
assert.deepEqual({...route.parse('?mode=controller&room=1234567890')},{mode:'controller',room:'12345678'});
assert.equal(sandbox.window.PuppetalkRuntimeRoute.create({}),null);

const config=sandbox.window.PuppetalkRuntimeConfig;
assert.deepEqual(Array.from(config.COLORS),['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8']);
assert.deepEqual(Array.from(config.NAMES),['Mara','Ivo','Nix','Odo','Vale','Pip']);

console.log('Frozen runtime route and character config semantics preserved.');
