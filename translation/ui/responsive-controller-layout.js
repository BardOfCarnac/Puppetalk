(function(root){
  'use strict';

  const documentRef=root.document;
  if(!documentRef?.head || documentRef.getElementById('puppetalk-responsive-controller-layout')) return;

  const style=documentRef.createElement('style');
  style.id='puppetalk-responsive-controller-layout';
  style.textContent=`
    @media (orientation:portrait){
      body.puppetalk-fullscreen .compact-controls{
        left:50%;
        right:auto;
        top:auto;
        bottom:max(8px,env(safe-area-inset-bottom));
        transform:translateX(-50%);
        width:min(calc(100vw - 16px),390px);
      }
      body.puppetalk-fullscreen .pose-strip{
        display:grid;
        grid-template-columns:repeat(6,minmax(0,1fr));
        gap:5px;
      }
      body.puppetalk-fullscreen .pose-strip button{
        width:100%;
        min-width:0;
        min-height:38px;
        padding:6px 3px;
        font-size:9px;
        line-height:1.05;
      }
      body.puppetalk-fullscreen .personal-stage-hint{
        bottom:max(72px,calc(env(safe-area-inset-bottom) + 64px));
      }
      body.puppetalk-fullscreen .depth-gesture-guide{
        bottom:max(58px,calc(env(safe-area-inset-bottom) + 50px));
      }
      body.puppetalk-fullscreen .depth-rim-bottom::after{
        bottom:max(54px,calc(env(safe-area-inset-bottom) + 46px));
      }
    }

    @media (orientation:portrait) and (max-width:380px){
      body.puppetalk-fullscreen .compact-controls{
        width:calc(100vw - 10px);
      }
      body.puppetalk-fullscreen .pose-strip{gap:3px}
      body.puppetalk-fullscreen .pose-strip button{
        min-height:36px;
        padding:5px 2px;
        font-size:8px;
      }
    }
  `;
  documentRef.head.appendChild(style);

  root.PuppetalkResponsiveControllerLayout={installed:true};
})(typeof window!=='undefined'?window:globalThis);
