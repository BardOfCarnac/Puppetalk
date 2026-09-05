import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./look-model.js',import.meta.url),'utf8'),context,{filename:'look-model.js'});
const look=context.window.PuppetalkLookModel;
assert.ok(look?.cleanLook,'Look model candidate did not install.');

assert.deepEqual(Array.from(look.LOOK_PALETTE),[
  '#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'
]);
assert.deepEqual(Array.from(look.LOOK_PARTS.headStyle),['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe']);
assert.deepEqual(Array.from(look.LOOK_PARTS.eyes),['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight']);
assert.deepEqual(Array.from(look.LOOK_PARTS.nose),['angular','bow','curve','hook','long','slant']);
assert.deepEqual(Array.from(look.LOOK_PARTS.mouth),['frown','line','pleased','shy','smile','smirk','soft','wavy']);
assert.deepEqual(Array.from(look.LOOK_PARTS.extra),['none','glasses','moustache','freckles','eyepatch']);

assert.deepEqual(JSON.parse(JSON.stringify(look.defaultLook(0))),{color:'#cf6c63',headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'});
assert.equal(look.defaultLook(5).color,'#67a7a8');
assert.equal(look.defaultLook(6).color,'#d79b75');
assert.equal(look.defaultLook(12).color,'#cf6c63','Palette selection must wrap by slot exactly as V1.');
assert.equal(look.defaultLook(-1).color,undefined,'Frozen negative-slot array lookup quirk must remain unchanged.');

const migrations=[
  ['round','tuft','tufts'],['round','wave','swept'],['round','mop','scallop'],['round','cap','fringe'],['round','crop','spikes'],
  ['long','none','tallSpikes'],['wide','none','burst'],['round','none','smooth'],[undefined,undefined,'smooth']
];
for(const [head,hair,expected] of migrations) assert.equal(look.legacyHeadStyle(head,hair),expected);

const valid={color:'#ABCDEF',headStyle:'burst',eyes:'wink',nose:'hook',mouth:'smirk',extra:'freckles'};
assert.deepEqual(JSON.parse(JSON.stringify(look.cleanLook(valid,3))),valid,'Valid look fields must pass through unchanged.');

const cleaned=look.cleanLook({color:'red',headStyle:'bogus',eyes:'bogus',nose:null,mouth:'',extra:'hat'},2);
assert.deepEqual(JSON.parse(JSON.stringify(cleaned)),{
  color:'#7089b9',headStyle:'smooth',eyes:'dots',nose:'curve',mouth:'line',extra:'none'
},'Invalid modern headStyle must preserve V1 legacy fallback to smooth while other invalid fields use the slot default.');

assert.equal(look.cleanLook({head:'long'},0).headStyle,'tallSpikes');
assert.equal(look.cleanLook({hair:'wave'},0).headStyle,'swept');
assert.equal(look.cleanLook({headStyle:'fringe',head:'wide',hair:'tuft'},0).headStyle,'fringe','A valid modern headStyle must win over legacy fields.');
assert.equal(look.cleanLook({color:'#12345G'},4).color,'#a879b2');
assert.equal(look.cleanLook({color:'#1234567'},4).color,'#a879b2');
assert.equal(look.cleanLook({color:'#123456'},4).color,'#123456');
assert.deepEqual(JSON.parse(JSON.stringify(look.cleanLook(null,1))),{
  color:'#d0a950',headStyle:'smooth',eyes:'dots',nose:'curve',mouth:'line',extra:'none'
},'Non-object look input must preserve the frozen smooth legacy fallback.');

console.log('Character look model candidate preserves V1 palette/part catalogs, slot defaults, six-digit colour validation and modern/legacy head-style cleaning semantics.');
