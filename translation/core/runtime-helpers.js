(function(root){
  'use strict';

  function create({cleanLook,defaultLook,getStorage,random}={}){
    if(typeof cleanLook !== 'function' || typeof defaultLook !== 'function') return null;
    const storage = typeof getStorage === 'function' ? getStorage : ()=>root.localStorage;
    const rand = typeof random === 'function' ? random : ()=>Math.random();

    const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
    const clean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
    const peerId = r => `puppetalk-${r.toLowerCase()}`;
    const send = (conn,msg) => { if(conn?.open) conn.send(msg); };
    const cleanPlayerName = v => String(v || '').trim().replace(/\s+/g,' ').slice(0,24);

    function savedPlayerName(){
      try{return cleanPlayerName(storage().getItem('puppetalk-name'));}
      catch{return '';}
    }

    function savedLook(){
      try{return cleanLook(JSON.parse(storage().getItem('puppetalk-look')||'null'));}
      catch{return defaultLook();}
    }

    function saveLook(look){
      try{storage().setItem('puppetalk-look',JSON.stringify(cleanLook(look)));}
      catch{}
    }

    function roomCode(){
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({length:5},()=>chars[Math.floor(rand()*chars.length)]).join('');
    }

    function angleDelta(target,current){
      let d = target-current;
      while(d > Math.PI) d -= Math.PI*2;
      while(d < -Math.PI) d += Math.PI*2;
      return d;
    }

    return {
      clamp,clean,peerId,send,cleanPlayerName,savedPlayerName,
      savedLook,saveLook,roomCode,angleDelta
    };
  }

  root.PuppetalkRuntimeHelpers={create};
})(typeof window!=='undefined'?window:globalThis);
