(function(root){
  'use strict';

  function incompleteInviteShell(){
    return '<section class="join-form"><div class="join-panel card"><strong>Puppetalk</strong><div class="muted small">This invite is incomplete.</div></div></section>';
  }

  function stageShell(room,joinHref){
    return `
    <section class="stage-shell">
      <div class="stage-topbar">
        <div class="brand">
          <strong>Puppetalk</strong>
          <div class="small muted" id="stage-status">opening stage…</div>
        </div>
        <div class="join-card">
          <div class="small muted">JOIN ROOM</div>
          <div class="room-code">${room}</div>
          <div class="small muted join-link">${joinHref}</div>
        </div>
      </div>
      <canvas id="stage-canvas" aria-label="Puppetalk ensemble stage"></canvas>
    </section>`;
  }

  function controllerShell(room,poses){
    return `
    <section class="shell controller-shell personal-controller">
      <header class="controller-head">
        <div><strong>Puppetalk</strong><div class="small muted">room ${room}</div></div>
        <div class="small"><span class="status-dot" id="dot"></span><span id="controller-status">connecting</span></div>
      </header>

      <section class="personal-stage" id="personal-stage">
        <canvas id="personal-canvas" aria-label="Your Puppetalk scene"></canvas>
        <div class="personal-stage-hint" id="stage-hint">Connecting to the ensemble…</div>
        <div class="you-chip" id="you-chip" hidden>YOU</div>
      </section>


      <section class="card character-card" id="character-card">
        <div class="control-title"><span>Character</span><span class="small muted">tap a feature to cycle it</span></div>
        <div class="character-preview" id="character-preview" aria-hidden="true"></div>
        <div class="character-grid">
          <button type="button" data-look="headStyle"><span>Head</span><strong id="look-headStyle">spikes</strong></button>
          <button type="button" data-look="eyes"><span>Eyes</span><strong id="look-eyes">dots</strong></button>
          <button type="button" data-look="nose"><span>Nose</span><strong id="look-nose">curve</strong></button>
          <button type="button" data-look="mouth"><span>Mouth</span><strong id="look-mouth">line</strong></button>
          <button type="button" data-look="extra"><span>Extra</span><strong id="look-extra">none</strong></button>
        </div>
        <div class="character-colors" id="character-colors"></div>
        <button type="button" class="character-random" id="character-random">Random character</button>
      </section>

      <section class="card compact-controls">
        <div class="control-title"><span>Pose</span><span class="small muted">one or two finger grabs</span></div>
        <div class="pose-strip" id="poses">
          ${Object.keys(poses).map((pose,i)=>`<button data-pose="${pose}" class="${i?'':'active'}">${pose}</button>`).join('')}
          <button data-rag>Go limp</button>
        </div>
      </section>

      <section class="card voice-card compact-voice">
        <div class="control-title"><span>Voice mouth</span><span class="small muted">audio stays on this phone</span></div>
        <div class="voice-meter"><span id="level"></span></div>
        <div class="voice-actions">
          <button class="primary" id="mic">Enable microphone</button>
          <button id="talk">Hold to talk</button>
        </div>
      </section>

      <div class="controller-footer">
        <button id="special-item" class="primary" type="button">Special item</button>
        <button id="centre">Centre me</button>
        <button id="retry">Reconnect</button>
      </div>
    </section>`;
  }

  root.PuppetalkViewShells={incompleteInviteShell,stageShell,controllerShell};
})(typeof window!=='undefined'?window:globalThis);
