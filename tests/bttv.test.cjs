const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const code=fs.readFileSync('app/src/main/assets/modules/bttv-emotes.js','utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const emote=(id,code)=>({id:id.repeat(24),code});
const markup='<div class="chat-line__message"><a class="chat-line__username">monkaS</a><span data-a-target="chat-message-text">hello monkaS Dance monkaSmall <a>monkaS</a><img class="twitch-emote"></span></div><textarea>monkaS</textarea><nav>monkaS</nav>';

test('global and channel emotes render only message tokens; errors retain readable text',async()=>{
  const dom=new JSDOM(markup,{url:'https://www.twitch.tv/first',runScripts:'outside-only'});
  const w=dom.window;const requests=[];
  w.__te={report(){}};
  w.fetch=async(url,opts)=>{
    requests.push({url,opts});
    const data=url.includes('emotes/global')?[emote('a','monkaS')]:url.includes('gql.twitch.tv')?{data:{user:{id:'123'}}}:{channelEmotes:[emote('b','Dance')],sharedEmotes:[]};
    return {ok:true,status:200,json:async()=>data};
  };
  try{
    w.eval(code);await wait(240);
    const imgs=w.document.querySelectorAll('img[data-te-bttv]');assert.equal(imgs.length,2);
    assert.equal(imgs[0].alt,'monkaS');assert.equal(imgs[1].alt,'Dance');
    assert.equal(w.document.querySelector('textarea').value,'monkaS');
    assert.equal(w.document.querySelector('nav').textContent,'monkaS');
    assert.equal(w.document.querySelector('.chat-line__username').textContent,'monkaS');
    assert.equal(w.document.querySelector('[data-a-target] a').textContent,'monkaS');
    assert.ok(w.document.querySelector('img.twitch-emote'));
    const bttvRequests=requests.filter(r=>r.url.includes('betterttv.net'));
    assert.ok(bttvRequests.every(r=>r.opts.credentials==='omit'&&!r.opts.headers));
    imgs[0].dispatchEvent(new w.Event('error'));await wait(200);
    assert.equal(w.document.querySelectorAll('img[data-te-bttv]').length,1);
    assert.ok(w.document.querySelector('[data-a-target]').textContent.includes('monkaS'));
    w.eval(code);await wait(100);assert.equal(requests.length,3);
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('channel switching ignores late responses from the old channel',async()=>{
  const dom=new JSDOM('<div class="chat-line__message"><span data-a-target="chat-message-text">Old New</span></div>',{url:'https://www.twitch.tv/first',runScripts:'outside-only'});
  const w=dom.window;let oldResolve;w.__te={report(){}};
  w.fetch=async(url,opts)=>{
    if(url.includes('emotes/global'))return {ok:true,status:200,json:async()=>[]};
    if(url.includes('gql.twitch.tv'))return {ok:true,status:200,json:async()=>({data:{user:{id:JSON.parse(opts.body).variables.login==='first'?'123':'456'}}})};
    if(url.endsWith('/123'))return new Promise(resolve=>{oldResolve=()=>resolve({ok:true,status:200,json:async()=>({channelEmotes:[emote('a','Old')]})})});
    return {ok:true,status:200,json:async()=>({sharedEmotes:[emote('b','New')]})};
  };
  try{
    w.eval(code);await wait(40);w.history.pushState({},'', '/second');await wait(150);oldResolve();await wait(150);
    const images=w.document.querySelectorAll('img[data-te-bttv]');assert.equal(images.length,1);assert.equal(images[0].alt,'New');
  }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
