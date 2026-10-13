const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const dir = 'app/src/main/assets/modules/';
const read = f => fs.readFileSync(dir + f, 'utf8');

test('mobile shell hides app links and chooses browser only inside app prompts',()=>{
  const button=text=>({textContent:text,getAttribute(){return null},style:{setProperty(){this.hidden=true}},click(){this.clicks=(this.clicks||0)+1}});
  const open=button('Open App'),browser=button('Continue in browser'),subscribe=button('Subscribe'),unrelated=button('Open in browser');
  const prompt={querySelectorAll:()=>[open,browser]};
  const normalDialog={querySelectorAll:()=>[subscribe,unrelated]};
  let callback;const queued=[];
  const context={window:{addEventListener(){}},document:{documentElement:{},body:{},querySelectorAll:s=>s.includes('dialog')?[prompt,normalDialog]:[open,browser,subscribe,unrelated]},MutationObserver:class{constructor(cb){callback=cb}observe(){}disconnect(){}},setTimeout:cb=>{queued.push(cb);return queued.length},clearTimeout(){}};
  vm.runInNewContext(read('mobile-shell.js'),context);
  assert.equal(open.style.hidden,true);
  assert.equal(browser.clicks,1);
  assert.equal(unrelated.clicks,undefined);
  assert.equal(subscribe.style.hidden,undefined);
  for(let i=0;i<50;i++)callback();assert.equal(queued.length,1);queued[0]();
  assert.equal(browser.clicks,1);
});

test('all bundled scripts parse without syntax errors', () => {
  for (const name of ['runtime.js','mobile-shell.js','bttv-emotes.js','betterttv.js','extension-settings.js','vaft.js','vod-unlock.js','hls.js','rewind.js','hide-promos.js']) new vm.Script(read(name), {filename:name});
});

test('upstream rewind handles channel routes, hidden timelines and available history', () => {
  const context = {window:{addEventListener(){}}, document:{readyState:'loading',addEventListener(){}}, location:{pathname:'/XQC'},console,Date,setTimeout,clearTimeout};
  context.window.window=context.window;
  let source=read('rewind.js');
  const end=source.lastIndexOf('})();');
  source=source.slice(0,end)+'window.testAPI={state,formatTime,channelFromUrl,seekPctFromEvent,clampSeekSeconds};\n'+source.slice(end);
  vm.runInNewContext(source,context);
  const api=context.window.testAPI;
  assert.equal(api.channelFromUrl(),'xqc');
  context.location.pathname='/directory';assert.equal(api.channelFromUrl(),null);
  context.location.pathname='/videos/123';assert.equal(api.channelFromUrl(),null);
  assert.equal(api.formatTime(-20),'00:00:00');assert.equal(api.formatTime(3661),'01:01:01');
  assert.equal(api.seekPctFromEvent({isConnected:false},{clientX:0}),null);
  assert.equal(api.seekPctFromEvent({isConnected:true,getBoundingClientRect:()=>({width:0,left:0})},{clientX:5}),null);
  const el={isConnected:true,getBoundingClientRect:()=>({width:100,left:10})};
  assert.equal(api.seekPctFromEvent(el,{clientX:60}),0.5);
  assert.equal(api.seekPctFromEvent(el,{clientX:1000}),1);
  api.state.vodCreatedAt=new Date(Date.now()-100000).toISOString();
  assert.ok(api.clampSeekSeconds(1)>=85 && api.clampSeekSeconds(1)<86);
});

test('promo filter preserves subscriptions and menus; batches mutation bursts', () => {
  const elements = [
    ['Get Ad-Free','',null],['Subscribe','subscribe-button',null],['Account menu','',null],['Turbo','turbo-link','/turbo'],['Get Ad-Free','subscribe-button',null],['Prime','',null]
  ].map(([text,target,href])=>({textContent:text,hidden:false,getAttribute:k=>k==='data-a-target'?target:k==='href'?href:null,querySelector:()=>null,style:{setProperty(){this.hidden=true;}}}));
  let scans=0,callback;const queued=[];
  const context={window:{addEventListener(){}},document:{documentElement:{},querySelectorAll(){scans++;return elements}},MutationObserver:class{constructor(cb){callback=cb}observe(){}disconnect(){}},setTimeout:cb=>queued.push(cb)};
  vm.runInNewContext(read('hide-promos.js'),context);
  assert.equal(elements[0].style.hidden,true);assert.equal(elements[3].style.hidden,true);
  for(const i of [1,2,4,5])assert.equal(elements[i].style.hidden,undefined);
  for(let i=0;i<100;i++)callback();assert.equal(queued.length,1);queued[0]();assert.equal(scans,2);
});

test('VAFT reload guard protects delayed playback and rate-limits recovery',()=>{
  const code=read('vaft.js');const start=code.indexOf('    let extendedLastReload');const end=code.indexOf('        const playerAndState',start);
  let calls=0;let now=20000;
  const context={window:{__te:{rewinding:true}},Date:{now:()=>now},work:()=>calls++};
  vm.runInNewContext(code.slice(start,end)+'work();}\nwindow.task=doTwitchPlayerTask;',context);
  context.window.task(false,true);assert.equal(calls,0);
  context.window.__te.rewinding=false;context.window.task(false,true);assert.equal(calls,1);
  now+=1000;context.window.task(false,true);assert.equal(calls,1);
  now+=15000;context.window.task(false,true);assert.equal(calls,2);
});

test('VAFT then Rewind composes both worker patches and forwards worker options',()=>{
  const blobs=new Map();let seq=0;
  class FakeWorker {constructor(url,opts){this.url=url;this.opts=opts;}addEventListener(){}postMessage(){}}
  class FakeBlob {constructor(parts){this.source=parts.join('');}}
  class FakeURL extends URL {static createObjectURL(blob){const url='blob:https://www.twitch.tv/'+(++seq);blobs.set(url,blob.source);return url;}}
  class FakeXHR {open(method,url){this.url=url}overrideMimeType(){}send(){this.status=200;this.responseText=blobs.get(this.url)||'self.originalLoaded=true;';}}
  const context={Worker:FakeWorker,URL:FakeURL,Blob:FakeBlob,XMLHttpRequest:FakeXHR,document:{readyState:'loading',querySelector(){return null}},console:{log(){},error(){}},fetch:async()=>{},setInterval(){},setTimeout(){},addEventListener(){},localStorage:{getItem(){return null},setItem(){}},navigator:{userAgent:'Chrome'},location:{href:'https://www.twitch.tv/test'}};
  context.window=context;
  vm.runInNewContext(read('vaft.js'),context);
  const vaftWorker=context.Worker;
  assert.notEqual(vaftWorker,FakeWorker);
  vm.runInNewContext(read('vod-unlock.js'),context);
  const options={type:'classic',name:'player'};
  const worker=new context.Worker('blob:https://www.twitch.tv/original',options);
  assert.equal(worker.opts,options);
  const source=blobs.get(worker.url); 
  assert.ok(source.includes('hookWorkerFetch()'));
  const rewindBlob=[...blobs.values()].find(s=>s.includes('self.originalLoaded=true'));
  assert.ok(rewindBlob.includes('var _origFetch = self.fetch'));
  assert.ok(worker instanceof FakeWorker);
});
