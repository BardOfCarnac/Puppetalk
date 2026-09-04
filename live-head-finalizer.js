// Final live-table character head renderer.
// Deliberately self-contained so it does not depend on earlier head/eye/nose helpers surviving source transforms.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('function drawLineFaceMouth')) return source;

    const headPattern=/  const hx = p\.head\.x\*w;[\s\S]*?  ctx\.restore\(\);\s+  ctx\.font =/;
    if(!headPattern.test(source)) return source;

    const head=`  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(13,26*scale);
  const rawLook = p.look && typeof p.look === 'object' ? p.look : {};
  const headStyles=['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'];
  const headStyle=headStyles.includes(rawLook.headStyle)?rawLook.headStyle:'smooth';
  const eyeStyle=['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight'].includes(rawLook.eyes)?rawLook.eyes:'dots';
  const noseStyle=['angular','bow','curve','hook','long','slant'].includes(rawLook.nose)?rawLook.nose:'curve';
  const mouthStyle=['frown','line','pleased','shy','smile','smirk','soft','wavy'].includes(rawLook.mouth)?rawLook.mouth:'line';
  const extra=rawLook.extra||'none';
  const liveColor=/^#[0-9a-f]{6}$/i.test(rawLook.color||'')?rawLook.color:(p.color||'#aaa');

  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a||0);

  const hp=(x,y)=>[x*hr,y*hr];
  const headPath=()=>{
    ctx.beginPath();
    if(headStyle==='spikes'){
      ctx.moveTo(...hp(-.82,.58));ctx.bezierCurveTo(...hp(-1.02,.12),...hp(-.96,-.32),...hp(-.72,-.58));
      [[-.60,-.94],[-.42,-.66],[-.20,-1.02],[0,-.68],[.22,-1.03],[.42,-.66],[.62,-.92],[.73,-.56]].forEach(q=>ctx.lineTo(...hp(...q)));
      ctx.bezierCurveTo(...hp(1,-.28),...hp(1.02,.24),...hp(.82,.58));ctx.bezierCurveTo(...hp(.62,.96),...hp(.28,1.05),...hp(0,1.03));ctx.bezierCurveTo(...hp(-.3,1.05),...hp(-.62,.96),...hp(-.82,.58));
    }else if(headStyle==='tallSpikes'){
      ctx.moveTo(...hp(-.78,.62));ctx.bezierCurveTo(...hp(-1,.12),...hp(-.93,-.28),...hp(-.68,-.48));
      [[-.58,-1.12],[-.34,-.64],[-.18,-1.28],[.04,-.66],[.24,-1.22],[.43,-.61],[.61,-1.08],[.72,-.48]].forEach(q=>ctx.lineTo(...hp(...q)));
      ctx.bezierCurveTo(...hp(.98,-.24),...hp(1,.26),...hp(.78,.62));ctx.bezierCurveTo(...hp(.58,.98),...hp(.25,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.28,1.06),...hp(-.58,.98),...hp(-.78,.62));
    }else if(headStyle==='burst'){
      ctx.moveTo(...hp(-.76,.68));[[-1.05,.30],[-.82,.05],[-1.08,-.18],[-.78,-.35],[-.92,-.70],[-.55,-.67],[-.48,-1.03],[-.18,-.78],[.02,-1.12],[.20,-.77],[.52,-1.02],[.56,-.65],[.94,-.72],[.80,-.35],[1.08,-.16],[.82,.05],[1.04,.32],[.76,.68]].forEach(q=>ctx.lineTo(...hp(...q)));
      ctx.bezierCurveTo(...hp(.55,.98),...hp(.25,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.28,1.06),...hp(-.55,.98),...hp(-.76,.68));
    }else if(headStyle==='scallop'){
      ctx.moveTo(...hp(-.84,.62));ctx.bezierCurveTo(...hp(-1,.18),...hp(-.98,-.24),...hp(-.72,-.48));
      ctx.quadraticCurveTo(...hp(-.62,-.88),...hp(-.35,-.72));ctx.quadraticCurveTo(...hp(-.22,-1.05),...hp(.02,-.76));ctx.quadraticCurveTo(...hp(.20,-1.05),...hp(.39,-.72));ctx.quadraticCurveTo(...hp(.63,-.93),...hp(.76,-.48));
      ctx.bezierCurveTo(...hp(1,-.22),...hp(1,.24),...hp(.84,.62));ctx.bezierCurveTo(...hp(.62,.98),...hp(.27,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.3,1.06),...hp(-.62,.98),...hp(-.84,.62));
    }else if(headStyle==='tufts'){
      ctx.moveTo(...hp(-.83,.62));ctx.bezierCurveTo(...hp(-1,.18),...hp(-.97,-.30),...hp(-.67,-.55));ctx.quadraticCurveTo(...hp(-.56,-1.03),...hp(-.25,-.68));ctx.quadraticCurveTo(...hp(-.05,-1.18),...hp(.15,-.68));ctx.quadraticCurveTo(...hp(.48,-1.08),...hp(.68,-.52));ctx.bezierCurveTo(...hp(.98,-.28),...hp(1,.24),...hp(.83,.62));ctx.bezierCurveTo(...hp(.62,.98),...hp(.27,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.3,1.06),...hp(-.62,.98),...hp(-.83,.62));
    }else if(headStyle==='swept'){
      ctx.moveTo(...hp(-.84,.60));ctx.bezierCurveTo(...hp(-1,.12),...hp(-.94,-.30),...hp(-.64,-.55));ctx.bezierCurveTo(...hp(-.36,-.90),...hp(.03,-.72),...hp(.25,-1.18));ctx.bezierCurveTo(...hp(.32,-.82),...hp(.69,-.98),...hp(.68,-.55));ctx.bezierCurveTo(...hp(.99,-.30),...hp(1.01,.25),...hp(.84,.60));ctx.bezierCurveTo(...hp(.62,.98),...hp(.27,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.3,1.06),...hp(-.62,.98),...hp(-.84,.60));
    }else if(headStyle==='fringe'){
      ctx.moveTo(...hp(-.84,.62));ctx.bezierCurveTo(...hp(-1,.20),...hp(-.98,-.24),...hp(-.74,-.50));[[-.60,-.90],[-.38,-.68],[-.15,-.98],[.08,-.70],[.31,-.98],[.50,-.68],[.72,-.88],[.75,-.50]].forEach(q=>ctx.lineTo(...hp(...q)));ctx.bezierCurveTo(...hp(1,-.25),...hp(1,.24),...hp(.84,.62));ctx.bezierCurveTo(...hp(.62,.98),...hp(.27,1.06),...hp(0,1.04));ctx.bezierCurveTo(...hp(-.3,1.06),...hp(-.62,.98),...hp(-.84,.62));
    }else ctx.arc(0,0,hr,0,Math.PI*2);
    ctx.closePath();
  };
  headPath();ctx.fillStyle=liveColor;ctx.fill();ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(3,hr*.12);ctx.lineJoin='round';ctx.stroke();

  const eyeMap={closed:[['M6 5q6 5 13 0m24 0q7 5 13 0',4.2]],dots:[['M12 6h.01M50 6h.01',7]],happy:[['M6 7q6-6 13 0m24 0q7-6 13 0',4.2]],mismatch:[['M6 5q6 5 13 0m24 1q7 1.5 13 0',4.2]],sleepy:[['M6 6q7 1.5 13 0m24 0q7 1.5 13 0',4.2]],unevenDots:[['M12 4.5h.01M50 7.5h.01',7]],wink:[['M6 5q6 5 13 0',4.2],['M50 6h.01',7]],winkRight:[['M12 6h.01',7],['M43 5q7 5 13 0',4.2]]};
  const noseMap={angular:'M13 6 7 26l8 2.5',bow:'M13 5c-5.5 8-8 16-6 24',curve:'M12 6c-2.5 8-7 15-6 22q.5 5 6 4',hook:'M13 5 5.5 27q-1 6.5 5.5 5.5',long:'M15 3 4 30q-1.5 5.5 6 5',slant:'M13 5 6 29'};
  const fs=hr*2/100;
  ctx.save();ctx.translate(-31*fs,-17*fs);ctx.scale(fs,fs);ctx.strokeStyle='#08090a';ctx.lineCap='round';ctx.lineJoin='round';for(const part of eyeMap[eyeStyle]){ctx.lineWidth=part[1];ctx.stroke(new Path2D(part[0]));}ctx.restore();
  ctx.save();ctx.translate(-10*fs,-22*fs);ctx.scale(fs,fs);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(noseMap[noseStyle]));ctx.restore();

  const eyeY=(-17+6)*fs,ex=hr*.31;ctx.strokeStyle=ctx.fillStyle='#08090a';ctx.lineCap='round';
  if(extra==='glasses'){ctx.lineWidth=Math.max(1.3,hr*.055);for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke();}
  if(extra==='eyepatch'){ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(1.5,hr*.06);ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();}
  if(extra==='freckles'){for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.10+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}}
  drawLineFaceMouth(ctx,mouthStyle,p.mouth,hr);
  if(extra==='moustache'){ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();}
  ctx.restore();`;

    return source.replace(headPattern,head+'\n\n  ctx.font =');
  }

  window.fetch=async(...args)=>{
    const response=await decoratedFetch(...args);
    const target=String(args[0]?.url||args[0]||'');
    if(!/app\.js(?:\?|$)/.test(target)) return response;
    const text=await response.text();
    return new Response(patch(text),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
