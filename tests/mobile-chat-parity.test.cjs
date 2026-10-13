const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const shell=fs.readFileSync('app/src/main/assets/modules/mobile-shell.js','utf8');
test('pinned messages default to visible and can be switched off',()=>{
  const dom=new JSDOM('<div class="chat-room"></div>',{runScripts:'outside-only',url:'https://www.twitch.tv/'});
  const w=dom.window;
  try{
    w.__te={config:{pinnedMessages:true}};
    w.eval(shell);
    assert.equal(w.document.documentElement.classList.contains('te-hide-pinned'),false);
    w.__te.config.pinnedMessages=false;
    w.__te.refreshChatParity();
    assert.equal(w.document.documentElement.classList.contains('te-hide-pinned'),true);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
test('only show channel points shortcut for a real Twitch button and do not synthesize a balance',()=>{
  const html='<div class="chat-room"><div><textarea data-a-target="chat-input"></textarea></div><button data-a-target="community-points-button">Redeem</button></div>';
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.twitch.tv/'});
  const w=dom.window;
  try{
    w.__te={config:{}};
    const real=w.document.querySelector('[data-a-target="community-points-button"]');
    Object.defineProperty(real,'offsetParent',{get:()=>w.document.body});
    let clicks=0;real.onclick=()=>clicks++;
    w.eval(shell);
    const shortcut=w.document.getElementById('te-channel-points-shortcut');
    assert.ok(shortcut);
    shortcut.click();
    assert.equal(clicks,1);
    real.remove();
    w.__te.refreshChatParity();
    assert.equal(w.document.getElementById('te-channel-points-shortcut'),null);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
test('mobile navigation keeps Twitch React-owned wrappers intact',()=>{
  const code=fs.readFileSync('app/src/main/assets/modules/extension-settings.js','utf8');
  assert.doesNotMatch(code,/setProperty\('display','contents'/);
});
