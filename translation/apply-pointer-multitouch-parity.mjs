import fs from 'node:fs';

const path='translation/live-browser-parity.mjs';
let source=fs.readFileSync(path,'utf8');
const startMarker='async function exerciseMultiTouch(controller,label){';
const endMarker='async function exerciseCoreControls(controller,label){';
const start=source.indexOf(startMarker);
const end=source.indexOf(endMarker,start);
if(start<0||end<0||end<=start)throw new Error('Missing multi-touch parity markers.');
if(source.indexOf(startMarker,start+startMarker.length)>=0)throw new Error('Ambiguous multi-touch parity marker.');
const replacement=`async function exerciseMultiTouch(controller,label){
  const geometry=await latestHandScreenPoints(controller);
  if(!geometry)throw new Error(\`${'${label}'} could not resolve hand/canvas geometry for multi-touch.\`);
  const {left,right,rect}=geometry;
  const clampX=x=>Math.max(rect.left+18,Math.min(rect.left+rect.width-18,x));
  const clampY=y=>Math.max(rect.top+18,Math.min(rect.top+rect.height-18,y));
  const l2={x:clampX(left.x-38),y:clampY(left.y+12)};
  const r2={x:clampX(right.x+38),y:clampY(right.y-12)};
  const dispatch=async(type,id,p,buttons)=>evaluate(controller,\`(()=>{
    const canvas=document.querySelector('#personal-canvas');
    if(!canvas)return false;
    const rawCapture=canvas.setPointerCapture;
    canvas.setPointerCapture=()=>{};
    try{
      const event=new PointerEvent(\${JSON.stringify(type)},{
        pointerId:\${id},pointerType:'touch',isPrimary:\${id===11},
        clientX:\${Number(p.x)},clientY:\${Number(p.y)},button:0,buttons:\${buttons},
        bubbles:true,cancelable:true
      });
      return canvas.dispatchEvent(event);
    }finally{canvas.setPointerCapture=rawCapture;}
  })()\`);

  const downStart=await traceLength(controller);
  await dispatch('pointerdown',11,left,1);
  await dispatch('pointerdown',12,right,1);
  const downRaw=await waitInput(controller,downStart,"e.input.grabs?.length===2&&e.input.grabs.some(g=>g.part==='leftHand')&&e.input.grabs.some(g=>g.part==='rightHand')",\`${'${label}'} two-hand pointer down\`,5000);

  const leftMoveStart=await traceLength(controller);
  await dispatch('pointermove',11,l2,1);
  await waitInput(controller,leftMoveStart,"e.input.grabs?.length===2&&e.input.grabs.some(g=>g.part==='leftHand')&&e.input.grabs.some(g=>g.part==='rightHand')",\`${'${label}'} left-hand pointer move\`,5000);
  const rightMoveStart=await traceLength(controller);
  await dispatch('pointermove',12,r2,1);
  const moveRaw=await waitInput(controller,rightMoveStart,"e.input.grabs?.length===2&&e.input.grabs.some(g=>g.part==='leftHand')&&e.input.grabs.some(g=>g.part==='rightHand')",\`${'${label}'} right-hand pointer move\`,5000);

  await dispatch('pointerup',11,l2,0);
  const upStart=await traceLength(controller);
  await dispatch('pointerup',12,r2,0);
  const upRaw=await waitInput(controller,upStart,"e.input.grabs?.length===0",\`${'${label}'} two-hand pointer release\`,5000);

  const down=normalizeInput(downRaw),move=normalizeInput(moveRaw),up=normalizeInput(upRaw);
  const dl=down.grabs.find(g=>g.part==='leftHand'),dr=down.grabs.find(g=>g.part==='rightHand');
  const ml=move.grabs.find(g=>g.part==='leftHand'),mr=move.grabs.find(g=>g.part==='rightHand');
  return {
    down:{parts:down.grabs.map(g=>g.part).sort(),grabCount:down.grabs.length},
    move:{
      parts:move.grabs.map(g=>g.part).sort(),grabCount:move.grabs.length,
      leftMovedLeft:Number(ml?.x)<Number(dl?.x)-.01,
      rightMovedRight:Number(mr?.x)>Number(dr?.x)+.01
    },
    up:{grabCount:up.grabs.length}
  };
}
`;
source=source.slice(0,start)+replacement+source.slice(end);
fs.writeFileSync(path,source);
console.log('Replaced flaky CDP touch emulation with synthetic two-pointer parity events.');
