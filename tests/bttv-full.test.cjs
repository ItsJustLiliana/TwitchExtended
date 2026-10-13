const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('full upstream bundle initializes and mounts the real settings dialog',async()=>{
  const dom=new JSDOM('<div id="root"><nav class="top-nav"><a href="/">Twitch</a></nav></div>',{url:'https://m.twitch.tv/test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;let shadow;const errors=[];
  const attach=w.HTMLElement.prototype.attachShadow;
  w.HTMLElement.prototype.attachShadow=function(options){const result=attach.call(this,options);if(options.mode==='closed')shadow=result;return result;};
  w.CSSStyleSheet.prototype.replaceSync=function(css){this.cssText=css};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.CSS={escape:s=>s,supports:()=>false};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.fetch=async()=>({ok:true,status:200,json:async()=>[],text:async()=>''});
  w.WebSocket=class extends w.EventTarget {constructor(){super();this.readyState=0;}close(){}send(){}};
  w.WebSocket.OPEN=1;w.WebSocket.CONNECTING=0;
  w.EventSource=class extends w.EventTarget{close(){}};
  w.__te={report(module,event){if(event==='error')errors.push(new Error('Full bundle initialization failed'));},bttvCss:fs.readFileSync('app/src/main/assets/modules/betterttv.css','utf8')};
  w.captureTestError=e=>errors.push(e);
  const source=fs.readFileSync('app/src/main/assets/modules/betterttv.js','utf8').replace("captureException(){window.__te?.report(\"bttv\",\"error\")}",'captureException(e){window.captureTestError(e)}');
  try{
    w.eval(source);await wait(1000);
    assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));
    assert.equal(w.BetterTTV?.version,'7.7.28');assert.equal(typeof w.BetterTTV.openSettings,'function');
    await w.BetterTTV.openSettings();await wait(350);
    assert.ok(shadow);assert.ok(shadow.querySelector('[role="dialog"]'),'real BetterTTV settings modal opened');
    assert.ok(shadow.textContent.includes('BetterTTV'));
    assert.ok(shadow.querySelector('input[aria-label=\"Zoek instellingen\"]'));
    assert.ok(shadow.textContent.includes('VAFT Adblock'));
    assert.ok(shadow.textContent.includes('Twitch Rewind'));
    assert.equal(w.document.querySelectorAll('[data-a-target=\"betterttv-settings-button\"]').length,0);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
