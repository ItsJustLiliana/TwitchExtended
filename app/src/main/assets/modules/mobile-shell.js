(()=>{
  const normalize=s=>(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  const openLabels=new Set(['open app','open in app','open in the app','open in the twitch app','open twitch app','open de app','open in de app','in app openen','watch in app','watch in the app','watch in the twitch app','use the app','bekijk in de app','bekijken in app','open in twitch']);
  const browserLabels=new Set(['open in browser','open in the browser','continue in browser','continue in the browser','continue watching in browser','continue watching in the browser','watch in browser','watch in the browser','use browser','browse twitch','open in browser instead','openen in browser','open in de browser','doorgaan in browser','doorgaan in de browser','bekijken in browser','bekijk in browser','in browser openen','continue watching','keep using web','stay on web','use web','watch on web','watch on the web','continue on web','doorgaan met kijken','blijf in browser','blijf op de website']);
  const chosen=new WeakSet();
  const selector='button,a,[role="button"]';
  const label=el=>normalize(el.textContent)||normalize(el.getAttribute('aria-label'));
  function chooseBrowser(scope){
    const controls=Array.from(scope.querySelectorAll(selector));
    if(!controls.some(el=>openLabels.has(label(el))))return;
    const browser=controls.find(el=>browserLabels.has(label(el)));
    if(browser&&!chosen.has(browser)){
      chosen.add(browser);browser.click();
      if(scope.matches?.('[role="dialog"],[aria-modal="true"]')){
        const layer=scope.closest('.tw-modal-layer')||scope.closest('.ReactModal__Overlay')||scope;
        layer.style.setProperty('display','none','important');
        const close=scope.querySelector('[aria-label="Activate to close dialog"],[aria-label="Close"],[aria-label="Sluiten"],[data-a-target="modal-close-button"]');
        close?.click();
      }
    }
  }
  function scan(){
    document.querySelectorAll('[role="dialog"],[aria-modal="true"]').forEach(chooseBrowser);
    document.querySelectorAll(selector).forEach(el=>{
      if(!openLabels.has(label(el)))return;
      // Some mobile prompts omit dialog roles; only inspect nearby containers,
      // never the whole document, before selecting a browser alternative.
      let parent=el.parentElement;
      for(let i=0;i<4&&parent&&parent!==document.body;i++,parent=parent.parentElement)chooseBrowser(parent);
      el.style.setProperty('display','none','important');
    });
  }
  let timer=0;
  function queue(){if(!timer)timer=setTimeout(()=>{timer=0;scan();},100);}
  function start(){scan();const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(timer);},{once:true});}
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();


