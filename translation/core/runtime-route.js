(function(root){
  'use strict';

  function create({URLSearchParamsClass}={}){
    if(typeof URLSearchParamsClass !== 'function') return null;

    function parse(search){
      const qs = new URLSearchParamsClass(search);
      const mode = qs.get('mode') === 'controller' ? 'controller' : 'stage';
      const room = String(qs.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
      return {mode,room};
    }

    return {parse};
  }

  root.PuppetalkRuntimeRoute={create};
})(typeof window!=='undefined'?window:globalThis);
