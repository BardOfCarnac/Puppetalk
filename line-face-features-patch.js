// Adds Line Face eyes/noses and integrated cartoon head silhouettes.
// Loaded after line-face-mouths-patch.js so all facial feature choices live in one look object.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  const FEATURE_HELPERS = `
const PUPPET_HEAD_STYLES = ['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];
const LINE_FACE_EYES = {
  closed:[{d:'M6 5q6 5 13 0m24 0q7 5 13 0',w:4.2}],
  dots:[{d:'M12 6h.01M50 6h.01',w:7}],
  happy:[{d:'M6 7q6-6 13 0m24 0q7-6 13 0',w:4.2}],
  mismatch:[{d:'M6 5q6 5 13 0m24 1q7 1.5 13 0',w:4.2}],
  sleepy:[{d:'M6 6q7 1.5 13 0m24 0q7 1.5 13 0',w:4.2}],
  unevenDots:[{d:'M12 4.5h.01M50 7.5h.01',w:7}],
  wink:[{d:'M6 5q6 5 13 0',w:4.2},{d:'M50 6h.01',w:7}],
  winkRight:[{d:'M12 6h.01',w:7},{d:'M43 5q7 5 13 0',w:4.2}]
};
const LINE_FACE_NOSES = {
  angular:'M13 6 7 26l8 2.5',
  bow:'M13 5c-5.5 8-8 16-6 24',
  curve:'M12 6c-2.5 8-7 15-6 22q.5 5 6 4',
  hook:'M13 5 5.5 27q-1 6.5 5.5 5.5',
  long:'M15 3 4 30q-1.5 5.5 6 5',
  slant:'M13 5 6 29'
};
function legacyHeadStyle(head,hair){
  if(hair==='tuft') return 'tufts';
  if(hair==='wave') return 'swept';
  if(hair==='mop') return 'scallop';
  if(hair==='cap') return 'fringe';
  if(hair==='crop') return 'spikes';
  if(head==='long') return 'tallSpikes';
  if(head==='wide') return 'burst';
  return 'smooth';
}
function puppetHeadPath(ctx,style,r){
  const p=(x,y)=>[x*r,y*r];
  ctx.beginPath();
  if(style==='spikes'){
    ctx.moveTo(...p(-.82,.58));
    ctx.bezierCurveTo(...p(-1.02,.12),...p(-.96,-.32),...p(-.72,-.58));
    [[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(1.00,-.28),...p(1.02,.24),...p(.82,.58));
    ctx.bezierCurveTo(...p(.62,.96),...p(.28,1.05),...p(0,1.03));
    ctx.bezierCurveTo(...p(-.30,1.05),...p(-.62,.96),...p(-.82,.58));
  }else if(style==='tallSpikes'){
    ctx.moveTo(...p(-.78,.62));
    ctx.bezierCurveTo(...p(-1.0,.12),...p(-.93,-.28),...p(-.68,-.48));
    [[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48]].forEach(q=>ctx.lineTo(...p(...q)));
    ctx.bezierCurveTo(...p(.98,-.24),...p(1.0,.26),...p(.78,.62));
    ctx.bezierCurveTo(...p(.58,.98),...p(.25,1.06),...p(0,1.04));
    ctx.bezierCurveTo(...p(-.28,1.06),...p(-.58,.98),...p(-.78,.62));
  }else if(style==='burst'){
    ctx.moveTo(...p(-.76,.68));
    ctx.lineTo(...p(-1.05,.30));ctx.lineTo(...p(-.82,.05));ctx.lineTo(...p(-1.08,-.18));ctx.lineTo(...p(-.78,-.35));
    ctx.lineTo(...p(-.92,-.70));ctx.lineTo(...p(-.55,-.67));ctx.lineTo(...p(-.48,-1.03));ctx.lineTo(...p(-.18,-.78));
    ctx.lineTo(...p(.02,-1.12));ctx.lineTo(...p(.20,-.77));ctx.lineTo(...p(.52,-1.02));ctx.lineTo(...p(.56,-.65));
    ctx.lineTo(...p(.94,-.72));ctx.lineTo(...p(.80,-.35));ctx.lineTo(...p(1.08,-.16));ctx.lineTo(...p(.82,.05));ctx.lineTo(...p(1.04,.32));ctx.lineTo(...p(.76,.68));
    ctx.bezierCurveTo(...p(.55,.98),...p(.25,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.28,1.06),...p(-.55,.98),...p(-.76,.68));
  }else if(style==='scallop'){
    ctx.moveTo(...p(-.84,.62));
    ctx.bezierCurveTo(...p(-1.0,.18),...p(-.98,-.24),...p(-.72,-.48));
    ctx.quadraticCurveTo(...p(-.62,-.88),...p(-.35,-.72));ctx.quadraticCurveTo(...p(-.22,-1.05),...p(.02,-.76));ctx.quadraticCurveTo(...p(.20,-1.05),...p(.39,-.72));ctx.quadraticCurveTo(...p(.63,-.93),...p(.76,-.48));
    ctx.bezierCurveTo(...p(1.0,-.22),...p(1.0,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.62));
  }else if(style==='tufts'){
    ctx.moveTo(...p(-.83,.62));ctx.bezierCurveTo(...p(-1.0,.18),...p(-.97,-.30),...p(-.67,-.55));
    ctx.quadraticCurveTo(...p(-.56,-1.03),...p(-.25,-.68));ctx.quadraticCurveTo(...p(-.05,-1.18),...p(.15,-.68));ctx.quadraticCurveTo(...p(.48,-1.08),...p(.68,-.52));
    ctx.bezierCurveTo(...p(.98,-.28),...p(1.0,.24),...p(.83,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.83,.62));
  }else if(style==='swept'){
    ctx.moveTo(...p(-.84,.60));ctx.bezierCurveTo(...p(-1.0,.12),...p(-.94,-.30),...p(-.64,-.55));
    ctx.bezierCurveTo(...p(-.36,-.90),...p(.03,-.72),...p(.25,-1.18));ctx.bezierCurveTo(...p(.32,-.82),...p(.69,-.98),...p(.68,-.55));
    ctx.bezierCurveTo(...p(.99,-.30),...p(1.01,.25),...p(.84,.60));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.60));
  }else if(style==='fringe'){
    ctx.moveTo(...p(-.84,.62));ctx.bezierCurveTo(...p(-1.0,.20),...p(-.98,-.24),...p(-.74,-.50));
    ctx.lineTo(...p(-.60,-.90));ctx.lineTo(...p(-.38,-.68));ctx.lineTo(...p(-.15,-.98));ctx.lineTo(...p(.08,-.70));ctx.lineTo(...p(.31,-.98));ctx.lineTo(...p(.50,-.68));ctx.lineTo(...p(.72,-.88));ctx.lineTo(...p(.75,-.50));
    ctx.bezierCurveTo(...p(1.0,-.25),...p(1.0,.24),...p(.84,.62));ctx.bezierCurveTo(...p(.62,.98),...p(.27,1.06),...p(0,1.04));ctx.bezierCurveTo(...p(-.30,1.06),...p(-.62,.98),...p(-.84,.62));
  }else{
    ctx.arc(0,0,r,0,Math.PI*2);
  }
  ctx.closePath();
}
function drawLineFaceEyes(ctx,name,hr){
  const parts=LINE_FACE_EYES[name]||LINE_FACE_EYES.dots;
  const s=hr*1.05/62;
  ctx.save();ctx.translate(-31*s,-hr*.20-6*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineCap='round';ctx.lineJoin='round';
  for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2D(part.d));}
  ctx.restore();
}
function drawLineFaceNose(ctx,name,hr){
  const d=LINE_FACE_NOSES[name]||LINE_FACE_NOSES.curve;
  const s=hr*.70/38;
  ctx.save();ctx.translate(-9*s,-hr*.17);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(d));ctx.restore();
}
`;

  function patch(source){
    if(!source.includes('const LOOK_PARTS =') || !source.includes('function drawLineFaceMouth')) return source;

    source = source.replace(
      /  head:\[[^\n]+\],\n  eyes:\[[^\n]+\],\n  hair:\[[^\n]+\],\n  mouth:/,
      "  headStyle:['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'],\n  eyes:['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight'],\n  nose:['angular','bow','curve','hook','long','slant'],\n  mouth:"
    );

    source = source.replace(
      "return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],head:'round',eyes:'dots',hair:'none',mouth:'line',extra:'none'};",
      "return {color:LOOK_PALETTE[slot%LOOK_PALETTE.length],headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'};"
    );

    source = source.replace(
`function cleanLook(value,slot=0){
  const base=defaultLook(slot), look=value&&typeof value==='object'?value:{};
  return {
    color:/^#[0-9a-f]{6}$/i.test(look.color||'')?look.color:base.color,
    head:LOOK_PARTS.head.includes(look.head)?look.head:base.head,
    eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
    hair:LOOK_PARTS.hair.includes(look.hair)?look.hair:base.hair,
    mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,
    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
  };
}`,
`function cleanLook(value,slot=0){
  const base=defaultLook(slot), look=value&&typeof value==='object'?value:{};
  const migratedHead=LOOK_PARTS.headStyle.includes(look.headStyle)?look.headStyle:legacyHeadStyle(look.head,look.hair);
  return {
    color:/^#[0-9a-f]{6}$/i.test(look.color||'')?look.color:base.color,
    headStyle:LOOK_PARTS.headStyle.includes(migratedHead)?migratedHead:base.headStyle,
    eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
    nose:LOOK_PARTS.nose.includes(look.nose)?look.nose:base.nose,
    mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,
    extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
  };
}`
    );

    source = source.replace(
      'const LINE_FACE_MOUTHS = {',
      `${FEATURE_HELPERS}\nconst LINE_FACE_MOUTHS = {`
    );

    source = source.replace(
      '<button type="button" data-look="head"><span>Head</span><strong id="look-head">round</strong></button>',
      '<button type="button" data-look="headStyle"><span>Head</span><strong id="look-headStyle">spikes</strong></button>'
    );
    source = source.replace(
      '<button type="button" data-look="eyes"><span>Eyes</span><strong id="look-eyes">dots</strong></button>',
      '<button type="button" data-look="eyes"><span>Eyes</span><strong id="look-eyes">dots</strong></button>\n          <button type="button" data-look="nose"><span>Nose</span><strong id="look-nose">curve</strong></button>'
    );
    source = source.replace(
      /\n\s*<button type="button" data-look="hair"><span>Hair<\/span><strong id="look-hair">none<\/strong><\/button>/,
      ''
    );
    source = source.replace(
      "for(const key of ['head','eyes','mouth','hair','extra'])",
      "for(const key of ['headStyle','eyes','nose','mouth','extra'])"
    );
    source = source.replace(
      "input.look={color:pick(LOOK_PALETTE),head:pick(LOOK_PARTS.head),eyes:pick(LOOK_PARTS.eyes),hair:pick(LOOK_PARTS.hair),mouth:pick(LOOK_PARTS.mouth),extra:pick(LOOK_PARTS.extra)};",
      "input.look={color:pick(LOOK_PALETTE),headStyle:pick(LOOK_PARTS.headStyle),eyes:pick(LOOK_PARTS.eyes),nose:pick(LOOK_PARTS.nose),mouth:pick(LOOK_PARTS.mouth),extra:pick(LOOK_PARTS.extra)};"
    );

    const newHead = `  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(13,26*scale);
  const look = cleanLook(p.look,p.slot||0);
  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a || 0);
  puppetHeadPath(ctx,look.headStyle,hr);
  ctx.fillStyle=look.color;
  ctx.fill();
  ctx.strokeStyle='#08090a';
  ctx.lineWidth=Math.max(3,hr*.12);
  ctx.lineJoin='round';
  ctx.stroke();

  drawLineFaceEyes(ctx,look.eyes,hr);
  drawLineFaceNose(ctx,look.nose,hr);

  const eyeY=-hr*.20, ex=hr*.31;
  ctx.strokeStyle=ctx.fillStyle='#08090a';ctx.lineCap='round';
  if(look.extra==='glasses'){ctx.lineWidth=Math.max(1.3,hr*.055);for(const s of [-1,1]){ctx.beginPath();ctx.arc(s*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke();}
  if(look.extra==='eyepatch'){ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(1.5,hr*.06);ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();}
  if(look.extra==='freckles'){for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.10+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}}

  drawLineFaceMouth(ctx,look.mouth,p.mouth,hr);
  if(look.extra==='moustache'){ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();`;

    const headRendererPattern = /  const hx = p\.head\.x\*w;[\s\S]*?  ctx\.restore\(\);\s+  ctx\.font =/;
    if(!headRendererPattern.test(source)){
      throw new Error('Line Face features patch failed: head renderer');
    }
    source = source.replace(
      headRendererPattern,
      `${newHead}\n\n  ctx.font =`
    );
    if(!source.includes('puppetHeadPath(ctx,look.headStyle,hr)')){
      throw new Error('Line Face features patch failed: renderer not installed');
    }

    return source;
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text),{
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    });
  };
})();
