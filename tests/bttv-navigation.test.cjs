const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('shared navigation opens full settings once and survives SPA replacement',async()=>{
  const dom=new JSDOM('<nav class="top-nav"><a href="/">Twitch</a></nav>',{url:'https://www.twitch.tv/test',runScripts:'outside-only'});
  const w=dom.window;let opened=0;w.__te={config:{},setSetting(){}};w.BetterTTV={openSettings(){opened++}};
  try{
    w.eval(fs.readFileSync('app/src/main/assets/modules/extension-settings.js','utf8'));await wait(300);
    const button=w.document.querySelector('#te-settings-nav');assert.ok(button);button.click();assert.equal(opened,1);
    w.dispatchEvent(new w.Event('te-bttv-ready'));await wait(300);assert.equal(w.document.querySelectorAll('#te-settings-nav').length,1);
    w.document.querySelector('nav').replaceWith(w.document.createElement('nav'));w.document.querySelector('nav').className='top-nav';await wait(300);
    assert.equal(w.document.querySelectorAll('#te-settings-nav').length,1);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('shared settings stay accessible with BetterTTV disabled and search filters module toggles',async()=>{
  const dom=new JSDOM('<nav class="top-nav"></nav>',{url:'https://www.twitch.tv/test',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});const changes=[];w.__te={config:{bttv:false,vaft:true,rewind:true,promos:true},setSetting:(id,value)=>changes.push([id,value])};
  try{
    w.eval(fs.readFileSync('app/src/main/assets/modules/extension-settings.js','utf8'));await wait(200);
    w.document.querySelector('#te-settings-nav').click();
    const dialog=w.document.querySelector('[role="dialog"]');assert.ok(dialog);
    const search=dialog.querySelector('input[type="search"]');search.value='better';search.dispatchEvent(new w.Event('input'));
    const row=[...dialog.querySelectorAll('label')].find(el=>el.textContent==='BetterTTV');
    assert.equal(row.style.display,'flex');assert.equal([...dialog.querySelectorAll('label')].find(el=>el.textContent==='VAFT Adblock').style.display,'none');
    const toggle=row.querySelector('input');assert.equal(toggle.checked,false);toggle.click();assert.deepEqual(changes,[['bttv',true]]);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
