// Adds Line Face mouth selection + speech-family rendering after the character creator decorator.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  const MOUTH_HELPERS = `
const LINE_FACE_MOUTHS = {
  frown:{d:'M7 11q15-6.5 29-1',open:11},
  line:{d:'m8 10 28-2',open:12},
  pleased:{d:'M4 9q16 7 30-1l7-5',open:13},
  shy:{d:'M15 9.5q8 4 16-1',open:9},
  smile:{d:'M3 9q19 10 38-3',open:14},
  smirk:{d:'M9 10q14 4 26-4',open:12},
  soft:{d:'M6 9q16 6 32-2',open:12},
  wavy:{d:'M6 10q7-4 14 0 8 4.5 18-2',open:12}
};
const LINE_FACE_MOUTH_NAMES = Object.keys(LINE_FACE_MOUTHS);
const LINE_FACE_MOUTH_CACHE = new Map();
function lineFaceMouthSamples(name){
  name = LINE_FACE_MOUTHS[name] ? name : 'line';
  if(LINE_FACE_MOUTH_CACHE.has(name)) return LINE_FACE_MOUTH_CACHE.get(name);
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',LINE_FACE_MOUTHS[name].d);
  const length = path.getTotalLength();
  const points = [];
  const count = 36;
  for(let i=0;i<=count;i++){
    const t=i/count;
    const p=path.getPointAtLength(length*t);
    points.push({x:p.x,y:p.y,t});
  }
  LINE_FACE_MOUTH_CACHE.set(name,points);
  return points;
}
function drawLineFaceMouth(ctx,name,state,hr){
  name = LINE_FACE_MOUTHS[name] ? name : 'line';
  const def = LINE_FACE_MOUTHS[name];
  const points = lineFaceMouthSamples(name);
  const scale = hr*.85/44;
  const stateValue = Number.isFinite(state) ? Math.max(0,Math.min(2,state)) : 0;
  ctx.save();
  ctx.translate(-22*scale,hr*.36-9*scale);
  ctx.scale(scale,scale);
  ctx.lineCap='round';
  ctx.lineJoin='round';
  if(stateValue<=0){
    ctx.beginPath();
    ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
    ctx.strokeStyle='#08090a';
    ctx.lineWidth=4.6;
    ctx.stroke();
  }else{
    const strength = stateValue===1 ? .38 : 1;
    const amount = def.open*strength;
    const upper=[];
    const lower=[];
    for(const p of points){
      const taper=Math.pow(Math.sin(Math.PI*p.t),.68);
      const spread=amount*taper;
      upper.push({x:p.x,y:p.y-spread*.30});
      lower.push({x:p.x,y:p.y+spread*.72});
    }
    ctx.beginPath();
    ctx.moveTo(upper[0].x,upper[0].y);
    for(let i=1;i<upper.length;i++)ctx.lineTo(upper[i].x,upper[i].y);
    for(let i=lower.length-1;i>=0;i--)ctx.lineTo(lower[i].x,lower[i].y);
    ctx.closePath();
    ctx.fillStyle='#08090a';
    ctx.fill();
  }
  ctx.restore();
}
`;

  function patch(source){
    if(!source.includes('const LOOK_PARTS =') || !source.includes('function drawAnatomy')) return source;

    source = source.replace(
      "  hair:['none','crop','cap','tuft','wave','mop'],\n  extra:['none','glasses','moustache','freckles','eyepatch']",
      "  hair:['none','crop','cap','tuft','wave','mop'],\n  mouth:['frown','line','pleased','shy','smile','smirk','soft','wavy'],\n  extra:['none','glasses','moustache','freckles','eyepatch']"
    );

    source = source.replace(
      "return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],head:'round',eyes:'dots',hair:'none',extra:'none'};",
      "return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],head:'round',eyes:'dots',hair:'none',mouth:'line',extra:'none'};"
    );

    source = source.replace(
      "    hair:LOOK_PARTS.hair.includes(look.hair)?look.hair:base.hair,\n    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra",
      "    hair:LOOK_PARTS.hair.includes(look.hair)?look.hair:base.hair,\n    mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,\n    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra"
    );

    source = source.replace(
      "function savedLook(){try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();}}",
      `${MOUTH_HELPERS}\nfunction savedLook(){try{return cleanLook(JSON.parse(localStorage.getItem('puppetalk-look')||'null'));}catch{return defaultLook();}}`
    );

    source = source.replace(
      '<button type="button" data-look="hair"><span>Hair</span><strong id="look-hair">none</strong></button>',
      '<button type="button" data-look="mouth"><span>Mouth</span><strong id="look-mouth">line</strong></button>\n          <button type="button" data-look="hair"><span>Hair</span><strong id="look-hair">none</strong></button>'
    );

    source = source.replace(
      "for(const key of ['head','eyes','hair','extra'])",
      "for(const key of ['head','eyes','mouth','hair','extra'])"
    );

    source = source.replace(
      "input.look={color:pick(LOOK_PALETTE),head:pick(LOOK_PARTS.head),eyes:pick(LOOK_PARTS.eyes),hair:pick(LOOK_PARTS.hair),extra:pick(LOOK_PARTS.extra)};",
      "input.look={color:pick(LOOK_PALETTE),head:pick(LOOK_PARTS.head),eyes:pick(LOOK_PARTS.eyes),hair:pick(LOOK_PARTS.hair),mouth:pick(LOOK_PARTS.mouth),extra:pick(LOOK_PARTS.extra)};"
    );

    source = source.replace(
      "  ctx.beginPath();\n  if(p.mouth===0) roundRect(ctx,-hr*.27,hr*.34,hr*.54,Math.max(2,hr*.11),2);\n  else if(p.mouth===1) roundRect(ctx,-hr*.28,hr*.22,hr*.56,hr*.38,hr*.16);\n  else ctx.ellipse(0,hr*.4,hr*.34,hr*.42,0,0,Math.PI*2);\n  ctx.fill();",
      "  drawLineFaceMouth(ctx,look.mouth,p.mouth,hr);"
    );

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
