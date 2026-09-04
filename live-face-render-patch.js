// Canonical live character-face compatibility layer.
// The standalone lobby already saves headStyle + Line Face parts. Earlier source
// decorators could leave the legacy round-head renderer in the final table build;
// this pass normalizes the live data model and replaces that renderer reliably.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  const HELPERS = `
const PUPPETALK_LIVE_HEAD_STYLES=['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];
const PUPPETALK_LIVE_EYES={
  closed:[{d:'M6 5q6 5 13 0m24 0q7 5 13 0',w:4.2}],
  dots:[{d:'M12 6h.01M50 6h.01',w:7}],
  happy:[{d:'M6 7q6-6 13 0m24 0q7-6 13 0',w:4.2}],
  mismatch:[{d:'M6 5q6 5 13 0m24 1q7 1.5 13 0',w:4.2}],
  sleepy:[{d:'M6 6q7 1.5 13 0m24 0q7 1.5 13 0',w:4.2}],
  unevenDots:[{d:'M12 4.5h.01M50 7.5h.01',w:7}],
  wink:[{d:'M6 5q6 5 13 0',w:4.2},{d:'M50 6h.01',w:7}],
  winkRight:[{d:'M12 6h.01',w:7},{d:'M43 5q7 5 13 0',w:4.2}]
};
const PUPPETALK_LIVE_NOSES={
  angular:'M13 6 7 26l8 2.5',bow:'M13 5c-5.5 8-8 16-6 24',
  curve:'M12 6c-2.5 8-7 15-6 22q.5 5 6 4',hook:'M13 5 5.5 27q-1 6.5 5.5 5.5',
  long:'M15 3 4 30q-1.5 5.5 6 5',slant:'M13 5 6 29'
};
const PUPPETALK_LIVE_MOUTHS={
  frown:{d:'M7 11q15-6.5 29-1',open:11},line:{d:'m8 10 28-2',open:12},
  pleased:{d:'M4 9q16 7 30-1l7-5',open:13},shy:{d:'M15 9.5q8 4 16-1',open:9},
  smile:{d:'M3 9q19 10 38-3',open:14},smirk:{d:'M9 10q14 4 26-4',open:12},
  soft:{d:'M6 9q16 6 32-2',open:12},wavy:{d:'M6 10q7-4 14 0 8 4.5 18-2',open:12}
};
const PUPPETALK_LIVE_EYE_NAMES=Object.keys(PUPPETALK_LIVE_EYES);
const PUPPETALK_LIVE_NOSE_NAMES=Object.keys(PUPPETALK_LIVE_NOSES);
const PUPPETALK_LIVE_MOUTH_NAMES=Object.keys(PUPPETALK_LIVE_MOUTHS);
const PUPPETALK_LIVE_EXTRAS=['none','glasses','moustache','freckles','eyepatch'];
const PUPPETALK_LIVE_MOUTH_CACHE=new Map();
function puppetalkLegacyHeadStyle(head,hair){
  if(hair==='tuft')return'tufts';if(hair==='wave')return'swept';if(hair==='mop')return'scallop';
  if(hair==='cap')return'fringe';if(hair==='crop')return'spikes';if(head==='long')return'tallSpikes';
  if(head==='wide')return'burst';return'smooth';
}
function puppetalkLiveHeadPath(ctx,style,r){
  const p=(x,y)=>[x*r,y*r];ctx.beginPath();
  if(style==='spikes'){
    ctx.moveTo(...p(-.82,.58));ctx.bezierCurveTo(...p(-1.02,.12),...p(-.96,-.32),...p(-.72,-.58));
    [[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(1,-.28),...p(1.02,.24),...p(.82,.58));ctx.bezierCurveTo(...p(.62,.96),...p(.28,1.05),...p(0,1.03));ctx.bezierCurveTo(...p(-.3,1.05),...p(-.62,.96),...p(-.82,.58));
  }else if(style==='tallSpikes'){
    ctx.moveTo(...p(-.78,.62));ctx.bezierCurveTo(...p(-1,.12),...p(-.93,-.28),...p(-.68,-.48));
    [[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.98,-.24),...p(1,.26),...p(.78,.62));ctx.bezierCurveTo(...p(.58,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.58,.98),...p(-.78,.62));
  }else if(style==='burst'){
    ctx.moveTo(...p(-.76,.68));[[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));
  }else if(style==='scallop'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1,.18),...p(-.98,-.24),...p(-.72,-.48));
    ctx.quadraticCurveTo(...p(-.62,-.88),...p(-.35,-.72));ctx.quadraticCurveTo(...p(-.22,-1.05),...p(.02,-.76));ctx.quadraticCurveTo(...p(.20,-1.05),...p(.39,-.72));ctx.quadraticCurveTo(...p(.63,-.93),...p(.76,-.48));
    ctx.bezierCurveTo(...p(1,-.22),...p(1,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.62));
  }else if(style==='tufts'){
    ctx.moveTo(...p(-.83,.62));ctx.bezierCurveTo(...p(-1,.18),...p(-.97,-.30),...p(-.67,-.55));ctx.quadraticCurveTo(...p(-.56,-1.03),...p(-.25,-.68));ctx.quadraticCurveTo(...p(-.05,-1.18),...p(.15,-.68));ctx.quadraticCurveTo(...p(.48,-1.08),...p(.68,-.52));ctx.bezierCurveTo(...p(.98,-.28),...p(1,.24),...p(.83,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.83,.62));
  }else if(style==='swept'){
    ctx.moveTo(...p(-.84,.60));ctx.bezierCurveTo(...p(-1,.12),...p(-.94,-.30),...p(-.64,-.55));ctx.bezierCurveTo(...p(-.36,-.90),...p(.03,-.72),...p(.25,-1.18));ctx.bezierCurveTo(...p(.32,-.82),...p(.69,-.98),...p(.68,-.55));ctx.bezierCurveTo(...p(.99,-.30),...p(1.01,.25),...p(.84,.60));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.60));
  }else if(style==='fringe'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1,.20),...p(-.98,-.24),...p(-.74,-.50));[[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50]].forEach(q=>ctx.lineTo(...p(...q)));ctx.bezierCurveTo(...p(1,-.25),...p(1,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.3,1.06),...p(-.62,.98),...p(-.84,.62));
  }else ctx.arc(0,0,r,0,Math.PI*2);ctx.closePath();
}
function puppetalkDrawLiveEyes(ctx,name,hr){
  const parts=PUPPETALK_LIVE_EYES[name]||PUPPETALK_LIVE_EYES.dots,s=hr*2/100;
  ctx.save();ctx.translate(-31*s,-17*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineCap='round';ctx.lineJoin='round';
  for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}ctx.restore();
}
function puppetalkDrawLiveNose(ctx,name,hr){
  const d=PUPPETALK_LIVE_NOSES[name]||PUPPETALK_LIVE_NOSES.curve,s=hr*2/100;
  ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(d));ctx.restore();
}
function puppetalkLiveMouthSamples(name){
  name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';if(PUPPETALK_LIVE_MOUTH_CACHE.has(name))return PUPPETALK_LIVE_MOUTH_CACHE.get(name);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',PUPPETALK_LIVE_MOUTHS[name].d);const len=path.getTotalLength(),pts=[];
  for(let i=0;i<=36;i++){const t=i/36,q=path.getPointAtLength(len*t);pts.push({x:q.x,y:q.y,t});}PUPPETALK_LIVE_MOUTH_CACHE.set(name,pts);return pts;
}
function puppetalkDrawLiveMouth(ctx,name,state,hr){
  name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';const def=PUPPETALK_LIVE_MOUTHS[name],pts=puppetalkLiveMouthSamples(name),s=hr*2/100,sv=Number.isFinite(state)?Math.max(0,Math.min(2,state)):0;
  ctx.save();ctx.translate(-20*s,13*s);ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
  if(sv<=0){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle='#08090a';ctx.lineWidth=4.6;ctx.stroke();}
  else{const amount=def.open*(sv===1?.38:1),up=[],lo=[];for(const p of pts){const taper=Math.pow(Math.sin(Math.PI*p.t),.68),spread=amount*taper;up.push({x:p.x,y:p.y-spread*.30});lo.push({x:p.x,y:p.y+spread*.72});}ctx.beginPath();ctx.moveTo(up[0].x,up[0].y);for(let i=1;i<up.length;i++)ctx.lineTo(up[i].x,up[i].y);for(let i=lo.length-1;i>=0;i--)ctx.lineTo(lo[i].x,lo[i].y);ctx.closePath();ctx.fillStyle='#08090a';ctx.fill();}
  ctx.restore();
}
`;

  function patch(source){
    if(!source.includes('function drawAnatomy(ctx,p,w,h')) return source;

    // Ensure the final live data model accepts the same fields saved by creator.html.
    source=source.replace(/const LOOK_PARTS = \{[\s\S]*?\n\};/,`const LOOK_PARTS = {
  headStyle:['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'],
  eyes:['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight'],
  nose:['angular','bow','curve','hook','long','slant'],
  mouth:['frown','line','pleased','shy','smile','smirk','soft','wavy'],
  extra:['none','glasses','moustache','freckles','eyepatch']
};`);
    source=source.replace(/function defaultLook\(slot=0\)\{[\s\S]*?\n\}/,`function defaultLook(slot=0){
  return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'};
}`);
    source=source.replace(/function cleanLook\(value,slot=0\)\{[\s\S]*?\n\}/,`function cleanLook(value,slot=0){
  const base=defaultLook(slot),look=value&&typeof value==='object'?value:{};
  const migrated=LOOK_PARTS.headStyle.includes(look.headStyle)?look.headStyle:puppetalkLegacyHeadStyle(look.head,look.hair);
  return {
    color:/^#[0-9a-f]{6}$/i.test(look.color||'')?look.color:base.color,
    headStyle:LOOK_PARTS.headStyle.includes(migrated)?migrated:base.headStyle,
    eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
    nose:LOOK_PARTS.nose.includes(look.nose)?look.nose:base.nose,
    mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,
    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
  };
}`);

    if(!source.includes('function puppetalkLiveHeadPath')){
      source=source.replace('function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){',`${HELPERS}\nfunction drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){`);
    }

    const liveHead=`  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(13,26*scale);
  const look = cleanLook(p.look,p.slot||0);
  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a || 0);
  puppetalkLiveHeadPath(ctx,look.headStyle,hr);
  ctx.fillStyle=look.color;ctx.fill();
  ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(3,hr*.12);ctx.lineJoin='round';ctx.stroke();
  puppetalkDrawLiveEyes(ctx,look.eyes,hr);
  puppetalkDrawLiveNose(ctx,look.nose,hr);
  const eyeY=-17*(hr*2/100)+6*(hr*2/100),ex=hr*.31;
  ctx.strokeStyle=ctx.fillStyle='#08090a';ctx.lineCap='round';
  if(look.extra==='glasses'){ctx.lineWidth=Math.max(1.3,hr*.055);for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke();}
  if(look.extra==='eyepatch'){ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(1.5,hr*.06);ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();}
  if(look.extra==='freckles'){for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.10+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}}
  puppetalkDrawLiveMouth(ctx,look.mouth,p.mouth,hr);
  if(look.extra==='moustache'){ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();`;

    // Match whichever legacy/partial character renderer survived previous decorators.
    const headPattern=/  const hx = p\.head\.x\*w;[\s\S]*?  ctx\.restore\(\);\n\n  ctx\.font =/;
    if(!headPattern.test(source)) throw new Error('Live face renderer patch could not locate the head block.');
    source=source.replace(headPattern,`${liveHead}\n\n  ctx.font =`);
    return source;
  }

  window.fetch=async(...args)=>{
    const response=await decoratedFetch(...args);
    const target=String(args[0]?.url||args[0]||'');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text=await response.text();
    return new Response(patch(text),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
