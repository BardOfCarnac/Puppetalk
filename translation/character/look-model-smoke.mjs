import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(new URL('./look-model.js',import.meta.url),'utf8'),context,{filename:'look-model.js'});
const look=context.window.PuppetalkLookModel;
assert.ok(look?.cleanLook,'Look model did not install.');

assert.deepEqual(Array.from(look.LOOK_PALETTE),[
  '#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'
]);
assert.deepEqual(Array.from(look.LOOK_PARTS.headStyle),['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe']);

assert.deepEqual(JSON.parse(JSON.stringify(look.defaultLook(0))),{
  color:'#cf6c63',headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'
});
assert.equal(look.defaultLook(12).color,'#cf6c63','Palette selection should wrap by slot.');
assert.equal(look.defaultLook(-1).color,'#5b8fd1','Palette selection should remain valid for negative/internal slots.');

const legacyChoices=[
  ['round','tuft','tufts'],['round','wave','swept'],['round','mop','scallop'],['round','cap','fringe'],['round','crop','spikes'],
  ['long','none','tallSpikes'],['wide','none','burst']
];
for(const [head,hair,expected] of legacyChoices){
  assert.equal(look.cleanLook({head,hair},0).headStyle,expected,`Legacy ${head}/${hair} look did not migrate recognisably.`);
}

assert.equal(look.cleanLook({head:'round',hair:'none'},0).headStyle,'spikes','Untouched legacy default should move to the current integrated-hair default.');
assert.equal(look.cleanLook({},0).headStyle,'spikes','Missing saved head choice should use the current default.');
assert.equal(look.cleanLook(null,0).headStyle,'spikes','New users should receive the current default head.');

const valid={color:'#ABCDEF',headStyle:'burst',eyes:'wink',nose:'hook',mouth:'smirk',extra:'freckles'};
assert.deepEqual(JSON.parse(JSON.stringify(look.cleanLook(valid,3))),valid,'Valid modern look fields should pass through unchanged.');
assert.equal(look.cleanLook({headStyle:'fringe',head:'wide',hair:'tuft'},0).headStyle,'fringe','A modern headStyle should win over legacy fields.');

const cleaned=look.cleanLook({color:'red',headStyle:'bogus',eyes:'bogus',nose:null,mouth:'',extra:'hat'},2);
assert.deepEqual(JSON.parse(JSON.stringify(cleaned)),{
  color:'#7089b9',headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'
},'Invalid look data should fall back to a complete current character rather than preserve obsolete schema quirks.');

assert.equal(look.cleanLook({color:'#12345G'},4).color,'#a879b2');
assert.equal(look.cleanLook({color:'#1234567'},4).color,'#a879b2');
assert.equal(look.cleanLook({color:'#123456'},4).color,'#123456');

console.log('Character look model keeps modern choices, migrates recognisable legacy choices and supplies the current integrated-hair default for missing/obsolete data.');
