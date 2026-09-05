import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./character-creator.js',import.meta.url),'utf8'),context,{filename:'character-creator.js'});
const api=context.window.PuppetalkCharacterCreator;
assert.ok(api?.create,'Character creator candidate did not install.');

class ClassList{
  constructor(){this.values=new Set();}
  toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}
  has(name){return this.values.has(name);}
}
class El{
  constructor(){this.textContent='';this.dataset={};this.title='';this.type='';this.className='';this.children=[];this.listeners=new Map();this.classList=new ClassList();this.style={values:new Map(),setProperty:(k,v)=>this.style.values.set(k,v)};}
  get childElementCount(){return this.children.length;}
  appendChild(el){this.children.push(el);}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  fire(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event);}
  querySelectorAll(selector){return selector==='[data-color]'?this.children.filter(c=>c.dataset.color):[];}
}
const elements=new Map();
for(const id of ['character-card','character-colors','character-preview','character-random','look-headStyle','look-eyes','look-nose','look-mouth','look-extra']) elements.set('#'+id,new El());
const document={querySelector:selector=>elements.get(selector)||null,createElement:()=>new El()};
const LOOK_PALETTE=['#111111','#222222','#333333'];
const LOOK_PARTS={headStyle:['a','b'],eyes:['e1','e2'],nose:['n1','n2'],mouth:['m1','m2'],extra:['x1','x2']};
const input={look:{color:'#111111',headStyle:'a',eyes:'e1',nose:'n1',mouth:'m1',extra:'x1'}};
const saved=[];
const sent=[];
const conn={id:'conn'};
let slot=2;
const cleanLook=(look,s)=>({...look,cleanedFor:s});
const creator=api.create({
  document,input,LOOK_PALETTE,LOOK_PARTS,cleanLook,
  saveLook:look=>saved.push(JSON.parse(JSON.stringify(look))),
  send:(target,msg)=>sent.push([target,JSON.parse(JSON.stringify(msg))]),
  getConn:()=>conn,getSlot:()=>slot,savedPlayerName:()=>'Nix',random:()=>.75
});
assert.ok(creator?.install,'Character creator factory failed.');
creator.install();

assert.equal(elements.get('#look-headStyle').textContent,'a');
assert.equal(elements.get('#look-eyes').textContent,'e1');
assert.equal(elements.get('#look-nose').textContent,'n1');
assert.equal(elements.get('#look-mouth').textContent,'m1');
assert.equal(elements.get('#look-extra').textContent,'x1');
const colors=elements.get('#character-colors');
assert.equal(colors.children.length,3,'Creator must build one swatch per palette colour exactly once.');
assert.deepEqual(colors.children.map(b=>b.dataset.color),LOOK_PALETTE);
assert.equal(colors.children[0].type,'button');
assert.equal(colors.children[0].className,'character-swatch');
assert.equal(colors.children[0].style.values.get('--swatch'),'#111111');
assert.equal(colors.children[0].classList.has('active'),true);
const preview=elements.get('#character-preview');
assert.equal(preview.style.values.get('--puppet-color'),'#111111');
assert.equal(preview.dataset.head,undefined,'Frozen creator preview still reads legacy head field.');
assert.equal(preview.dataset.hair,undefined,'Frozen creator preview still reads legacy hair field.');
assert.equal(preview.dataset.eyes,'e1');
assert.equal(preview.dataset.extra,'x1');
creator.renderCreator();
assert.equal(colors.children.length,3,'Repeated creator renders must not duplicate swatches.');

creator.cycleLook('eyes');
assert.equal(input.look.eyes,'e2');
assert.equal(input.look.cleanedFor,2,'sendLook must clean against getSlot()||0.');
assert.equal(saved.length,1);
assert.deepEqual(sent[0],[conn,{type:'look',look:input.look,name:'Nix'}]);
assert.equal(elements.get('#look-eyes').textContent,'e2');

creator.cycleLook('missing');
assert.equal(sent.length,1,'Unknown creator field must remain a no-op.');

slot=null;
input.look={color:'#111111',headStyle:'b',eyes:'e2',nose:'n2',mouth:'m2',extra:'x2'};
creator.sendLook();
assert.equal(input.look.cleanedFor,0,'Null slot must preserve frozen slot||0 cleaning fallback.');
assert.equal(sent.at(-1)[1].name,'Nix');

// .75 with two-item part arrays selects index 1; with three colours selects index 2.
creator.randomizeLook();
assert.deepEqual(JSON.parse(JSON.stringify(input.look)),{color:'#333333',headStyle:'b',eyes:'e2',nose:'n2',mouth:'m2',extra:'x2',cleanedFor:0});

colors.children[1].fire('click');
assert.equal(input.look.color,'#222222');
assert.equal(sent.at(-1)[1].look.color,'#222222');

const clickButton={dataset:{look:'mouth'}};
elements.get('#character-card').fire('click',{target:{closest:selector=>selector==='[data-look]'?clickButton:null}});
assert.equal(input.look.mouth,'m1','Installed card click must cycle the requested look field.');

const beforeRandom=sent.length;
elements.get('#character-random').fire('click');
assert.equal(sent.length,beforeRandom+1,'Installed random button must randomize and transmit.');

console.log('Character creator controller candidate preserves V1 look cleaning/sending, field cycling, swatch creation, legacy preview fields and random-look behaviour.');
