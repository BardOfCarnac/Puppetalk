// Final live-table character head renderer.
// Runs after the older character decorators and replaces whichever legacy head block survived.
(() => {
  const decoratedFetch = window.fetch.bind(window);

  function patch(source){
    if(!source.includes('function puppetHeadPath') || !source.includes('function drawLineFaceMouth')) return source;

    const headPattern=/  const hx = p\.head\.x\*w;[\s\S]*?  ctx\.restore\(\);\n\n  ctx\.font =/;
    if(!headPattern.test(source)) return source;

    const head=`  const hx = p.head.x*w;
  const hy = p.head.y*h;
  const hr = Math.max(13,26*scale);
  const rawLook = p.look && typeof p.look === 'object' ? p.look : {};
  const headStyle = (typeof PUPPET_HEAD_STYLES !== 'undefined' && PUPPET_HEAD_STYLES.includes(rawLook.headStyle))
    ? rawLook.headStyle
    : (typeof legacyHeadStyle === 'function' ? legacyHeadStyle(rawLook.head,rawLook.hair) : 'smooth');
  const eyeStyle = (typeof LINE_FACE_EYES !== 'undefined' && LINE_FACE_EYES[rawLook.eyes]) ? rawLook.eyes : 'dots';
  const noseStyle = (typeof LINE_FACE_NOSES !== 'undefined' && LINE_FACE_NOSES[rawLook.nose]) ? rawLook.nose : 'curve';
  const mouthStyle = (typeof LINE_FACE_MOUTHS !== 'undefined' && LINE_FACE_MOUTHS[rawLook.mouth]) ? rawLook.mouth : 'line';
  const extra = rawLook.extra || 'none';
  const liveColor = /^#[0-9a-f]{6}$/i.test(rawLook.color || '') ? rawLook.color : (p.color || '#aaa');

  ctx.save();
  ctx.translate(hx,hy);
  ctx.rotate(p.head.a || 0);
  puppetHeadPath(ctx,headStyle,hr);
  ctx.fillStyle=liveColor;
  ctx.fill();
  ctx.strokeStyle='#08090a';
  ctx.lineWidth=Math.max(3,hr*.12);
  ctx.lineJoin='round';
  ctx.stroke();

  drawLineFaceEyes(ctx,eyeStyle,hr);
  drawLineFaceNose(ctx,noseStyle,hr);

  const faceScale=hr*2/100;
  const eyeY=(-17+6)*faceScale;
  const ex=hr*.31;
  ctx.strokeStyle=ctx.fillStyle='#08090a';
  ctx.lineCap='round';
  if(extra==='glasses'){
    ctx.lineWidth=Math.max(1.3,hr*.055);
    for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*ex,eyeY,hr*.22,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-ex+hr*.22,eyeY);ctx.lineTo(ex-hr*.22,eyeY);ctx.stroke();
  }
  if(extra==='eyepatch'){
    ctx.beginPath();ctx.arc(ex,eyeY,hr*.19,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=Math.max(1.5,hr*.06);ctx.beginPath();ctx.moveTo(-hr*.72,-hr*.48);ctx.lineTo(hr*.72,eyeY);ctx.stroke();
  }
  if(extra==='freckles'){
    for(const x of [-.43,-.3,-.17,.17,.3,.43]){ctx.beginPath();ctx.arc(hr*x,hr*.10+(Math.abs(x)>.35?hr*.03:0),hr*.027,0,Math.PI*2);ctx.fill();}
  }

  drawLineFaceMouth(ctx,mouthStyle,p.mouth,hr);
  if(extra==='moustache'){
    ctx.beginPath();ctx.ellipse(-hr*.13,hr*.27,hr*.2,hr*.09,-.25,0,Math.PI*2);ctx.ellipse(hr*.13,hr*.27,hr*.2,hr*.09,.25,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();`;

    return source.replace(headPattern,head+'\n\n  ctx.font =');
  }

  window.fetch=async(...args)=>{
    const response=await decoratedFetch(...args);
    const target=String(args[0]?.url||args[0]||'');
    if(!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text=await response.text();
    return new Response(patch(text),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();
