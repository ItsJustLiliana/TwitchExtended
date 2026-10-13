const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'});
  const p=await c.newPage();
  const dir='app/src/main/assets/modules/';
  let js="window.TeEvents={postMessage(s){try{(window.__teTestEvents??=[]).push(JSON.parse(s));}catch{}}};\n"+fs.readFileSync(dir+'runtime.js','utf8')+'\nwindow.__te.config={systemDark:true,vaft:true,rewind:true,bttv:true,promos:true};window.__te.setSetting=()=>{};\n';
  for(const module of ['mobile-shell.js','extension-settings.js','vaft.js','vod-unlock.js','hls.js','rewind.js','hide-promos.js'])js+=fs.readFileSync(dir+module,'utf8')+'\n';
  js+='window.__te.style('+JSON.stringify(fs.readFileSync(dir+'rewind.css','utf8')+fs.readFileSync(dir+'mobile.css','utf8'))+');\n';
  js+='window.__te.bttvCss='+JSON.stringify(fs.readFileSync(dir+'betterttv.css','utf8'))+';window.__te.style(window.__te.bttvCss);\n';
  js+="function boot(){"+fs.readFileSync(dir+'betterttv.js','utf8')+"}document.addEventListener('DOMContentLoaded',boot,{once:true});\n";
  js+=fs.readFileSync(dir+'bttv-emotes.js','utf8')+'\nwindow.__te.watchWorkers();';
  await p.addInitScript(js);
  for(const [name,url] of [['home','https://www.twitch.tv/'],['channel','https://m.twitch.tv/don kaaklijn'.replace('don kaaklijn','donkaaklijn')]]){
   await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForTimeout(4500);
   if(!await p.locator('#te-settings-nav').count()){fs.writeFileSync('dist/mobile-preview/channel-dom.json',JSON.stringify(await p.evaluate(()=>({url:location.href,buttons:[...document.querySelectorAll('button,a')].filter(e=>{const r=e.getBoundingClientRect();return r.top<100&&r.top>=0&&r.width>0}).map(e=>e.parentElement.outerHTML.slice(0,9000))})),null,2));await p.screenshot({path:'dist/mobile-preview/channel-no-nav.png'});throw new Error('Channel header not yet detected; DOM saved');}
   const geometry=await p.evaluate(()=>{const gear=document.querySelector('#te-settings-nav');return {host:gear.parentElement.tagName,gear:gear.getBoundingClientRect().toJSON(),buttons:[...gear.parentElement.querySelectorAll('a,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0}).map(e=>({label:e.innerText||e.getAttribute('aria-label'),rect:e.getBoundingClientRect().toJSON()}))};});
   assert.ok(['NAV','DIV'].includes(geometry.host));assert.ok(geometry.gear.right<=390);
   fs.writeFileSync('dist/mobile-preview/live-'+name+'-geometry.json',JSON.stringify(geometry,null,2));
   await p.screenshot({path:'dist/mobile-preview/live-'+name+'-after.png'});
   if(name==='channel'){
     await p.waitForSelector('.tr-seekbar',{state:'attached',timeout:15000});
     const layout=await p.evaluate(()=>{
       const area=document.querySelector('#tr-seekbar-area');const controls=area.parentElement;
       const mute=controls.querySelector('[data-a-target="player-mute-unmute-button"],button[aria-label*="mute" i]');
       const fullscreen=controls.querySelector('[data-a-target="player-fullscreen-button"]');
       const rect=area.getBoundingClientRect();const m=mute.getBoundingClientRect();const f=fullscreen.getBoundingClientRect();
       const hit=document.elementFromPoint(m.left+m.width/2,m.top+m.height/2);
       return {barTop:rect.top,muteBottom:m.bottom,fullscreenBottom:f.bottom,muteReachable:hit===mute||mute.contains(hit),hit:hit?.outerHTML.slice(0,500)};
     });
     assert.ok(layout.muteBottom<=layout.barTop-3);assert.ok(layout.fullscreenBottom<=layout.barTop-3);assert.equal(layout.muteReachable,true);console.log('Native mute/fullscreen stay above timeline:',layout);
     const tipLayout=await p.evaluate(()=>{
       const tip=[...document.querySelectorAll('.tw-tooltip-wrapper')].find(e=>e.textContent.trim()==='Tap to unmute');
       const mute=document.querySelector('[data-a-target="player-controls"] button[aria-label*="mute" i]');
       return tip?{bottom:tip.getBoundingClientRect().bottom,muteTop:mute.getBoundingClientRect().top,lift:tip.closest('[data-popper-placement]')?.style.translate}:null;
     });
     assert.ok(tipLayout,'Actual Tap to unmute tip present');
     assert.ok(tipLayout.bottom<=tipLayout.muteTop-7);console.log('Unmute tip clears button:',tipLayout);
     const muteSelector='[data-a-target="player-controls"] button[aria-label*="mute" i]';
     const mutedBefore=await p.evaluate(()=>document.querySelector('video:not(.tr-vod-video)').muted);
     await p.locator(muteSelector).tap();await p.waitForFunction(before=>document.querySelector('video:not(.tr-vod-video)').muted!==before,mutedBefore);
     await p.locator(muteSelector).tap();await p.waitForFunction(before=>document.querySelector('video:not(.tr-vod-video)').muted===before,mutedBefore);
     console.log('Native mute toggle works in both directions');
     fs.writeFileSync('dist/mobile-preview/player-controls-dom.json',JSON.stringify(await p.evaluate(()=>({controls:document.querySelector('#tr-seekbar-area').parentElement.outerHTML,buttons:[...document.querySelector('#tr-seekbar-area').parentElement.querySelectorAll('button')].map(e=>({label:e.getAttribute('aria-label'),target:e.getAttribute('data-a-target'),parent:e.parentElement.outerHTML.slice(0,1800),rect:e.getBoundingClientRect().toJSON()}))})),null,2));
     await p.evaluate(()=>{const bar=document.querySelector('.tr-seekbar');const r=bar.getBoundingClientRect();bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+r.width*.8,clientY:r.top+r.height/2}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));});
     await p.waitForFunction(()=>window.__te.rewinding&&document.querySelector('video.tr-vod-video')?.readyState>=3,{timeout:20000});
     const delayed=await p.evaluate(()=>({rewinding:window.__te.rewinding,time:document.querySelector('video.tr-vod-video').currentTime,mediaTarget:window.__te.video()?.className}));
     assert.ok(delayed.time>100);assert.ok(delayed.mediaTarget.includes('tr-vod-video'));
     await p.evaluate(()=>window.__te.media('pause'));await p.waitForFunction(()=>document.querySelector('video.tr-vod-video').paused);
     await p.evaluate(()=>window.__te.media('play'));await p.waitForFunction(()=>!document.querySelector('video.tr-vod-video').paused);
     if(!await p.locator('.tr-live-dot').count()){await p.locator('.video-player__container').tap({position:{x:150,y:80}});await p.waitForSelector('.tr-live-dot',{state:'attached',timeout:10000});}
     await p.evaluate(()=>document.querySelector('.tr-live-dot').click());await p.waitForFunction(()=>!window.__te.rewinding);
     console.log('Real live rewind, pause/resume and LIVE passed:',delayed);
     if(process.env.TE_PLAYBACK_SOAK==='1'){
       // Enable the real live element's audio for this observation; the earlier
       // mute regression intentionally restores its original autoplay-muted state.
       await p.evaluate(()=>{const v=document.querySelector('video:not(.tr-vod-video)');v.volume=1;v.muted=false;});
       const observation=await p.evaluate(()=>new Promise(resolve=>{
         const video=document.querySelector('video:not(.tr-vod-video)');const start=video.currentTime;
         const samples=[];const stalls=[];let frame=0;
         const waiting=()=>stalls.push({time:video.currentTime,ready:video.readyState});video.addEventListener('waiting',waiting);
         function observe(_now,meta){samples.push(video.currentTime-meta.mediaTime);frame=video.requestVideoFrameCallback(observe);}
         if(video.requestVideoFrameCallback)frame=video.requestVideoFrameCallback(observe);
         setTimeout(()=>{
           if(frame)video.cancelVideoFrameCallback(frame);video.removeEventListener('waiting',waiting);
           const sorted=samples.slice().sort((a,b)=>a-b);
           resolve({elapsed:video.currentTime-start,frames:samples.length,p95FrameClockGap:sorted[Math.floor(sorted.length*.95)]??null,stalls,quality:video.getVideoPlaybackQuality?.().toJSON?.()||{dropped:video.getVideoPlaybackQuality?.().droppedVideoFrames,total:video.getVideoPlaybackQuality?.().totalVideoFrames},videos:[...document.querySelectorAll('video')].map(v=>({vod:v.classList.contains('tr-vod-video'),paused:v.paused,muted:v.muted,volume:v.volume,rate:v.playbackRate,visible:v.offsetWidth>0})),events:window.__teTestEvents});
         },60000);
       }));
       fs.writeFileSync('dist/mobile-preview/playback-soak.json',JSON.stringify(observation,null,2));
       assert.ok(observation.elapsed>45);assert.ok(observation.frames>300);assert.ok(observation.videos.filter(v=>!v.paused&&!v.muted&&v.volume>0).length<=1);
       console.log('60-second playback observation (frame timing, not an audio timestamp measurement):',observation);
     }
   }
   const extensions=await p.evaluate(()=>({bttv:window.BetterTTV?.version,vaft:window.twitchAdSolutionsVersion,events:window.__teTestEvents,themeNodes:[...document.querySelectorAll('.tw-root--theme-dark,.tw-root--theme-light')].map(e=>({tag:e.tagName,class:e.className})),video:[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,time:v.currentTime,paused:v.paused,error:v.error?.code}))}));fs.writeFileSync('dist/mobile-preview/live-'+name+'-extensions.json',JSON.stringify(extensions,null,2));console.log('Extension smoke:',name,extensions.bttv,extensions.vaft,extensions.video);
   console.log(name,geometry.buttons.map(b=>({label:b.label,left:b.rect.left,width:b.rect.width})));
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
