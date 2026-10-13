const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});
  const dir='app/src/main/assets/modules/';
  await p.addInitScript(fs.readFileSync(dir+'runtime.js','utf8')+'\nwindow.__te.config={systemDark:true};window.__te.bttvCss='+JSON.stringify(fs.readFileSync(dir+'betterttv.css','utf8'))+';document.addEventListener("DOMContentLoaded",()=>{window.__te.style(window.__te.bttvCss);'+fs.readFileSync(dir+'betterttv.js','utf8')+'});');
  await p.goto('https://m.twitch.tv/donkaaklijn');await p.waitForSelector('.chat-line__message');await p.waitForFunction(()=>window.BetterTTV?.chatTools);
  const results=[];
  for(const mode of [0,1,2,3]){
   const before=await p.evaluate(mode=>{
    BetterTTV.settings.set('deletedMessages',mode);
    for(const el of document.querySelectorAll('.chat-line__message')){
     if(el.classList.contains('te-deletion-test'))continue;
     let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
     for(;f;f=f.return){const s=f.stateNode;if(s?.renderMessageBody&&s.props.message.messageBody&&!s.props.isDeleted){
      el.classList.add('te-deletion-test');window.testRenderer=s;window.testLine=el;
      const result={body:s.props.message.messageBody,id:s.props.message.id};
      // Trigger Twitch's own deleted-placeholder render, without sending any moderation action.
      s.props.isDeleted=true;s.forceUpdate();return result;
     }}
    }
    throw new Error('No original live message available');
   },mode);
   await p.waitForFunction(mode=>mode===0?!!window.testLine.querySelector('.chat-line__message--deleted-notice'):mode===2?getComputedStyle(window.testLine).display==='none':window.testLine.classList.contains('bttv-chat-line-deleted'),mode);
   const after=await p.evaluate(()=>({text:testLine.innerText,notice:!!testLine.querySelector('.chat-line__message--deleted-notice'),isDeleted:testRenderer.props.isDeleted,display:getComputedStyle(testLine).display,opacity:getComputedStyle(testLine).opacity,background:getComputedStyle(testLine).backgroundColor,marked:testLine.classList.contains('bttv-chat-line-deleted')}));
   if(mode===0){assert.equal(after.notice,true);assert.equal(after.isDeleted,true);}
   else{assert.equal(after.notice,false);assert.equal(after.isDeleted,false);assert.ok(after.text.includes(before.body));if(mode===2)assert.equal(after.display,'none');else assert.equal(after.marked,true);if(mode===3)assert.equal(after.background,'rgba(255, 0, 0, 0.3)');}
   results.push({mode,...after});
  }
  console.log('Actual Twitch renderer placeholder recovery, all four modes:',results);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

