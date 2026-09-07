(function(root){
  'use strict';

  const LOOK_PALETTE = ['#cf6c63','#d0a950','#7089b9','#729d78','#a879b2','#67a7a8','#d79b75','#8a6d5b','#d9c3a7','#7e8794','#d65050','#5b8fd1'];
  const LOOK_PARTS = {
    headStyle:['smooth','spikes','tallSpikes','burst','scallop','tufts','swept','fringe'],
    eyes:['closed','dots','happy','mismatch','sleepy','unevenDots','wink','winkRight'],
    nose:['angular','bow','curve','hook','long','slant'],
    mouth:['frown','line','pleased','shy','smile','smirk','soft','wavy'],
    extra:['none','glasses','moustache','freckles','eyepatch']
  };

  function legacyHeadStyle(head,hair){
    if(hair==='tuft') return 'tufts';
    if(hair==='wave') return 'swept';
    if(hair==='mop') return 'scallop';
    if(hair==='cap') return 'fringe';
    if(hair==='crop') return 'spikes';
    if(head==='long') return 'tallSpikes';
    if(head==='wide') return 'burst';
    return null;
  }

  function defaultLook(slot=0){
    const index=((slot%LOOK_PALETTE.length)+LOOK_PALETTE.length)%LOOK_PALETTE.length;
    return {color:LOOK_PALETTE[index],headStyle:'spikes',eyes:'dots',nose:'curve',mouth:'line',extra:'none'};
  }

  function cleanLook(value,slot=0){
    const base=defaultLook(slot);
    const look=value&&typeof value==='object'?value:{};
    const modernHead=LOOK_PARTS.headStyle.includes(look.headStyle)?look.headStyle:null;
    const legacyHead=legacyHeadStyle(look.head,look.hair);
    const headStyle=modernHead || legacyHead || base.headStyle;
    return {
      color:/^#[0-9a-f]{6}$/i.test(look.color||'')?look.color:base.color,
      headStyle,
      eyes:LOOK_PARTS.eyes.includes(look.eyes)?look.eyes:base.eyes,
      nose:LOOK_PARTS.nose.includes(look.nose)?look.nose:base.nose,
      mouth:LOOK_PARTS.mouth.includes(look.mouth)?look.mouth:base.mouth,
      extra:LOOK_PARTS.extra.includes(look.extra)?look.extra:base.extra
    };
  }

  root.PuppetalkLookModel = {LOOK_PALETTE,LOOK_PARTS,legacyHeadStyle,defaultLook,cleanLook};
})(typeof window !== 'undefined' ? window : globalThis);
