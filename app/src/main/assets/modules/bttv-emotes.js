// Twitch Extended's independent mobile renderer for BetterTTV's public emote API.
// No BetterTTV extension code or account credentials are bundled.
(()=>{
  if(window.__teBttv)return;
  window.__teBttv=true;
  const MESSAGE='.chat-line__message,.vod-message,.video-chat__message,[data-a-target="chat-line-message"],[data-test-selector="chat-line-message"]';
  const TEXT='[data-a-target="chat-message-text"],.text-fragment,[data-test-selector="chat-message-text"]';
  const SKIP='a,button,textarea,input,script,style,[contenteditable="true"],[data-a-target="chat-message-username"],.chat-author__display-name,.chat-line__username';
  const reserved=new Set(['directory','following','subscriptions','settings','search','downloads','turbo','inventory','wallet','login','signup','p','moderator','dashboard','videos','clips','collections','jobs','store','products','messages','friends']);
  let global=[],channel=[],emotes=new Map(),epoch=0,route='',controller=null,timer=0,observer=null,stopped=false;
  const cache=new Map(),pending=new Set(),failedImages=new Set();
  const report=event=>window.__te?.report('bttv',event);
  function valid(emote){return emote && /^[a-f0-9]{24}$/i.test(emote.id) && typeof emote.code==='string' && emote.code.length>0 && emote.code.length<=100 && !/\s/.test(emote.code) && !emote.modifier;}
  function index(){emotes=new Map([...global,...channel].filter(valid).map(e=>[e.code,e]));queue(document);}
  async function json(url,options={}){
    const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',...options});
    if(response.status===404)return null;
    if(!response.ok)throw new Error('Emote request failed');
    return response.json();
  }
  async function loadChannel(){
    const current=location.pathname;if(current===route)return;route=current;
    const seq=++epoch;controller?.abort();controller=new AbortController();channel=[];index();
    const parts=current.split('/').filter(Boolean);
    const login=parts.length===1&&!reserved.has(parts[0].toLowerCase())&&/^[a-z0-9_]{1,25}$/i.test(parts[0])?parts[0].toLowerCase():null;
    const vod=parts.length===2&&parts[0]==='videos'&&/^\d+$/.test(parts[1])?parts[1]:null;
    if(!login&&!vod)return;
    const key=login||'vod:'+vod;
    const hit=cache.get(key);
    if(hit && Date.now()-hit.at<300000){channel=hit.emotes;index();return;}
    const signal=controller.signal;
    const timeout=setTimeout(()=>controller?.signal===signal&&controller.abort(),12000);
    try{
      const query=login?'query ExtendedEmoteChannel($login:String!){user(login:$login){id}}':'query ExtendedEmoteVod($id:ID!){video(id:$id){owner{id}}}';
      const result=await json('https://gql.twitch.tv/gql',{method:'POST',headers:{'Content-Type':'application/json','Client-ID':'kimne78kx3ncx6brgo4mv6wki5h1ko'},body:JSON.stringify({query,variables:login?{login}:{id:vod}}),signal});
      const id=login?result?.data?.user?.id:result?.data?.video?.owner?.id;
      if(!/^\d+$/.test(id||''))return;
      const data=await json('https://api.betterttv.net/3/cached/users/twitch/'+id,{signal});
      if(stopped||seq!==epoch)return;
      channel=[...(data?.channelEmotes||[]),...(data?.sharedEmotes||[])].filter(valid);
      cache.set(key,{at:Date.now(),emotes:channel});if(cache.size>16)cache.delete(cache.keys().next().value);
      index();report('ready');
    }catch(e){if(e.name!=='AbortError'&&seq===epoch)report('error');}finally{clearTimeout(timeout);}
  }
  function render(scope){
    const flags=window.BetterTTV?.settings?.get('emotes')??3;
    if(!(flags&1))return;
    if(!scope?.isConnected||!emotes.size)return;
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest(SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const tokens=node.nodeValue.split(/(\s+)/);if(!tokens.some(t=>emotes.has(t)&&!failedImages.has(emotes.get(t).id)))continue;
      const fragment=document.createDocumentFragment();
      for(const token of tokens){
        const emote=emotes.get(token);
        if(!emote||failedImages.has(emote.id)){fragment.appendChild(document.createTextNode(token));continue;}
        const img=document.createElement('img');img.dataset.teBttv=emote.id;img.alt=token;img.title=token+' · BetterTTV';
        img.src='https://cdn.betterttv.net/emote/'+emote.id+(emote.animated&&!(flags&2)?'/static':'')+'/2x';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
        img.style.cssText='display:inline-block;height:1.5em;width:auto;max-width:6em;object-fit:contain;vertical-align:middle;margin:0 1px';
        img.addEventListener('error',()=>{failedImages.add(emote.id);img.replaceWith(document.createTextNode(token));},{once:true});
        fragment.appendChild(img);
      }
      node.replaceWith(fragment);
    }
  }
  function messages(root){
    const message=root.nodeType===1?root.closest(MESSAGE):root.parentElement?.closest(MESSAGE);
    if(message)process(message);
    root.querySelectorAll?.(MESSAGE).forEach(process);
  }
  function process(message){const spans=message.querySelectorAll(TEXT);if(spans.length)spans.forEach(render);}
  function queue(root){if(stopped)return;pending.add(root);if(!timer)timer=setTimeout(()=>{timer=0;const roots=[...pending];pending.clear();roots.forEach(messages);},80);}
  function start(){
    loadChannel();queue(document);
    observer=new MutationObserver(records=>{
      if(stopped)return;
      if(location.pathname!==route)loadChannel();
      for(const record of records){
        if(record.type==='characterData')queue(record.target);
        else for(const node of record.addedNodes)if(node.nodeType===1||node.nodeType===3)queue(node);
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);loadChannel();return result;};}
  function bindSettings(){
    window.BetterTTV?.settings?.on('changed.emotes',()=>{
      document.querySelectorAll('img[data-te-bttv]').forEach(img=>img.replaceWith(document.createTextNode(img.alt)));
      queue(document);
    });
  }
  window.addEventListener('te-bttv-ready',bindSettings,{once:true});
  window.addEventListener('popstate',loadChannel);
  window.addEventListener('pagehide',()=>{stopped=true;controller?.abort();observer?.disconnect();clearTimeout(timer);pending.clear();},{once:true});
  const globalController=new AbortController();
  const globalTimeout=setTimeout(()=>globalController.abort(),12000);
  window.addEventListener('pagehide',()=>globalController.abort(),{once:true});
  json('https://api.betterttv.net/3/cached/emotes/global',{signal:globalController.signal}).then(data=>{if(stopped)return;global=Array.isArray(data)?data.filter(valid):[];index();report('ready');}).catch(()=>{if(!stopped)report('error');}).finally(()=>clearTimeout(globalTimeout));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
