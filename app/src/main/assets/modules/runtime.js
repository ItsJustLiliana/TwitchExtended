(()=>{
  const te=window.__te={rewinding:false,background:false};
  te.report=(module,event)=>{
    if(window.TeEvents) window.TeEvents.postMessage(JSON.stringify({module,event}));
  };
  te.style=css=>{
    const attach=()=>{const s=document.createElement('style');s.textContent=css;document.documentElement.appendChild(s);};
    if(document.documentElement) attach(); else document.addEventListener('DOMContentLoaded',attach,{once:true});
  };
  window.addEventListener('error',()=>te.report('scripts','error'));
  window.addEventListener('unhandledrejection',()=>te.report('scripts','promise-error'));
  te.video=()=>te.rewinding?document.querySelector('video.tr-vod-video'):Array.from(document.querySelectorAll('video')).find(v=>v.offsetWidth && !v.paused)||Array.from(document.querySelectorAll('video')).find(v=>v.offsetWidth);
  te.media=action=>{const v=te.video();if(!v)return; if(action==='play')v.play().catch(()=>{});else if(action==='pause')v.pause();else if(action==='toggle')v.paused?v.play().catch(()=>{}):v.pause();};
  const oldLog=console.log;
  console.log=function(...args){
    const text=args.filter(a=>typeof a==='string').join(' ');
    if(text.includes('Reloading Twitch player')) te.report('vaft','player-reload');
    if(text.includes('TwitchRewind') && text.includes('Loaded'))te.report('rewind','ready');
    if(text.includes('TwitchRewind') && text.includes('Controls injected'))te.report('rewind','controls');
    return oldLog.apply(this,args);
  };
  document.addEventListener('visibilitychange',()=>{if(te.background && document.hidden){const v=te.video();if(v)v.play().catch(()=>{});}});
  te.watchWorkers=()=>{
    const Parent=window.Worker;
    window.Worker=class extends Parent {
      // TWITCH_EXTENDED_WORKER_DIAGNOSTICS
      constructor(url,options){
        super(url,options);
        this.addEventListener('error',()=>te.report('vaft','stream-error'));
        this.addEventListener('message',e=>{
          if(e.data?.key==='UpdateAdBlockBanner')te.report('vaft',e.data.isStrippingAdSegments?'ad-filtering':e.data.hasAds?'ad-detected':'no-ad-detected');
          if(e.data?.key==='ReloadPlayer')te.report('vaft','reload-request');
        });
      }
    };
  };
  let wasPlaying=false;
  setInterval(()=>{
    const v=te.video();const playing=!!v&&!v.paused&&!v.ended;
    if(playing!==wasPlaying){wasPlaying=playing;te.report('media',playing?'playing':'paused');}
  },1000);
})();
