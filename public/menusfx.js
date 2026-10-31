// ---- start-menu machinery sounds (v70) ----
// window.menuSfx(name, vol=1, rate=1): name = logo | land | bar | unfold | lock | button (assets/sfx/menu/*.mp3, synthesized for HEADS).
// Their own small AudioContext (the game's one only exists after JUGAR). Quiet on purpose: master 0.35.
// Browsers keep audio locked until a user gesture: the first pointer / touch / key press resumes it (inside the gesture, as iOS needs).
// A cue that fires while the context is not running is SKIPPED (never played late, never queued).
// Once the menu is hidden (JUGAR) it stops and closes its context. It never throws.
(function(){
  var NAMES=['logo','land','bar','unfold','lock','button'],MASTER=0.35;
  var AC=null,mg=null,bufs={},raw={},dead=false,muted=false,resuming=0,LOG=[];
  var Ctor=window.AudioContext||window.webkitAudioContext,Off=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  function note(n,ok,why){try{LOG.push({n:n,t:Math.round(performance.now()),ok:ok?1:0,why:why||''});if(LOG.length>60)LOG.shift();}catch(e){}return ok;}
  function dec(ctx,ab){return new Promise(function(res,rej){try{var p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);}catch(e){rej(e);}});}
  // fetch the six small files now; decode them without a (locked) realtime context
  function load(){
    if(!Ctor||typeof fetch!=='function')return;
    NAMES.forEach(function(n){
      try{fetch(new URL('assets/sfx/menu/'+n+'.mp3',document.baseURI)).then(function(r){return r.ok?r.arrayBuffer():Promise.reject(r.status);}).then(function(ab){
        raw[n]=ab.slice(0);
        return (Off?dec(new Off(1,44100,44100),ab):Promise.reject()).then(function(b){bufs[n]=b;delete raw[n];},function(){
          if(AC&&!bufs[n])return dec(AC,raw[n].slice(0)).then(function(b){bufs[n]=b;}); // no offline decoder: decode on the real context
        });
      }).catch(function(){});}catch(e){}
    });
  }
  function ensure(){
    if(AC||dead||!Ctor)return;
    try{
      AC=new Ctor();mg=AC.createGain();mg.gain.value=MASTER;mg.connect(AC.destination);
      NAMES.forEach(function(n){if(!bufs[n]&&raw[n])dec(AC,raw[n].slice(0)).then(function(b){bufs[n]=b;}).catch(function(){});}); // no offline decoder: decode here
    }catch(e){AC=null;}
  }
  function unlock(){
    if(dead)return;
    try{
      ensure();if(!AC||AC.state==='running'||AC.state==='closed')return;
      resuming=performance.now();var p=AC.resume();if(p&&p.catch)p.catch(function(){});
      try{var s=AC.createBufferSource();s.buffer=AC.createBuffer(1,1,22050);s.connect(AC.destination);s.start(0);}catch(e){} // iOS: a silent blip inside the gesture
    }catch(e){}
  }
  function stop(){
    if(dead)return;dead=true;
    for(var i=0;i<GEST.length;i++)document.removeEventListener(GEST[i],unlock,true);
    try{if(AC&&AC.state!=='closed'){var c=AC;AC=null;c.close().catch(function(){});}}catch(e){}
    AC=null;mg=null;bufs={};raw={};
  }
  function play(name,vol,rate){
    try{
      if(dead||muted||window.__noMenuSfx)return note(name,0,'off');
      if(document.hidden)return note(name,0,'hidden');
      if(!AC)return note(name,0,'no-gesture');
      if(AC.state!=='running')return note(name,0,'locked');
      var b=bufs[name];if(!b)return note(name,0,'no-buffer');
      var s=AC.createBufferSource(),g=AC.createGain();
      s.buffer=b;if(rate>0&&rate!==1)s.playbackRate.value=rate;
      g.gain.value=vol>=0?Math.min(vol,2):1;s.connect(g);g.connect(mg);s.start(0);
      return note(name,1);
    }catch(e){return note(name,0,'error');}
  }
  var GEST=['pointerdown','pointerup','touchend','click','keydown'];
  window.menuSfx=function(name,vol,rate){return play(name,vol,rate);};
  window.menuSfx.mute=function(on){muted=!!on;};
  window.menuSfx.stop=stop;
  window.menuSfx.log=LOG;
  window.menuSfx.info=function(){return {state:AC?AC.state:'none',buffers:Object.keys(bufs).length,dead:dead,muted:muted,resumed:resuming};};
  try{
    for(var i=0;i<GEST.length;i++)document.addEventListener(GEST[i],unlock,{capture:true,passive:true});
    // the game starts (JUGAR hides the whole start menu): free the audio
    var watch=function(){var m=document.getElementById('menu');if(!m||typeof MutationObserver!=='function')return;
      new MutationObserver(function(){if(m.hidden)stop();}).observe(m,{attributes:true,attributeFilter:['hidden']});};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){watch();load();});else{watch();load();}
  }catch(e){}
})();
