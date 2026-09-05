(function(root){
  'use strict';

  function create(options={}){
    const {
      cleanLook,
      document:documentRef=root.document,
      Path2DClass=root.Path2D,
      getDisplayPoint=()=>root.displayPoint,
      getProjectionRenderScale=()=>root.projectionRenderScale
    }=options;
    if(!cleanLook || !documentRef || !Path2DClass) return null;

    function drawBackdrop(ctx,w,h){
      ctx.clearRect(0,0,w,h);
      const g = ctx.createRadialGradient(w/2,h*.72,10,w/2,h*.72,Math.max(w,h)*.82);
      g.addColorStop(0,'#292b30');
      g.addColorStop(.48,'#17191c');
      g.addColorStop(1,'#0c0d0f');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = 'rgba(255,255,255,.075)';
      ctx.lineWidth = 1;
      for(let x=-w;x<w*2;x+=74){
        ctx.beginPath();
        ctx.moveTo(w/2+(x-w/2)*.22,h*.66);
        ctx.lineTo(x,h-20);
        ctx.stroke();
      }
      for(let y=h*.72;y<h-15;y+=34){
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(w,y);
        ctx.stroke();
      }
    }

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
      for(const part of parts){ctx.lineWidth=part.w;ctx.stroke(new Path2DClass(part.d));}ctx.restore();
    }
    function puppetalkDrawLiveNose(ctx,name,hr){
      const d=PUPPETALK_LIVE_NOSES[name]||PUPPETALK_LIVE_NOSES.curve,s=hr*2/100;
      ctx.save();ctx.translate(-10*s,-22*s);ctx.scale(s,s);ctx.strokeStyle='#08090a';ctx.lineWidth=4.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2DClass(d));ctx.restore();
    }
    function puppetalkLiveMouthSamples(name){
      name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';if(PUPPETALK_LIVE_MOUTH_CACHE.has(name))return PUPPETALK_LIVE_MOUTH_CACHE.get(name);
      const path=documentRef.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',PUPPETALK_LIVE_MOUTHS[name].d);const len=path.getTotalLength(),pts=[];
      for(let i=0;i<=36;i++){const t=i/36,q=path.getPointAtLength(len*t);pts.push({x:q.x,y:q.y,t});}PUPPETALK_LIVE_MOUTH_CACHE.set(name,pts);return pts;
    }
    function puppetalkDrawLiveMouth(ctx,name,state,hr){
      name=PUPPETALK_LIVE_MOUTHS[name]?name:'line';const def=PUPPETALK_LIVE_MOUTHS[name],pts=puppetalkLiveMouthSamples(name),s=hr*2/100,sv=Number.isFinite(state)?Math.max(0,Math.min(2,state)):0;
      ctx.save();ctx.translate(-20*s,13*s);ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
      if(sv<=0){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.strokeStyle='#08090a';ctx.lineWidth=4.6;ctx.stroke();}
      else{const amount=def.open*(sv===1?.38:1),up=[],lo=[];for(const p of pts){const taper=Math.pow(Math.sin(Math.PI*p.t),.68),spread=amount*taper;up.push({x:p.x,y:p.y-spread*.30});lo.push({x:p.x,y:p.y+spread*.72});}ctx.beginPath();ctx.moveTo(up[0].x,up[0].y);for(let i=1;i<up.length;i++)ctx.lineTo(up[i].x,up[i].y);for(let i=lo.length-1;i>=0;i--)ctx.lineTo(lo[i].x,lo[i].y);ctx.closePath();ctx.fillStyle='#08090a';ctx.fill();}
      ctx.restore();
    }

    function drawAnatomy(ctx,p,w,h,highlight=false,alpha=1){
      if(!p?.torso || !p?.head) return;
      const scale = Math.min(w/900,h/650);
      const point = q=>({x:q.x*w,y:q.y*h});
      const chain = (items,color,width)=>{
        const pts = items.map(point);
        ctx.beginPath();
        ctx.moveTo(pts[0].x,pts[0].y);
        pts.slice(1).forEach(q=>ctx.lineTo(q.x,q.y));
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.strokeStyle = '#08090a';
        ctx.lineWidth = Math.max(5,(width+6)*scale);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3,width*scale);
        ctx.stroke();
      };

      ctx.save();
      ctx.globalAlpha = alpha;
      if(highlight){
        const tx = p.torso.x*w;
        const ty = p.torso.y*h;
        ctx.beginPath();
        ctx.arc(tx,ty,Math.max(38,58*scale),0,Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,.34)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6,7]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const severed = new Set(Array.isArray(p.severed)?p.severed:[]);
      const broken = new Set(Array.isArray(p.brokenSeams)?p.brokenSeams:[]);
      const splitChain = (start,a,b,end,seam,color,width)=>{
        if(broken.has(seam)){ chain([start,a],color,width); chain([b,end],color,width); }
        else chain([start,end],color,width);
      };
      splitChain(severed.has('leftHip')?p.thLt:p.hl,p.thLmA,p.thLmB,p.kl,'leftThigh',p.color,13.5);
      splitChain(severed.has('leftKnee')?p.shLt:p.kl,p.shLmA,p.shLmB,p.al,'leftShin',p.color,13.5);
      splitChain(severed.has('rightHip')?p.thRt:p.hr,p.thRmA,p.thRmB,p.kr,'rightThigh',p.color,13.5);
      splitChain(severed.has('rightKnee')?p.shRt:p.kr,p.shRmA,p.shRmB,p.ar,'rightShin',p.color,13.5);
      splitChain(severed.has('leftShoulder')?p.uaLt:p.sl,p.uaLmA,p.uaLmB,p.el,'leftUpperArm',p.color,12);
      splitChain(severed.has('leftElbow')?p.faLt:p.el,p.faLmA,p.faLmB,p.wl,'leftForearm',p.color,12);
      splitChain(severed.has('rightShoulder')?p.uaRt:p.sr,p.uaRmA,p.uaRmB,p.er,'rightUpperArm',p.color,12);
      splitChain(severed.has('rightElbow')?p.faRt:p.er,p.faRmA,p.faRmB,p.wr,'rightForearm',p.color,12);

      const drawSegmentRect = (q,pw,ph,radius)=>{
        if(!q) return;
        const x=q.x*w,y=q.y*h,sw=Math.max(8,pw*scale),sh=Math.max(8,ph*scale);
        ctx.save();ctx.translate(x,y);ctx.rotate(q.a||0);
        ctx.fillStyle='#08090a';roundRect(ctx,-sw/2-3,-sh/2-3,sw+6,sh+6,Math.max(4,radius*scale));ctx.fill();
        ctx.fillStyle=p.color;roundRect(ctx,-sw/2,-sh/2,sw,sh,Math.max(3,(radius-2)*scale));ctx.fill();ctx.restore();
      };
      const torsoSplit = broken.has('torsoUpper') || broken.has('torsoLower');
      if(torsoSplit){
        drawSegmentRect(p.segTorsoTop,40,26,7);
        drawSegmentRect(p.torso,40,26,7);
        drawSegmentRect(p.segTorsoBottom,40,26,7);
      }else{
        const tx = p.torso.x*w;
        const ty = p.torso.y*h;
        ctx.save();
        ctx.translate(tx,ty);
        ctx.rotate(p.torso.a || 0);
        const tw = Math.max(18,40*scale);
        const th = Math.max(34,78*scale);
        ctx.fillStyle = '#08090a';
        roundRect(ctx,-tw/2-3,-th/2-3,tw+6,th+6,Math.max(7,13*scale));
        ctx.fill();
        ctx.fillStyle = p.color;
        roundRect(ctx,-tw/2,-th/2,tw,th,Math.max(6,11*scale));
        ctx.fill();
        ctx.restore();
      }

      if(broken.has('headMiddle')){
        drawSegmentRect(p.segHeadLower,40,24,10);
        drawSegmentRect(p.segHeadTop,40,24,10);
        ctx.restore();
        return;
      }

      const hx = p.head.x*w;
      const hy = p.head.y*h;
      const hr = Math.max(12,23.5*scale);
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
      ctx.restore();

      ctx.font = `${highlight?'700':'600'} ${Math.max(10,12*scale)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = highlight ? '#fff' : 'rgba(255,255,255,.78)';
      ctx.fillText(highlight ? `${p.name} · YOU` : p.name,hx,hy-hr-12);
      ctx.restore();
    }

    function drawProp(ctx,p,w,h){
      if(!p) return;
      const displayPoint=getDisplayPoint();
      const projectionRenderScale=getProjectionRenderScale();
      const projected = typeof displayPoint === 'function' ? displayPoint({x:p.x,y:p.y},w,h) : {x:p.x*w,y:p.y*h};
      const scale = typeof projectionRenderScale === 'function' ? projectionRenderScale(w,h) : Math.min(w/900,h/650);
      const x = projected.x;
      const y = projected.y;
      const s = Math.max(.72,scale*1.9)*(Number.isFinite(p.viewScale)?p.viewScale:1);
      if(p.type === 'balloon' && p.attachedTo?.mode === 'balloon' && p.attachedTo.anchor){
        const anchor = typeof displayPoint === 'function' ? displayPoint(p.attachedTo.anchor,w,h) : {x:p.attachedTo.anchor.x*w,y:p.attachedTo.anchor.y*h};
        ctx.save();
        ctx.strokeStyle='rgba(255,255,255,.48)';
        ctx.lineWidth=Math.max(1,s);
        ctx.beginPath();
        ctx.moveTo(x,y+15*s*Math.max(.22,p.scale||1));
        ctx.quadraticCurveTo((x+anchor.x)*.5+7*s,(y+anchor.y)*.5,anchor.x,anchor.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(p.a || 0);
      if(p.type === 'balloon') ctx.scale(Math.max(.22,p.scale||1),Math.max(.22,p.scale||1));
      ctx.lineCap = ctx.lineJoin = 'round';
      if(p.type === 'ball'){
        ctx.fillStyle = '#08090a';
        ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.fill();
        ctx.fillStyle = '#f1c84c';
        ctx.beginPath();ctx.arc(0,0,15*s,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle = 'rgba(20,20,20,.55)';ctx.lineWidth = Math.max(1,1.5*s);
        ctx.beginPath();ctx.arc(0,0,8*s,-1.1,1.1);ctx.stroke();
      }else if(p.type === 'balloon'){
        if(!p.attachedTo?.anchor){
          ctx.strokeStyle = 'rgba(255,255,255,.45)';ctx.lineWidth = Math.max(1,s);
          ctx.beginPath();ctx.moveTo(0,15*s);ctx.quadraticCurveTo(8*s,28*s,-2*s,42*s);ctx.stroke();
        }
        ctx.fillStyle = '#08090a';ctx.beginPath();ctx.ellipse(0,0,16*s,20*s,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.ellipse(0,0,13*s,17*s,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(-3*s,16*s);ctx.lineTo(3*s,16*s);ctx.lineTo(0,22*s);ctx.closePath();ctx.fill();
      }else if(p.type === 'pump'){
        ctx.fillStyle='#08090a';roundRect(ctx,-25*s,-33*s,50*s,66*s,7*s);ctx.fill();
        ctx.fillStyle='#d9dde2';roundRect(ctx,-20*s,-28*s,40*s,56*s,5*s);ctx.fill();
        ctx.fillStyle='#181a1e';roundRect(ctx,-12*s,-24*s,24*s,34*s,4*s);ctx.fill();
        ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(0,-30*s);ctx.lineTo(0,-49*s);ctx.stroke();
        ctx.strokeStyle='#08090a';ctx.lineWidth=Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-18*s,-50*s);ctx.lineTo(18*s,-50*s);ctx.stroke();
        ctx.strokeStyle='#f1c84c';ctx.lineWidth=Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-15*s,-50*s);ctx.lineTo(15*s,-50*s);ctx.stroke();
        ctx.strokeStyle='#d9dde2';ctx.lineWidth=Math.max(2,3*s);ctx.beginPath();ctx.moveTo(20*s,-18*s);ctx.lineTo(31*s,-29*s);ctx.stroke();
      }else if(p.type === 'frisbee'){
        ctx.fillStyle='#08090a';ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#d7dce2';ctx.beginPath();ctx.arc(0,0,20*s,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#111317';ctx.beginPath();ctx.arc(0,0,11*s,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=p.armed?'#ff4b5c':'rgba(255,255,255,.46)';
        ctx.lineWidth=Math.max(2,2.7*s);ctx.beginPath();ctx.arc(0,0,18*s,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle=p.armed?'#ff7b86':'rgba(20,20,20,.62)';ctx.lineWidth=Math.max(1,1.3*s);
        ctx.beginPath();ctx.moveTo(-15*s,0);ctx.lineTo(15*s,0);ctx.stroke();
      }else{
        ctx.strokeStyle = '#08090a';ctx.lineWidth = Math.max(7,8*s);ctx.beginPath();ctx.moveTo(-22*s,0);ctx.lineTo(22*s,0);ctx.stroke();
        ctx.strokeStyle = '#e9edf2';ctx.lineWidth = Math.max(3,4*s);ctx.beginPath();ctx.moveTo(-18*s,0);ctx.lineTo(17*s,0);ctx.stroke();
        ctx.fillStyle = '#cf6c63';ctx.beginPath();ctx.moveTo(22*s,0);ctx.lineTo(13*s,-5*s);ctx.lineTo(13*s,5*s);ctx.closePath();ctx.fill();
      }
      if(p.heldBy){
        ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(0,0,24*s,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }

    function roundRect(ctx,x,y,w,h,r){
      if(ctx.roundRect){
        ctx.beginPath();
        ctx.roundRect(x,y,w,h,r);
        return;
      }
      const rr = Math.min(r,w/2,h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr,y);
      ctx.arcTo(x+w,y,x+w,y+h,rr);
      ctx.arcTo(x+w,y+h,x,y+h,rr);
      ctx.arcTo(x,y+h,x,y,rr);
      ctx.arcTo(x,y,x+w,y,rr);
      ctx.closePath();
    }

    return {
      drawBackdrop,drawAnatomy,drawProp,roundRect,
      puppetalkLegacyHeadStyle,puppetalkLiveHeadPath,puppetalkDrawLiveEyes,puppetalkDrawLiveNose,
      puppetalkLiveMouthSamples,puppetalkDrawLiveMouth,
      PUPPETALK_LIVE_HEAD_STYLES,PUPPETALK_LIVE_EYE_NAMES,PUPPETALK_LIVE_NOSE_NAMES,
      PUPPETALK_LIVE_MOUTH_NAMES,PUPPETALK_LIVE_EXTRAS
    };
  }

  root.PuppetalkSceneRenderer={create};
})(typeof window!=='undefined'?window:globalThis);
