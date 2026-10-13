(()=>{
  const labels={vaft:'VAFT Adblock',rewind:'Twitch Rewind',bttv:'BetterTTV',promos:'Ad-Free / Turbo verbergen',background:'Achtergrondaudio',pip:'Picture-in-Picture',desktop:'Desktopweergave',pinnedMessages:'Vastgepinde moderatorberichten'};
  let timer=0;
  window.__te.openSettings=()=>{
    // Twitch Extended settings remain available with BTTV enabled.
    if(document.getElementById('te-settings-dialog'))return;
    const backdrop=document.createElement('div');backdrop.id='te-settings-dialog';
    backdrop.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    const panel=document.createElement('div');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Twitch Extended instellingen');
    panel.style.cssText='width:100%;max-width:560px;max-height:85dvh;overflow:auto;background:var(--te-bg);color:var(--te-fg);padding:20px;border:1px solid #53535f;border-radius:8px;font:20px sans-serif;box-sizing:border-box';
    const title=document.createElement('h2');title.textContent='Instellingen';panel.appendChild(title);
    const close=document.createElement('button');close.textContent='Sluiten';close.onclick=()=>backdrop.remove();panel.appendChild(close);
    const search=document.createElement('input');search.placeholder='Zoek instellingen';search.type='search';search.style.cssText='font:20px sans-serif;min-height:48px;width:100%;margin:16px 0;padding:12px;box-sizing:border-box;background:var(--te-input);color:var(--te-fg);border:1px solid #53535f;border-radius:4px';panel.appendChild(search);
    const rows=[];
    for(const [id,label] of Object.entries(labels)){
      const row=document.createElement('label');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:60px;padding:12px 0;border-bottom:1px solid #35353d';
      row.appendChild(document.createTextNode(label));const input=document.createElement('input');input.type='checkbox';input.checked=window.__te.config[id];input.style.cssText='width:48px;height:30px;flex-shrink:0;accent-color:#9146ff';input.setAttribute('role','switch');input.onchange=()=>window.__te.setSetting(id,input.checked);row.appendChild(input);panel.appendChild(row);rows.push([row,label.toLowerCase()]);
    }
    search.oninput=()=>rows.forEach(([row,label])=>row.style.display=label.includes(search.value.toLowerCase())?'flex':'none');
    const note=document.createElement('p');note.textContent='Wijzigingen herladen Twitch. Schakel BetterTTV in voor alle BetterTTV-instellingen.';panel.appendChild(note);
    const syncTheme=()=>{const dark=window.__te.config.systemDark ?? matchMedia('(prefers-color-scheme: dark)').matches;panel.style.setProperty('--te-bg',dark?'#18181b':'#fff');panel.style.setProperty('--te-fg',dark?'#efeff1':'#212529');panel.style.setProperty('--te-input',dark?'#0e0e10':'#f7f7f8');};syncTheme();
    const media=matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',syncTheme);window.addEventListener('te-system-theme',syncTheme);
    const remove=()=>{media.removeEventListener('change',syncTheme);window.removeEventListener('te-system-theme',syncTheme);backdrop.remove();};close.onclick=remove;
    backdrop.appendChild(panel);document.documentElement.appendChild(backdrop);backdrop.addEventListener('click',e=>{if(e.target===backdrop)remove();});search.focus();
  };
  function mount(){
    const metadata=document.querySelector('button[aria-label^="Open channel metadata"],button[aria-label*="channel metadata"],[data-a-target="channel-header"]');
    let channelHeader=null;
    for(let el=metadata?.parentElement,i=0;el&&i<5;el=el.parentElement,i++){
      const rect=el.getBoundingClientRect();
      if(rect.top<100&&rect.height<=120&&rect.width>=innerWidth-24){channelHeader=el;break;}
    }
    const host=channelHeader||document.querySelector('nav[aria-hidden="false"]')||document.querySelector('.top-nav__menu,[data-a-target="top-nav-container"],.top-nav')||Array.from(document.querySelectorAll('nav,header')).find(el=>el.getBoundingClientRect().top<96&&el.querySelector('a,button'));
    if(!host)return;
    let button=document.getElementById('te-settings-nav');
    if(!button){button=document.createElement('button');button.id='te-settings-nav';button.type='button';button.setAttribute('aria-label','Extensie-instellingen');
    button.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 3-.6 3-2.5 1.5-2.9-.9-3 5.2 2.3 2-.1 2.9L0 19l3 5 3-.9 2.4 1.4.6 3h6l.6-3 2.4-1.4 3 .9 3-5-2.3-2.3-.1-2.9 2.3-2-3-5.2-2.9.9L15.6 6 15 3Z" transform="translate(3 0) scale(.75)"/><circle cx="12" cy="12" r="3"/></svg>';
      button.onclick=window.__te.openSettings;
    }
    if(button.parentElement!==host)host.appendChild(button);
    button.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:40px;min-width:40px;max-width:40px;height:40px;flex:0 0 40px;margin:0;padding:0;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer';
    // Preserve Twitch's own header layout; setting display:flex on an arbitrary
    // nav/header causes alignment regressions on narrow phone screens.
    const links=Array.from(host.querySelectorAll('a,button'));
    const identity=metadata&&host.contains(metadata)?metadata:links.find(el=>el.matches('a[href="/"],a[interactioncontent="logo"]'))||links.find(el=>el.querySelector('img'));
    let identitySlot=identity;
    while(identitySlot&&identitySlot.parentElement!==host)identitySlot=identitySlot.parentElement;
    identitySlot?.style.setProperty('margin-right','auto','important');
    for(const control of links){
      if(control===identity||control.contains(identity)||control===button)continue;
      // Do not flatten React-owned wrappers: their sizes and click targets belong to Twitch.
      const iconOnly=!control.textContent.trim();
      if(iconOnly && matchMedia('(max-width: 700px)').matches){
        control.style.setProperty('min-width','40px','important');
        control.style.setProperty('min-height','40px','important');
        control.style.setProperty('box-sizing','border-box','important');
      }
    }
  }
  function queue(){if(!timer)timer=setTimeout(()=>{timer=0;mount();},150);}
  function start(){mount();const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(timer);},{once:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
