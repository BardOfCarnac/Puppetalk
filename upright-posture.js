// Gives the neutral Puppetalk stance a clearer upright core without making the
// ragdoll rigid. This only strengthens the head/chest/pelvis stack in Stand;
// other poses, limp mode and direct head dragging keep their existing behaviour.
(() => {
  const decoratedFetch = window.fetch.bind(window);
  if (window.PuppetalkUprightPosture) return;

  function patch(source) {
    if (typeof source !== 'string' || !source.includes('PUPPETALK_SEGMENTED_PUPPET_V1')) return source;
    if (source.includes('PUPPETALK_UPRIGHT_POSTURE_V1')) return source;

    const needle = `    servo(t,base,.008*muscle);\n    servo(p.head,base*.35,.0045*muscle);`;
    const replacement = `    // PUPPETALK_UPRIGHT_POSTURE_V1\n    // Stand should read as a person balancing over their hips, not a torso slung\n    // from them. Keep this as muscle/torque, never a position or angle teleport.\n    if(p.pose === 'stand'){\n      servo(t,0,.0115*muscle);\n      if(p.torsoBottom) servo(p.torsoBottom,0,.0125*muscle);\n      if(p.torsoTop) servo(p.torsoTop,0,.014*muscle);\n      if(!(p.grabbing && p.grabPart === 'head')){\n        servo(p.head,0,.0068*muscle);\n        if(p.headTop) servo(p.headTop,0,.008*muscle);\n      }\n    }else{\n      servo(t,base,.008*muscle);\n      servo(p.head,base*.35,.0045*muscle);\n    }`;

    if (!source.includes(needle)) {
      console.warn('Puppetalk upright posture could not find the core servo hook.');
      return source;
    }
    return source.replace(needle,replacement);
  }

  window.fetch = async (...args) => {
    const response = await decoratedFetch(...args);
    const target = String(args[0]?.url || args[0] || '');
    if (!/app\\.js(?:\\?|$)/.test(target)) return response;
    const text = await response.text();
    return new Response(patch(text), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };

  window.PuppetalkUprightPosture = { version: 1 };
})();
