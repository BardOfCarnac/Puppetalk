import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./prop-factory.js',import.meta.url),'utf8'),context,{filename:'prop-factory.js'});
const api=context.window.PuppetalkPropFactory;
assert.ok(api?.create,'Prop factory candidate did not install.');

const calls=[];
const props=new Map();
const engine={world:{id:'world'}};
const Bodies={
  circle(x,y,r,options){const body={kind:'circle',position:{x,y},r,options:{...options}};calls.push(['circle',x,y,r,JSON.parse(JSON.stringify(options))]);return body;},
  rectangle(x,y,w,h,options){const body={kind:'rectangle',position:{x,y},w,h,options:{...options}};calls.push(['rectangle',x,y,w,h,JSON.parse(JSON.stringify(options))]);return body;}
};
const Composite={add(world,body){calls.push(['add',world.id,body]);}};
const getDimensions=()=>({W:1000,H:700});
const factory=api.create({Bodies,Composite,engine,props,getDimensions});
assert.ok(factory?.makeProp,'Prop factory create failed.');

let p=factory.makeProp('ball',10,20);
assert.equal(p.id,'prop-1');
assert.equal(p.body.label,'puppetalk-prop:prop-1:ball');
assert.deepEqual(JSON.parse(JSON.stringify(p.gripPoint)),{x:0,y:0});
assert.deepEqual(JSON.parse(JSON.stringify(p.body.options)),{density:.0008,restitution:.9,friction:.24,frictionAir:.006});

p=factory.makeProp('balloon',30,40);
assert.equal(p.id,'prop-2');
assert.equal(p.body.r,18);
assert.deepEqual(JSON.parse(JSON.stringify(p.body.options)),{density:.00018,restitution:.38,friction:.18,frictionAir:.028});

p=factory.makeProp('frisbee',50,60);
assert.equal(p.id,'prop-3');
assert.deepEqual(JSON.parse(JSON.stringify(p.gripPoint)),{x:-15,y:0});
assert.equal(p.body.r,23);
assert.deepEqual(JSON.parse(JSON.stringify(p.body.options)),{density:.00062,restitution:.72,friction:.18,frictionAir:.004});

p=factory.makeProp('pump',70,80);
assert.equal(p.id,'prop-4');
assert.equal(p.body.kind,'rectangle');
assert.equal(p.body.w,44);assert.equal(p.body.h,60);
assert.deepEqual(JSON.parse(JSON.stringify(p.body.options)),{isStatic:true,restitution:.05,friction:.9,chamfer:{radius:5}});

p=factory.makeProp('dart',90,100);
assert.equal(p.id,'prop-5');
assert.deepEqual(JSON.parse(JSON.stringify(p.gripPoint)),{x:-13,y:0});
assert.equal(p.body.w,44);assert.equal(p.body.h,6);
assert.deepEqual(JSON.parse(JSON.stringify(p.body.options)),{density:.00034,restitution:.1,friction:.32,frictionAir:.006,chamfer:{radius:2}});
assert.equal(props.size,5);
assert.equal(calls.filter(c=>c[0]==='add').length,5,'Every prop must be added to the Matter world exactly once.');
for(const prop of props.values()){
  assert.equal(prop.heldBy,null);assert.equal(prop.contest,null);assert.equal(prop.attachedTo,null);
}

const before=factory.makeProp;
assert.equal(factory.ensureTestProps(),undefined,'Normal table seeding must remain an intentional no-op.');
assert.equal(props.size,5,'Normal table seeding must not create props.');

const legacyProps=new Map();
const legacyCalls=[];
const legacyBodies={
  circle(x,y,r,options){return {kind:'circle',position:{x,y},r,options};},
  rectangle(x,y,w,h,options){return {kind:'rectangle',position:{x,y},w,h,options};}
};
const legacyComposite={add(world,body){legacyCalls.push([body.label,body.position.x,body.position.y]);}};
const legacy=api.create({Bodies:legacyBodies,Composite:legacyComposite,engine,props:legacyProps,getDimensions});
legacy.ensureLegacyTestProps();
assert.equal(legacyProps.size,9,'Legacy seed must remain ball + six darts + frisbee + pump.');
assert.deepEqual([...legacyProps.values()].map(v=>v.type),['ball','dart','dart','dart','dart','dart','dart','frisbee','pump']);
const y=Math.max(82,Math.min(700*.38,700-180));
assert.deepEqual([...legacyProps.values()].map(v=>[v.type,v.body.position.x,v.body.position.y]),[
  ['ball',340,y],
  ['dart',450,y+18],['dart',495,y+38],['dart',540,y+18],['dart',585,y+38],['dart',630,y+18],['dart',675,y+38],
  ['frisbee',590,y-34],['pump',730,632]
]);
legacy.ensureLegacyTestProps();
assert.equal(legacyProps.size,9,'Legacy seed must not duplicate an existing table.');

console.log('Prop factory candidate preserves V1 IDs, Matter body options, grip points, world registration and normal/legacy table seeding.');
