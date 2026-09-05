import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('translation/character/puppet-lifecycle.js','utf8'),context,{filename:'puppet-lifecycle.js'});
const api=context.window.PuppetalkPuppetLifecycle;
assert.ok(api?.create,'Puppet lifecycle candidate did not install.');

const events=[];
const engine={world:{id:'world'}};
const puppet={bodies:[{id:'b1'},{id:'b2'}],constraints:[{id:'c1'},{id:'c2'}]};
const puppets=new Map([[3,puppet]]);
const matching={id:'p1',attachedTo:{slot:3}};
const other={id:'p2',attachedTo:{slot:1}};
const free={id:'p3'};
const matching2={id:'p4',attachedTo:{slot:3}};
const props=new Map([['p1',matching],['p2',other],['p3',free],['p4',matching2]]);
const releaseAllPropGrips=slot=>events.push(`release:${slot}`);
const detachPropAttachment=prop=>events.push(`detach:${prop.id}`);
const Composite={remove(world,item){assert.equal(world,engine.world);events.push(`remove:${item.id}`);}};

const lifecycle=api.create({puppets,props,releaseAllPropGrips,detachPropAttachment,Composite,engine});
assert.ok(lifecycle?.removePuppet,'Puppet lifecycle did not expose removePuppet.');

lifecycle.removePuppet(99);
assert.deepEqual(events,[],'Missing puppet removal must be a no-op.');
assert.equal(puppets.has(3),true);

lifecycle.removePuppet(3);
assert.deepEqual(events,[
  'release:3',
  'detach:p1','detach:p4',
  'remove:b1','remove:b2','remove:c1','remove:c2'
],'Puppet cleanup ordering drifted from frozen V1.');
assert.equal(puppets.has(3),false,'Puppet must be deleted only after cleanup completes.');
assert.equal(other.attachedTo.slot,1,'Props attached to another puppet must be untouched.');

const before=[...events];
lifecycle.removePuppet(3);
assert.deepEqual(events,before,'Repeated removal of an already-removed puppet must be a no-op.');

console.log('Puppet lifecycle candidate preserves V1 prop release, attachment cleanup, Matter removal order and final map deletion.');
