(()=>{
  const labels=new Set(['get ad-free','get ad free','go ad-free','twitch turbo','try turbo','get turbo','ad-free kijken','bekijk zonder advertenties']);
  let scheduled=false;
  function scan(){
    scheduled=false;
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      const text=(el.textContent||'').trim().replace(/\s+/g,' ').toLowerCase();
      const target=el.getAttribute('data-a-target')||'';
      const href=el.getAttribute('href')||'';
      if(labels.has(text)||target==='turbo-link'||/^https:\/\/(www\.)?twitch\.tv\/turbo(?:[/?#]|$)/.test(href)||href==='/turbo'){
        if(el.querySelector('input') || /subscribe|subscription/.test(target))return;
        el.style.setProperty('display','none','important');
      }
    });
  }
  function queue(){if(!scheduled){scheduled=true;setTimeout(scan,200);}}
  function start(){scan();const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
