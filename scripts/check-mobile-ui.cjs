const {chromium}=require('playwright');const {server}=require('./mobile-preview.cjs');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const local=server();await new Promise(r=>local.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 fs.mkdirSync('dist/mobile-preview',{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
  const page=await context.newPage();
  await page.addInitScript(()=>{const original=HTMLElement.prototype.attachShadow;HTMLElement.prototype.attachShadow=function(opts){const root=original.call(this,opts);if(opts.mode==='closed')window.previewShadow=root;return root;};});
  await page.goto('http://localhost:'+local.address().port);await page.waitForFunction(()=>window.BetterTTV?.openSettings);
  const spacing=await page.evaluate(()=>[...document.querySelectorAll('.top-nav button')].map(el=>el.getBoundingClientRect().toJSON()));
  assert.equal(spacing.length,3);for(let i=0;i<3;i++)assert.equal(spacing[i].width,40);for(let i=1;i<3;i++)assert.ok(Math.abs(spacing[i].left-spacing[i-1].right-4)<1);
  console.log('Nested mobile nav widths 40px; gaps 4px verified');
  await page.screenshot({path:'dist/mobile-preview/navigation.png'});
  const modes=await page.evaluate(async()=>{
    const results=[];const tools=window.BetterTTV.chatTools;
    for(const mode of [0,1,2,3]){
      window.BetterTTV.settings.set('deletedMessages',mode);
      const el=document.createElement('div');el.className='chat-line__message';el.style.padding='12px';
      el.innerHTML='<span data-a-target="chat-message-text">Deleted message test '+mode+'</span> <a class="link-fragment" href="https://example.com">link</a>';
      document.querySelector('#root main').appendChild(el);
      await new Promise(r=>setTimeout(r,20));
      let fiber={pendingProps:{message:{id:'test-'+mode,user:{userLogin:'fixture'}}}};
      for(let i=0;i<2;i++)fiber={return:fiber};el['__reactFiber$fixture']=fiber;
      tools.deleted.handleDelete('fixture','test-'+mode);
      const style=getComputedStyle(el);results.push({mode,display:style.display,background:style.backgroundColor,opacity:style.opacity,deleted:el.classList.contains('bttv-chat-line-deleted'),link:el.querySelector('a').hasAttribute('href')});
    }
    const existing=document.querySelector('.bttv-chat-line-deleted');
    const before=existing.style.cssText;
    window.BetterTTV.settings.set('deletedMessages',0);
    const preserved=existing.style.cssText===before;
    return {results,preserved};
  });
  assert.equal(modes.results[0].deleted,false);assert.equal(modes.results[1].deleted,true);assert.equal(modes.results[1].link,false);assert.equal(modes.results[2].display,'none');assert.equal(modes.results[3].background,'rgba(255, 0, 0, 0.3)');assert.equal(modes.results[3].opacity,'1');assert.equal(modes.preserved,true);
  const split=await page.evaluate(()=>{
    const api=window.BetterTTV.chatTools.split;const config=window.BetterTTV.settings;
    const nodes=[false,true].map(alternate=>{const el=document.createElement('div');el.className='chat-line__message';el.textContent='Split chat test';el.style.padding='12px';document.querySelector('#root main').appendChild(el);return [el,{__bttvAlternateBackground:alternate}];});
    config.set('splitChat',true);nodes.forEach(([el,message])=>api.render(el,message));
    const alternating=nodes[1][0].classList.contains('bttv-split-chat-alt-bg')&&!nodes[0][0].classList.contains('bttv-split-chat-alt-bg');
    config.set('splitChatColor','#123456');const custom=getComputedStyle(nodes[1][0]).backgroundColor;
    config.set('splitChat',false);const disabled=nodes.every(([el])=>!el.classList.contains('bttv-split-chat-alt-bg')&&el.style.backgroundColor==='');
    config.set('splitChat',true);const restored=nodes[1][0].classList.contains('bttv-split-chat-alt-bg');
    return {alternating,custom,disabled,restored};
  });
  assert.equal(split.alternating,true);assert.equal(split.custom,'rgb(18, 52, 86)');assert.equal(split.disabled,true);assert.equal(split.restored,true);console.log('Real split-chat settings:',split);
  await page.screenshot({path:'dist/mobile-preview/deleted-messages.png'});console.log('Actual deleted-message modes and live option changes:',modes);

  await page.click('#te-settings-nav');await page.waitForTimeout(400);
  for(const scheme of ['dark','light','dark']){
   await page.emulateMedia({colorScheme:scheme});await page.waitForTimeout(300);
   const result=await page.evaluate(()=>{const r=window.previewShadow;const root=r.querySelector('main');const settings=r.querySelector('[role="dialog"]');return {background:getComputedStyle(settings).backgroundColor,text:getComputedStyle(settings).color,dark:root.className.includes('theme-dark'),pro:r.textContent.includes('Subscriber Badge'),search:!!r.querySelector('input[aria-label="Zoek instellingen"]')};});
   assert.equal(result.dark,scheme==='dark');assert.equal(result.pro,false);assert.equal(result.search,true);assert.notEqual(result.background,result.text);
   await page.screenshot({path:'dist/mobile-preview/settings-'+scheme+'.png'});console.log(scheme,result);
  }
  for(const width of [320,390,430]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(200);
    const sizes=await page.evaluate(()=>{
      const r=window.previewShadow;const row=r.querySelector('[data-te-searchable="vaft"]');const title=row.querySelector('h3');const standard=[...r.querySelectorAll('h3')].find(e=>e.textContent==='Dark theme');const control=row.querySelector('input').nextElementSibling;const modal=r.querySelector('[role="dialog"]');
      return {moduleFont:getComputedStyle(title).fontSize,standardFont:getComputedStyle(standard).fontSize,switchWidth:control.getBoundingClientRect().width,switchHeight:control.getBoundingClientRect().height,overflow:modal.scrollWidth>modal.clientWidth};
    });
    assert.equal(sizes.moduleFont,sizes.standardFont);assert.equal(sizes.switchWidth,48);assert.equal(sizes.switchHeight,30);assert.equal(sizes.overflow,false);console.log('Consistent mobile control sizing',width,sizes);
    await page.screenshot({path:'dist/mobile-preview/settings-'+width+'.png'});
  }
  await context.close();
 }finally{await browser.close();local.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
