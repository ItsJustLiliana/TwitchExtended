const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../app/src/main/assets/modules');
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Twitch Extended · lokale UI-test</title>
<style>body{margin:0;font:14px sans-serif;background:#0e0e10;color:#efeff1}.top-nav{display:flex;align-items:center;height:56px;padding:0 12px;background:#18181b}.top-nav a{color:#bf94ff;text-decoration:none;font-size:22px;font-weight:800}.top-nav button{background:none;color:inherit;border:0;height:40px}main{padding:20px}#preview-note{font-size:13px;color:#aaa}</style>
<div id="root"><nav class="top-nav"><a href="/">Twitch +</a><div style="display:flex;justify-content:space-between;width:240px;min-width:240px;margin-left:20px"><div style="padding:0 20px"><button aria-label="Bits"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2 3 16 12 22 21 16Z"/></svg></button></div><div style="padding:0 20px"><button aria-label="Prime"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14"/><path d="m13 7-5 6h4l-1 4 5-6h-4Z"/></svg></button></div></div></nav><main><h2>Mobiele UI-test</h2><p id="preview-note">Lokale test van de echte instellingen en navigatie. Geen Twitch-streams, account of advertenties.</p><p>Open het tandwiel voor de instellingen.</p></main></div>
<script>window.fetch=async()=>({ok:true,status:200,json:async()=>[],text:async()=>''});window.WebSocket=class extends EventTarget{constructor(){super();this.readyState=0;}close(){}send(){}};WebSocket.OPEN=1;WebSocket.CONNECTING=0;window.EventSource=class extends EventTarget{close(){}};</script>
<script src="/runtime.js"></script><script>
window.__te.config={vaft:true,rewind:true,bttv:true,promos:true,pip:true,background:false,desktop:false};
window.__te.setSetting=(id,on)=>{window.__te.config[id]=on;localStorage.setItem('preview-'+id,JSON.stringify(on));};
</script><script src="/extension-settings.js"></script><script>
fetchNativeStyle=()=>{};
</script><script src="/preview-boot.js"></script>`;
function server(){return http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname;
  if(file==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  if(file==='/preview-boot.js'){res.setHeader('Content-Type','text/javascript');res.end('window.__te.bttvCss='+JSON.stringify(fs.readFileSync(path.join(root,'betterttv.css'),'utf8'))+';window.__te.style(window.__te.bttvCss);\n'+fs.readFileSync(path.join(root,'betterttv.js'),'utf8'));return;}
  if(!/^\/[a-z-]+\.js$/.test(file)){res.writeHead(404);res.end();return;}
  const target=path.join(root,file.slice(1));if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/javascript');fs.createReadStream(target).pipe(res);
});}
module.exports={server};
if(require.main===module){server().listen(8765,'127.0.0.1',()=>console.log('Mobiele UI-preview: http://localhost:8765'))}
