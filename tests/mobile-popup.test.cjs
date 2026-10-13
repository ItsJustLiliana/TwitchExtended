const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
test('Keep using web dismisses the real mobile sheet and its backdrop without hiding login dialogs',()=>{
  const dom=new JSDOM('<div class="tw-modal-layer"><div class="ReactModal__Overlay"><div role="dialog" aria-modal="true"><button aria-label="Activate to close dialog"></button><a href="/?tt_deeplink=true">Open in App</a><button id="web"><img alt="Browser logo"><p>Keep using web</p></button></div></div></div><div role="dialog" id="login"><button>Log In</button></div>',{runScripts:'outside-only',url:'https://m.twitch.tv/'});
  const w=dom.window;let clicks=0,closed=0;
  try{
    w.document.querySelector('#web').onclick=()=>clicks++;
    w.document.querySelector('[aria-label="Activate to close dialog"]').onclick=()=>closed++;
    w.eval(fs.readFileSync('app/src/main/assets/modules/mobile-shell.js','utf8'));
    assert.equal(clicks,1);assert.equal(closed,1);
    assert.equal(w.document.querySelector('.tw-modal-layer').style.display,'none');
    assert.equal(w.document.querySelector('#login').style.display,'');
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
test('mobile app chooser selects Continue watching and suppresses the upsell dialog only',()=>{
  const dom=new JSDOM('<div role="dialog"><button id="app">Open in the Twitch app</button><button id="browser">Continue watching</button></div><button id="sub">Subscribe</button>',{runScripts:'outside-only',url:'https://www.twitch.tv/'});const w=dom.window;let clicked=0;
  try{
    w.document.querySelector('#browser').onclick=()=>clicked++;
    w.eval(fs.readFileSync('app/src/main/assets/modules/mobile-shell.js','utf8'));
    assert.equal(clicked,1);assert.equal(w.document.querySelector('[role="dialog"]').style.display,'none');assert.equal(w.document.querySelector('#sub').style.display,'');
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
