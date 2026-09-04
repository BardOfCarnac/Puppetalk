import fs from 'node:fs';
import vm from 'node:vm';

const appSource=fs.readFileSync('app.js','utf8');
const decorators=[
  'character-creator-patch.js','character-creator-hotfix.js','line-face-mouths-patch.js',
  'line-face-features-patch.js','face-spacing-patch.js','toy-system.js','toy-tap.js',
  'dart-stick.js','balloon-tie.js','toy-throw.js','prop-extremities.js','balloon-buoyancy.js',
  'dart-balloon-pop.js','severable-joints.js','laser-frisbee.js','item-polish.js','special-items.js'
];

const stubNode=()=>({appendChild(){},remove(){},pause(){},play(){return Promise.resolve();},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}},dataset:{},style:{},textContent:'',srcObject:null});
const document={documentElement:stubNode(),head:stubNode(),body:stubNode(),createElement:stubNode,querySelector(){return null;}};
class MutationObserver{observe(){}disconnect(){}}
const location={href:'https://puppetalk.test/app.js',origin:'https://puppetalk.test'};
const context={console,performance,Response,URL,setTimeout,clearTimeout,document,MutationObserver,location,window:{}};
context.window.fetch=async()=>new Response(appSource,{status:200});
context.globalThis=context;

for(const file of decorators) vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const response=await context.window.fetch('app.js');
const composed=await response.text();

for(const required of [
  'PUPPETALK_SPECIAL_ITEMS_V1',
  "const SPECIAL_ITEM_BY_SLOT = ['frisbee','pump','ball','dart','frisbee','pump'];",
  "msg?.type !== 'special-item'",
  'id="special-item"',
  "send(conn,{type:'special-item',action:'bring-out'})"
]) if(!composed.includes(required)) throw new Error(`Missing special item hook: ${required}`);

const packed=/function ensureTestProps\(\)\{[\s\S]*?\n  \}/.exec(composed)?.[0]||'';
if(!packed) throw new Error('ensureTestProps missing after special item pass');
if(/makeProp\s*\(/.test(packed)) throw new Error('Normal table still pre-spawns test props');

new Function(composed);
console.log('Packed special item composition smoke check passed.');
